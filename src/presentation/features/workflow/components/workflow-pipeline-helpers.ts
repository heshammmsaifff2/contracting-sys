/**
 * مساعدات منشئ المسار — دوالّ محضة خارج ملفّ المكوّن.
 *
 * `react-refresh` يشترط أن يُصدِّر ملفُّ المكوّن مكوّناتٍ وحدها: تصديرُ دالّةٍ
 * معه يُعطّل التحديث الساخن للملفّ كلّه. والأنواع تُستورَد استيرادَ نوعٍ
 * فتُمحى عند الترجمة، فلا حلقة بين الملفّين وقت التشغيل.
 */
import type {
  ConditionOp,
  WorkflowCondition,
} from "@core/modules/workflow/entities/WorkflowCondition";
import type {
  ParticipantKind,
  WorkflowDefinitionDto,
} from "@application/modules/workflow/dtos";
import type {
  PipelineStageItem,
  StageActionItem,
  StageConditionItem,
} from "./WorkflowPipelineBuilder";

const BUILDER_KINDS: readonly { value: ParticipantKind; label: string }[] = [
  { value: "project_job", label: "وظيفة داخل المشروع (مثل مدير المشروع)" },
  { value: "job", label: "وظيفة على مستوى الشركة (مثل المحاسب)" },
  { value: "department", label: "قسم كامل" },
  { value: "requester", label: "مقدّم الطلب (صاحب المعاملة)" },
  { value: "user", label: "موظف محدد بالاسم" },
];

const LEGACY_BUILDER_KINDS: Partial<Record<ParticipantKind, string>> = {
  project_role: "دور في المشروع (نظام قديم)",
  role: "دور عام في النظام (نظام قديم)",
  department_role: "دور داخل قسم (نظام قديم)",
};

/**
 * أنواع المشارك في المنشئ. النوع القديم يُعرض لمشاركٍ محفوظٍ به فقط —
 * بغيره تُظهر القائمة أوّل خيار وهو ليس المحفوظ، فيُحفظ غيره سهوًا.
 */
export function builderKindOptions(
  current: ParticipantKind,
): { value: ParticipantKind; label: string }[] {
  const legacy = LEGACY_BUILDER_KINDS[current];
  return legacy === undefined
    ? [...BUILDER_KINDS]
    : [...BUILDER_KINDS, { value: current, label: legacy }];
}

/** ما يكفي من المسار للتحويل — يقبله `WorkflowDefinitionDto` كما هو. */
export type DefinitionShape = Pick<WorkflowDefinitionDto, "stages">;

export function buildConditionFromItem(item: {
  field: string;
  op: ConditionOp;
  value: string;
}): WorkflowCondition | null {
  const { field, op, value } = item;
  if (!field || field.trim() === "") return null;
  const needsValue = op !== "is_null" && op !== "is_not_null";
  if (!needsValue) {
    return { op: op as "is_null" | "is_not_null", field: field.trim() };
  }
  const isList = op === "in" || op === "not_in";
  if (isList) {
    const listValues = value
      .split(",")
      .map((part) => part.trim())
      .filter((part) => part !== "")
      .map((part) => (Number.isNaN(Number(part)) ? part : Number(part)));
    return { op: op as "in" | "not_in", field: field.trim(), value: listValues };
  }
  const parsedNum = Number(value);
  const finalVal =
    value.trim() !== "" && !Number.isNaN(parsedNum) ? parsedNum : value.trim();
  return {
    op: op as "eq" | "ne" | "gt" | "gte" | "lt" | "lte",
    field: field.trim(),
    value: finalVal,
  };
}

export function createDefaultActionsForStage(
  stageIndex: number,
  totalStages: number,
  allStages: PipelineStageItem[],
): StageActionItem[] {
  const isFinal = stageIndex === totalStages - 1;
  const actions: StageActionItem[] = [];

  // 1. زر التقدم أو الإغلاق
  if (!isFinal) {
    const nextStage = allStages[stageIndex + 1];
    actions.push({
      id: `act_${Date.now()}_fwd`,
      actionKey: "forward",
      label: "اعتماد وإرسال",
      kind: "forward",
      sortOrder: 1,
      requiresNote: false,
      requiresAttachment: false,
      requiresEvaluation: false,
      returnHours: 0,
      returnMinutes: 0,
      routes: nextStage
        ? [
            {
              id: `rt_${Date.now()}_fwd`,
              targetStageKey: nextStage.stageKey,
              priority: 1,
              hasCondition: false,
              field: "amount",
              op: "gt",
              value: "",
            },
          ]
        : [],
    });
  } else {
    actions.push({
      id: `act_${Date.now()}_arch`,
      actionKey: "archive",
      label: "إغلاق وأرشفة",
      kind: "final",
      sortOrder: 1,
      requiresNote: false,
      requiresAttachment: false,
      requiresEvaluation: false,
      returnHours: 0,
      returnMinutes: 0,
      routes: [],
    });
  }

  // 2. زر الإرجاع للمراحل بعد الأولى
  if (stageIndex > 0) {
    const prevStage = allStages[stageIndex - 1];
    actions.push({
      id: `act_${Date.now()}_bwd`,
      actionKey: "backward",
      label: isFinal ? "إرجاع للمراجعة" : "إرجاع / رفض",
      kind: "backward",
      sortOrder: 2,
      requiresNote: true,
      requiresAttachment: false,
      requiresEvaluation: false,
      returnHours: 0,
      returnMinutes: 0,
      routes: prevStage
        ? [
            {
              id: `rt_${Date.now()}_bwd`,
              targetStageKey: prevStage.stageKey,
              priority: 1,
              hasCondition: false,
              field: "amount",
              op: "gt",
              value: "",
            },
          ]
        : [],
    });
  }

  // 3. زر الملاحظة
  actions.push({
    id: `act_${Date.now()}_note`,
    actionKey: "note",
    label: "إضافة ملاحظة",
    kind: "note",
    sortOrder: 3,
    requiresNote: true,
    requiresAttachment: false,
    requiresEvaluation: false,
    returnHours: 0,
    returnMinutes: 0,
    routes: [],
  });

  return actions;
}

// ── من المسار المحفوظ إلى شكل المنشئ ────────────────────────────────────
/**
 * عكس `buildConditionFromItem`: يفكّ الشرط المحفوظ إلى حقوله الثلاثة.
 *
 * والمنشئ لا يعرف إلّا الشرط البسيط (حقل · معامل · قيمة). فشرطٌ مركّب
 * (`and`/`or`/`not`) لا يُمثَّل فيه، ويُعاد `null` — والمحرِّر التفصيليّ هو
 * موضعه. ولا يُفقَد: التعديل في المنشئ يُعيد بناء المسودّة، فيُنبَّه عليه.
 */
export function conditionToItem(
  condition: WorkflowCondition | null,
): { field: string; op: ConditionOp; value: string } | null {
  if (condition === null) return null;
  if (!("field" in condition)) return null;

  if (!("value" in condition)) {
    return { field: condition.field, op: condition.op, value: "" };
  }
  const raw = condition.value;
  return {
    field: condition.field,
    op: condition.op,
    value: Array.isArray(raw) ? raw.join(", ") : String(raw),
  };
}

/** ساعات ودقائق من مجموع الدقائق — كما يعرضها المنشئ. */
function splitMinutes(total: number | null): { hours: number; minutes: number } {
  const safe = total ?? 0;
  return { hours: Math.floor(safe / 60), minutes: safe % 60 };
}

/**
 * يحوّل مسارًا محفوظًا إلى حالة المنشئ ليُعدَّل بنفس طريقة بنائه.
 *
 * ويُقرأ **بمفاتيح المراحل** لا بمعرّفاتها: المنشئ يصف الوجهات بالمفتاح،
 * وإعادةُ البناء تُنشئ صفوفًا جديدة بمعرّفات جديدة، فالمفتاح هو ما يصمد.
 */
export function definitionToPipelineStages(
  definition: DefinitionShape,
): PipelineStageItem[] {
  const keyById = new Map(definition.stages.map((s) => [s.id, s.stageKey]));

  return [...definition.stages]
    .sort((a, b) => a.sortOrder - b.sortOrder)
    .map((stage, index) => {
      const sla = splitMinutes(stage.slaMinutes);
      const backward = stage.actions.find((a) => a.kind === "backward");
      const ret = splitMinutes(backward?.returnMinutes ?? null);
      const attachment = stage.requirements.find((r) => r.kind === "attachment");

      const actions: StageActionItem[] = [...stage.actions]
        .sort((a, b) => a.sortOrder - b.sortOrder)
        .map((action, aIdx) => {
          const actRet = splitMinutes(action.returnMinutes);
          return {
            id: `act_${stage.id}_${aIdx}`,
            actionKey: action.actionKey,
            label: action.label,
            kind: action.kind,
            sortOrder: action.sortOrder,
            requiresNote: action.requiresNote,
            requiresAttachment: action.requiresAttachment,
            requiresEvaluation: action.requiresEvaluation,
            returnHours: actRet.hours,
            returnMinutes: actRet.minutes,
            routes: [...action.routes]
              .sort((a, b) => a.priority - b.priority)
              .map((route, rIdx) => {
                const cond = conditionToItem(route.condition);
                return {
                  id: `rt_${action.id}_${rIdx}`,
                  targetStageKey: keyById.get(route.targetStageId) ?? "",
                  priority: route.priority,
                  hasCondition: cond !== null,
                  field: cond?.field ?? "amount",
                  op: cond?.op ?? "gt",
                  value: cond?.value ?? "",
                };
              }),
          };
        });

      const conditions: StageConditionItem[] = stage.requirements
        .filter((r) => r.kind === "condition")
        .flatMap((req, cIdx) => {
          const cond = conditionToItem(req.condition);
          if (cond === null) return [];
          return [
            {
              id: `cnd_${stage.id}_${cIdx}`,
              field: cond.field,
              op: cond.op,
              value: cond.value,
              message: req.message,
              appliesTo: req.appliesTo,
            },
          ];
        });

      // وجهات الأزرار الأمامية هي «الوجهات المخصّصة» التي يعرضها المنشئ
      const forwardTargets = [
        ...new Set(
          stage.actions
            .filter((a) => a.kind === "forward" || a.kind === "closure")
            .flatMap((a) => a.routes.map((r) => keyById.get(r.targetStageId) ?? ""))
            .filter((key) => key !== ""),
        ),
      ];
      const isLinearNext =
        forwardTargets.length === 1 &&
        forwardTargets[0] === definition.stages[index + 1]?.stageKey;

      return {
        id: stage.id,
        name: stage.name,
        stageKey: stage.stageKey,
        slaHours: sla.hours,
        slaMinutes: sla.minutes,
        completionPolicy: stage.completionPolicy,
        quorumCount: stage.quorumCount ?? 2,
        joinPolicy: stage.joinPolicy,
        claimPolicy: stage.claimPolicy,
        requiresReceive: stage.requiresReceive,
        isProgramManager: stage.isProgramManager,
        isArchive: stage.isArchive,
        returnHours: ret.hours,
        returnMinutes: ret.minutes,
        requiresAttachment: attachment !== undefined,
        minAttachments: attachment?.minAttachments ?? 1,
        attachmentMessage:
          attachment?.message ?? "يرجى إرفاق المستند المطلوب قبل الاعتماد",
        participants: stage.participants.map((p, pIdx) => ({
          id: `p_${stage.id}_${pIdx}`,
          kind: p.kind,
          roleId: p.roleId ?? "",
          userId: p.userId ?? "",
          jobId: p.jobId ?? "",
          departmentId: p.departmentId ?? "",
          requiresSign: p.requiresSign,
          isOptional: p.isOptional,
          isObserver: p.isObserver,
        })),
        showAdvanced: false,
        targetMode: isLinearNext || forwardTargets.length === 0 ? "auto" : "custom",
        customTargets: forwardTargets,
        customActionsEnabled: actions.length > 0,
        actions,
        conditions,
        hasDeadline: stage.deadlineSpec !== null,
        deadlineTime: stage.deadlineSpec?.time ?? "14:00",
        deadlineDays: [...(stage.deadlineSpec?.days ?? [])],
        deadlineAction: stage.deadlineAction,
      };
    });
}

/**
 * ما لا يستطيع المنشئ تمثيله، فيضيع لو حُفِظ منه.
 *
 * المنشئ يعرف الشرط البسيط وحده (حقل · معامل · قيمة)، والشرط المركّب
 * (`and`/`or`/`not`) لا موضع له في نموذجه. وحفظُ المسودّة من المنشئ يُعيد
 * بناءها كاملةً، فيسقط ما لم يُمثَّل. ولا يصحّ أن يسقط صامتًا — يُسمّى
 * صاحبه قبل الحفظ ليقرّر.
 */
export function unrepresentableConditions(
  definition: DefinitionShape,
): readonly string[] {
  const lost: string[] = [];

  for (const stage of definition.stages) {
    const isCompound = (condition: WorkflowCondition | null): boolean =>
      condition !== null && conditionToItem(condition) === null;

    for (const requirement of stage.requirements) {
      if (requirement.kind === "condition" && isCompound(requirement.condition)) {
        lost.push(`${stage.name} — شرط جاهزية`);
      }
    }
    for (const action of stage.actions) {
      for (const route of action.routes) {
        if (isCompound(route.condition)) {
          lost.push(`${stage.name} — وجهة الزرّ «${action.label}»`);
        }
      }
    }
  }

  return lost;
}
