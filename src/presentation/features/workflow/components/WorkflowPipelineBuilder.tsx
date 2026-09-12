/**
 * منشئ خط سير العمل السريع والمتقدم (Pipeline Builder).
 *
 * يتيح إنشاء مسار كامل للمراسلات أو العمليات بطريقة بصرية سهلة وسريعة:
 * - إضافة المراحل وترتيبها بالسحب والإفلات (Drag & Drop) أو بأزرار التحريك.
 * - قوالب جاهزة سريعة (بما في ذلك خيار "قالب فارغ" للبدء من الصفر بحقول نظيفة).
 * - تحكم دقيق بالساعات والدقائق للمهلة المحددة (SLA) ومهلة الإرجاع (Return Duration).
 * - خيارات متقدمة شاملة لكل مرحلة: سياسات الإنجاز (الجميع/أولهم/نصاب)، الالتقاء (wait_all)،
 *   الحجز الحصري (exclusive)، اشتراط الاستلام، شروط المرفقات، ومدة الإرجاع المخصصة.
 * - دعم إضافة أكثر من مشارك في نفس المرحلة (إلزامي، اختياري، مراقب، موقّع).
 * - الربط التلقائي للأزرار ومسارات التوجيه (اعتماد، إرجاع، ملاحظة، إغلاق وأرشفة).
 */
import { useState, type DragEvent } from "react";
import {
  ArrowLeft,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Clock,
  CornerDownLeft,
  FileCheck,
  FolderPlus,
  GitFork,
  GripVertical,
  Layers,
  Plus,
  Route,
  Sliders,
  AlertTriangle,
  Sparkles,
  Trash2,
  UserPlus,
  Users,
} from "lucide-react";
import type { ActionKind } from "@core/modules/workflow/entities/WorkflowAction";
import type { ConditionOp } from "@core/modules/workflow/entities/WorkflowCondition";
import type { CompletionPolicy } from "@core/modules/workflow/entities/StageInstance";
import type { ClaimPolicy } from "@core/modules/workflow/entities/WorkflowGovernance";
import type {
  DeadlineAction,
  JoinPolicy,
  ParticipantKind,
  PipelineStageInput,
  RequirementScope,
  WorkflowDefinitionDto,
} from "@application/modules/workflow/dtos";
import {
  StageAdvancedConfigModal,
  StageCustomActionsModal,
} from "./WorkflowPipelineStageModals";
import { Badge } from "@presentation/shared/ui/Badge";
import { Button } from "@presentation/shared/ui/Button";
import { Checkbox } from "@presentation/shared/ui/Checkbox";
import { FormField } from "@presentation/shared/ui/FormField";
import { Input } from "@presentation/shared/ui/Input";
import { Modal } from "@presentation/shared/ui/Modal";
import { Select } from "@presentation/shared/ui/Select";
import { errorMessage } from "@presentation/shared/lib/query";
import {
  useProfiles,
  useRoles,
} from "@presentation/features/identity/hooks/useIdentity";
import { useSavePipelineWorkflow, useWorkflowDefinitions } from "../hooks/useWorkflow";
import {
  buildConditionFromItem,
  createDefaultActionsForStage,
  definitionToPipelineStages,
  unrepresentableConditions,
} from "./workflow-pipeline-helpers";
import { t } from "@i18n/index";

export interface StageParticipantItem {
  id: string;
  kind: ParticipantKind;
  roleId: string;
  userId: string;
  requiresSign: boolean;
  isOptional: boolean;
  isObserver: boolean;
}

export interface StageRouteItem {
  id: string;
  targetStageKey: string;
  priority: number;
  hasCondition: boolean;
  field: string;
  op: ConditionOp;
  value: string;
}

export interface StageActionItem {
  id: string;
  actionKey: string;
  label: string;
  kind: ActionKind;
  sortOrder: number;
  requiresNote: boolean;
  requiresAttachment: boolean;
  requiresEvaluation: boolean;
  returnHours: number;
  returnMinutes: number;
  routes: StageRouteItem[];
}

export interface StageConditionItem {
  id: string;
  field: string;
  op: ConditionOp;
  value: string;
  message: string;
  appliesTo: RequirementScope;
}

export interface PipelineStageItem {
  id: string;
  name: string;
  stageKey: string;
  // المهلة المحددة بالساعات والدقائق
  slaHours: number;
  slaMinutes: number;
  // السياسات
  completionPolicy: CompletionPolicy;
  quorumCount: number;
  joinPolicy: JoinPolicy;
  claimPolicy: ClaimPolicy;
  requiresReceive: boolean;
  isProgramManager: boolean;
  isArchive: boolean;
  // مهلة الإرجاع عند الرفض بالساعات والدقائق
  returnHours: number;
  returnMinutes: number;
  // شروط المرفقات
  requiresAttachment: boolean;
  minAttachments: number;
  attachmentMessage: string;
  // المشاركون
  participants: StageParticipantItem[];
  showAdvanced: boolean;
  // التوجيه والتشعيب
  targetMode: "auto" | "custom";
  customTargets: string[];

  // ── الميزات المتقدمة الجديدة ──
  // تخصيص الأزرار
  customActionsEnabled: boolean;
  actions: StageActionItem[];
  // شروط الجاهزية المنطقية
  conditions: StageConditionItem[];
  // الموعد الأسبوعي الثابت للإقفال
  hasDeadline: boolean;
  deadlineTime: string;
  deadlineDays: number[];
  deadlineAction: DeadlineAction;
}

function createEmptyStage(index: number, defaultRoleId = ""): PipelineStageItem {
  return {
    id: `stage_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
    name: index === 0 ? "مرحلة البداية" : `المرحلة ${index + 1}`,
    stageKey: `stage_${index + 1}`,
    slaHours: 24,
    slaMinutes: 0,
    completionPolicy: "all",
    quorumCount: 2,
    joinPolicy: "none",
    claimPolicy: "none",
    requiresReceive: false,
    isProgramManager: false,
    isArchive: false, // لا تفعَّل أبداً كأرشفة للمرحلة الأولى
    returnHours: 0,
    returnMinutes: 0,
    requiresAttachment: false,
    minAttachments: 1,
    attachmentMessage: "يرجى إرفاق المستند المطلوب قبل الاعتماد",
    participants: [
      {
        id: `p_${Date.now()}_1`,
        kind: index === 0 ? "requester" : "project_role",
        roleId: index === 0 ? "" : defaultRoleId,
        userId: "",
        requiresSign: false,
        isOptional: false,
        isObserver: false,
      },
    ],
    showAdvanced: false,
    targetMode: "auto",
    customTargets: [],
    customActionsEnabled: false,
    actions: [],
    conditions: [],
    hasDeadline: false,
    deadlineTime: "14:00",
    deadlineDays: [4],
    deadlineAction: "notify",
  };
}

export function WorkflowPipelineBuilder({
  isOpen,
  onClose,
  onSuccess,
  definition,
}: {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (saved: WorkflowDefinitionDto) => void;
  /** مسودّةٌ تُعدَّل بنفس طريقة البناء؛ وبغيابها يُبنى مسارٌ جديد. */
  definition?: WorkflowDefinitionDto | null;
}) {
  const editing = definition ?? null;
  const isEditing = editing !== null;

  /**
   * شروطٌ مركّبة لا يمثّلها المنشئ، فتسقط لو حُفِظت منه.
   * تُحسب مرّةً من المسودّة الواردة — لا من الحالة التي يحرّرها المستخدم.
   */
  const lostOnSave = editing === null ? [] : unrepresentableConditions(editing);
  const savePipeline = useSavePipelineWorkflow();
  const definitions = useWorkflowDefinitions();
  const roles = useRoles();
  const profiles = useProfiles();

  // فارغان عند البناء: اسمٌ جاهز يُحفَظ كما هو سهوًا، ورمزُ النوع لا يتغيّر
  const [name, setName] = useState(editing?.name ?? "");
  const [transactionType, setTransactionType] = useState(
    editing?.transactionType ?? "",
  );
  const [acceptLoss, setAcceptLoss] = useState(false);
  const [autoWireActions, setAutoWireActions] = useState(true);
  const [autoPublish, setAutoPublish] = useState(false);
  const [error, setError] = useState<string | null>(null);

  /**
   * التعديل يبدأ من المسودّة نفسها، والبناء من مرحلةٍ فارغة.
   * والتهيئة كسولةٌ لا أثرٌ جانبيّ: النافذة تُركَّب من جديد عند كل فتح.
   */
  const [stages, setStages] = useState<PipelineStageItem[]>(() =>
    editing !== null
      ? definitionToPipelineStages(editing)
      : [
          {
            id: "s_1",
            name: "إعداد المراسلة والمرفقات",
            stageKey: "drafting",
            slaHours: 24,
            slaMinutes: 0,
            completionPolicy: "all",
            quorumCount: 2,
            joinPolicy: "none",
            claimPolicy: "none",
            requiresReceive: false,
            isProgramManager: false,
            isArchive: false,
            returnHours: 0,
            returnMinutes: 0,
            requiresAttachment: false,
            minAttachments: 1,
            attachmentMessage: "",
            participants: [
              {
                id: "p_1_1",
                kind: "requester",
                roleId: "",
                userId: "",
                requiresSign: false,
                isOptional: false,
                isObserver: false,
              },
            ],
            showAdvanced: false,
            targetMode: "auto",
            customTargets: [],
            customActionsEnabled: false,
            actions: [],
            conditions: [],
            hasDeadline: false,
            deadlineTime: "14:00",
            deadlineDays: [4],
            deadlineAction: "notify",
          },
          {
            id: "s_2",
            name: "مراجعة واعتماد مدير المشروع",
            stageKey: "pm_approval",
            slaHours: 48,
            slaMinutes: 0,
            completionPolicy: "all",
            quorumCount: 2,
            joinPolicy: "none",
            claimPolicy: "none",
            requiresReceive: false,
            isProgramManager: false,
            isArchive: false,
            returnHours: 2,
            returnMinutes: 0,
            requiresAttachment: false,
            minAttachments: 1,
            attachmentMessage: "",
            participants: [
              {
                id: "p_2_1",
                kind: "project_role",
                roleId: "",
                userId: "",
                requiresSign: true,
                isOptional: false,
                isObserver: false,
              },
            ],
            showAdvanced: false,
            targetMode: "auto",
            customTargets: [],
            customActionsEnabled: false,
            actions: [],
            conditions: [],
            hasDeadline: false,
            deadlineTime: "14:00",
            deadlineDays: [4],
            deadlineAction: "notify",
          },
          {
            id: "s_3",
            name: "أرشفة وتصدير الصادر",
            stageKey: "archive_dispatch",
            slaHours: 24,
            slaMinutes: 0,
            completionPolicy: "all",
            quorumCount: 2,
            joinPolicy: "none",
            claimPolicy: "none",
            requiresReceive: false,
            isProgramManager: false,
            isArchive: true, // فقط المرحلة الأخيرة هي المؤرشفة
            returnHours: 0,
            returnMinutes: 0,
            requiresAttachment: false,
            minAttachments: 1,
            attachmentMessage: "",
            participants: [
              {
                id: "p_3_1",
                kind: "role",
                roleId: "",
                userId: "",
                requiresSign: false,
                isOptional: false,
                isObserver: false,
              },
            ],
            showAdvanced: false,
            targetMode: "auto",
            customTargets: [],
            customActionsEnabled: false,
            actions: [],
            conditions: [],
            hasDeadline: false,
            deadlineTime: "14:00",
            deadlineDays: [4],
            deadlineAction: "notify",
          },
        ],
  );

  const defaultPmId =
    roles.data?.find((r) => r.key === "project_manager")?.id ||
    roles.data?.[0]?.id ||
    "";
  const defaultAdminId =
    roles.data?.find((r) => r.key === "admin" || r.key === "program_manager")?.id ||
    roles.data?.[0]?.id ||
    defaultPmId;

  function resolveParticipantRoleId(p: StageParticipantItem): string {
    if (p.roleId) return p.roleId;
    if (p.kind === "project_role") return defaultPmId;
    if (p.kind === "role") return defaultAdminId;
    return "";
  }

  // سحب وإفلات
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);
  const [dragEnabledIndex, setDragEnabledIndex] = useState<number | null>(null);

  // المودالات المنبثقة للسياسات وتخصيص الأزرار
  const [editingPoliciesIndex, setEditingPoliciesIndex] = useState<number | null>(null);
  const [editingActionsIndex, setEditingActionsIndex] = useState<number | null>(null);

  /** تفريغ النموذج للبدء من الصفر. */
  function resetBuilder() {
    const pmId = roles.data?.find((r) => r.key === "project_manager")?.id ?? "";
    setName("");
    setTransactionType("");
    setStages([createEmptyStage(0, pmId)]);
    setError(null);
  }

  function handleAddStage(atIndex?: number) {
    const insertAt = atIndex !== undefined ? atIndex : stages.length;
    const pmId = roles.data?.find((r) => r.key === "project_manager")?.id || "";
    const newStage = createEmptyStage(insertAt, pmId);
    const updated = [...stages];
    updated.splice(insertAt, 0, newStage);
    setStages(updated);
  }

  function handleRemoveStage(index: number) {
    if (stages.length <= 1) return;
    setStages(stages.filter((_, i) => i !== index));
  }

  function handleMoveStage(fromIndex: number, toIndex: number) {
    if (toIndex < 0 || toIndex >= stages.length) return;
    const updated = [...stages];
    const moved = updated.splice(fromIndex, 1)[0];
    if (!moved) return;
    updated.splice(toIndex, 0, moved);
    setStages(updated);
  }

  function handleDragStart(e: DragEvent<HTMLDivElement>, index: number) {
    setDraggedIndex(index);
    e.dataTransfer.effectAllowed = "move";
    e.dataTransfer.setData("text/plain", String(index));
  }

  function handleDragOver(e: DragEvent<HTMLDivElement>, index: number) {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    if (dragOverIndex !== index) {
      setDragOverIndex(index);
    }
  }

  function handleDragEnd() {
    setDraggedIndex(null);
    setDragOverIndex(null);
    setDragEnabledIndex(null);
  }

  function handleDrop(e: DragEvent<HTMLDivElement>, targetIndex: number) {
    e.preventDefault();
    if (draggedIndex === null || draggedIndex === targetIndex) {
      handleDragEnd();
      return;
    }
    handleMoveStage(draggedIndex, targetIndex);
    handleDragEnd();
  }

  function updateStage(index: number, patch: Partial<PipelineStageItem>) {
    setStages((prev) =>
      prev.map((item, i) => (i === index ? { ...item, ...patch } : item)),
    );
  }

  function addParticipantToStage(stageIndex: number) {
    const stage = stages[stageIndex];
    if (!stage) return;
    const newParticipant: StageParticipantItem = {
      id: `p_${Date.now()}_${stage.participants.length + 1}`,
      kind: "project_role",
      roleId: "",
      userId: "",
      requiresSign: false,
      isOptional: false,
      isObserver: false,
    };
    updateStage(stageIndex, {
      participants: [...stage.participants, newParticipant],
    });
  }

  function updateParticipant(
    stageIndex: number,
    participantIndex: number,
    patch: Partial<StageParticipantItem>,
  ) {
    const stage = stages[stageIndex];
    if (!stage) return;
    const updatedParticipants = stage.participants.map((p, i) =>
      i === participantIndex ? { ...p, ...patch } : p,
    );
    updateStage(stageIndex, { participants: updatedParticipants });
  }

  function removeParticipant(stageIndex: number, participantIndex: number) {
    const stage = stages[stageIndex];
    if (!stage || stage.participants.length <= 1) return;
    const updatedParticipants = stage.participants.filter(
      (_, i) => i !== participantIndex,
    );
    updateStage(stageIndex, { participants: updatedParticipants });
  }

  async function handleSave() {
    setError(null);
    if (!name.trim()) {
      setError("اسم المسار مطلوب");
      return;
    }
    const cleanType = transactionType.trim();
    if (!cleanType) {
      setError("رمز نوع المعاملة مطلوب");
      return;
    }
    if (!/^[a-z][a-z0-9_]{1,31}$/.test(cleanType)) {
      setError(
        "رمز نوع المعاملة يقبل الحروف الإنجليزية الصغيرة والأرقام والشرطة السفلية _ فقط وبدون مسافات",
      );
      return;
    }

    if (lostOnSave.length > 0 && !acceptLoss) {
      setError(
        "هذه المسودّة فيها شروط مركّبة لا يمثّلها المنشئ. أقرَّ بحذفها أوّلًا، أو عدّلها من المحرِّر التفصيليّ بدل المنشئ.",
      );
      return;
    }

    // التحقق من أن رمز نوع المعاملة غير مستخدم مسبقاً في مسار آخر
    const existingDef = definitions.data?.find(
      (d) =>
        d.transactionType.toLowerCase() === cleanType.toLowerCase() &&
        d.id !== editing?.id,
    );
    if (existingDef) {
      setError(
        `رمز نوع المعاملة «${cleanType}» مستخدم بالفعل في مسار «${existingDef.name}». يرجى كتابة رمز مختلف للمعاملة.`,
      );
      return;
    }

    if (stages.length === 0) {
      setError("يجب إضافة مرحلة واحدة على الأقل في المسار");
      return;
    }

    // التحقق من صحة المراحل وعدم تكرار رموزها
    const seenStageKeys = new Map<string, number>();
    for (let i = 0; i < stages.length; i++) {
      const stageItem = stages[i];
      if (!stageItem || !stageItem.name.trim()) {
        setError(`اسم المرحلة رقم ${i + 1} مطلوب`);
        return;
      }
      const key = stageItem.stageKey.trim();
      if (!key) {
        setError(`رمز المرحلة رقم ${i + 1} («${stageItem.name}») مطلوب`);
        return;
      }
      if (!/^[a-z][a-z0-9_]{1,39}$/.test(key)) {
        setError(
          `رمز المرحلة «${stageItem.name}» غير صالح («${key}»). يجب أن يبدأ بحرف إنجليزي صغير ويحتوي فقط على حروف إنجليزية وأرقام وشرطة سفلية _ وبطول 2 إلى 40 حرفاً.`,
        );
        return;
      }
      if (seenStageKeys.has(key)) {
        const prevIdx = seenStageKeys.get(key)! + 1;
        setError(
          `رمز المرحلة «${key}» مكرر في المرحلة رقم ${prevIdx} والمرحلة رقم ${i + 1}. يجب أن يكون لكل مرحلة رمز إنجليزي فريد.`,
        );
        return;
      }
      seenStageKeys.set(key, i);
    }

    // التحقق من المشاركين في كل مرحلة وعدم ترك الدور فارغاً
    for (const stageItem of stages) {
      if (!stageItem.participants || stageItem.participants.length === 0) {
        setError(`المرحلة «${stageItem.name}» يجب أن تحتوي على مشارك واحد على الأقل`);
        return;
      }
      for (const [pIdx, p] of stageItem.participants.entries()) {
        if (p.kind === "role" || p.kind === "project_role") {
          const effectiveRoleId = resolveParticipantRoleId(p);
          if (!effectiveRoleId || effectiveRoleId.trim() === "") {
            setError(
              `يرجى اختيار الدور المطلوب للمشارك رقم ${pIdx + 1} في المرحلة «${stageItem.name}»`,
            );
            return;
          }
        }
        if (p.kind === "user") {
          if (!p.userId || p.userId.trim() === "") {
            setError(
              `يرجى اختيار الموظف المحدد للمشارك رقم ${pIdx + 1} في المرحلة «${stageItem.name}»`,
            );
            return;
          }
        }
      }
    }

    // التحقق من صحة الوجهات المخصصة إن تم تفعيلها
    for (const s of stages) {
      if (
        s.targetMode === "custom" &&
        (!s.customTargets || s.customTargets.length === 0)
      ) {
        setError(
          `المرحلة «${s.name}» في وضع التوجيه المخصص لكن لم يتم اختيار أي وجهة تالية لها. يرجى اختيار وجهة أو إرجاعها للوضع التلقائي.`,
        );
        return;
      }
      if (s.hasDeadline && s.deadlineDays.length === 0) {
        setError(
          `المرحلة «${s.name}» مفعّل بها موعد أسبوعي، يرجى تحديد يوم واحد على الأقل.`,
        );
        return;
      }

      /**
       * مرحلةٌ بلا زرٍّ يحسم تقف فيها المعاملة إلى الأبد: الشاشة لا تعرض
       * للمكلَّف ما يضغطه، و«المرحلة التالية» مخرجٌ في المحرّك لا في
       * الواجهة. يُرصد هنا قبل الحفظ، والقاعدة ترفضه عند النشر كذلك.
       */
      const usesOwnActions = s.customActionsEnabled && s.actions.length > 0;
      if (usesOwnActions) {
        if (!s.actions.some((act) => act.kind !== "note")) {
          setError(
            `كل أزرار المرحلة «${s.name}» من نوع «ملاحظة» — والملاحظة لا تحرّك المعاملة. أضِف زرّ انتقال أو إغلاق.`,
          );
          return;
        }
      } else if (!autoWireActions) {
        setError(
          `المرحلة «${s.name}» بلا أزرار: الربط التلقائي موقوف ولم تُعرَّف لها أزرار خاصة. فعّل الربط التلقائي أو أضِف أزرارًا للمرحلة.`,
        );
        return;
      }
    }

    try {
      const result = await savePipeline.mutateAsync({
        ...(isEditing ? { definitionId: editing.id } : {}),
        name: name.trim(),
        transactionType: cleanType,
        isActive: true,
        autoPublish,
        autoWireActions,
        stages: stages.map((s, idx) => {
          // حساب إجمالي الدقائق للـ SLA
          const totalSla = s.slaHours * 60 + s.slaMinutes;
          // حساب إجمالي الدقائق للإرجاع
          const totalReturn = s.returnHours * 60 + s.returnMinutes;

          const isCustomRouting =
            s.targetMode === "custom" && s.customTargets && s.customTargets.length > 0;

          // تجهيز شروط الجاهزية (مرفقات + شروط منطقية)
          const requirements = [];
          if (s.requiresAttachment) {
            requirements.push({
              kind: "attachment" as const,
              minAttachments: s.minAttachments || 1,
              message: s.attachmentMessage || "يرجى إرفاق المستند قبل الاعتماد",
              appliesTo: "advancing" as const,
            });
          }
          if (s.conditions && s.conditions.length > 0) {
            for (const cond of s.conditions) {
              const parsedCond = buildConditionFromItem(cond);
              if (parsedCond) {
                requirements.push({
                  kind: "condition" as const,
                  condition: parsedCond,
                  message: cond.message || "البيانات غير مكتملة لتحقيق هذا الشرط",
                  appliesTo: cond.appliesTo || "advancing",
                });
              }
            }
          }

          // تجهيز الأزرار المخصصة إن تم تفعيلها
          const actions =
            s.customActionsEnabled && s.actions.length > 0
              ? s.actions.map((act, aIdx) => {
                  const actTotalReturn = act.returnHours * 60 + act.returnMinutes;
                  return {
                    actionKey: (act.actionKey || `action_${aIdx + 1}`)
                      .trim()
                      .toLowerCase(),
                    label: act.label.trim(),
                    kind: act.kind,
                    sortOrder: act.sortOrder || aIdx + 1,
                    requiresNote: act.requiresNote,
                    requiresAttachment: act.requiresAttachment,
                    requiresEvaluation: act.requiresEvaluation,
                    returnMinutes: actTotalReturn > 0 ? actTotalReturn : null,
                    routes: act.routes.map((r, rIdx) => ({
                      targetStageKey: r.targetStageKey.trim().toLowerCase(),
                      priority: r.priority || (rIdx + 1) * 10,
                      condition: r.hasCondition ? buildConditionFromItem(r) : null,
                    })),
                  };
                })
              : undefined;

          // الموعد الأسبوعي
          const deadlineSpec =
            s.hasDeadline && s.deadlineTime && s.deadlineDays.length > 0
              ? {
                  time: s.deadlineTime,
                  days: [...s.deadlineDays].sort((a, b) => a - b),
                }
              : null;

          const stageInput: PipelineStageInput = {
            name: s.name.trim(),
            stageKey: s.stageKey.trim(),
            ...(isCustomRouting && s.customTargets
              ? { targetStageKeys: s.customTargets }
              : {}),
            slaMinutes: totalSla > 0 ? totalSla : null,
            // المرحلة الأولى لا تكون مرحلة أرشفة مطلقاً
            isArchive: idx > 0 && (idx === stages.length - 1 || s.isArchive),
            completionPolicy: s.completionPolicy,
            quorumCount: s.completionPolicy === "quorum" ? s.quorumCount : null,
            joinPolicy: s.joinPolicy,
            claimPolicy: s.claimPolicy,
            requiresReceive: s.requiresReceive,
            isProgramManager: s.isProgramManager,
            returnMinutes: totalReturn > 0 ? totalReturn : null,
            deadlineSpec,
            deadlineAction: s.deadlineAction,
            participants: s.participants.map((p) => {
              const effectiveRoleId = resolveParticipantRoleId(p);
              return {
                kind: p.kind,
                roleId:
                  p.kind === "role" || p.kind === "project_role"
                    ? effectiveRoleId || null
                    : null,
                userId: p.kind === "user" ? p.userId || null : null,
                requiresSign: p.kind === "project_role" && p.requiresSign,
                isOptional: p.isOptional,
                isObserver: p.isObserver,
              };
            }),
            requirements,
            ...(actions ? { actions } : {}),
          };

          return stageInput;
        }),
      });

      onSuccess(result);
      onClose();
    } catch (e) {
      setError(errorMessage(e));
    }
  }

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      size="full"
      title={
        isEditing
          ? `${t.workflowAdmin.pipelineEditTitle} — ${editing.name}`
          : t.workflowAdmin.pipelineBuilderTitle
      }
      description={
        isEditing
          ? t.workflowAdmin.pipelineEditSubtitle
          : t.workflowAdmin.pipelineBuilderSubtitle
      }
      footer={
        <div className="flex w-full flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-4 text-xs">
            <div className="text-content-muted flex items-center gap-2">
              <CheckCircle2 className="text-success size-4" />
              <span>{t.workflowAdmin.autoWiringNotice}</span>
            </div>

            <label className="border-primary/30 bg-primary/5 text-primary hover:bg-primary/10 flex cursor-pointer items-center gap-2 rounded-md border px-2.5 py-1 text-xs font-semibold transition-colors">
              <input
                type="checkbox"
                checked={autoPublish}
                onChange={(e) => setAutoPublish(e.target.checked)}
                className="text-primary rounded border-gray-300"
              />
              <span>{t.workflowAdmin.publishImmediately}</span>
            </label>
          </div>

          <div className="flex items-center gap-2">
            <Button variant="ghost" onClick={onClose}>
              {t.common.cancel}
            </Button>
            <Button
              variant="primary"
              onClick={handleSave}
              isLoading={savePipeline.isPending}
              disabled={savePipeline.isPending}
              startIcon={<Sparkles aria-hidden className="size-4" />}
            >
              {isEditing
                ? autoPublish
                  ? t.workflowAdmin.saveEditsAndPublish
                  : t.workflowAdmin.saveDraftEdits
                : autoPublish
                  ? t.workflowAdmin.saveAndPublishPipeline
                  : t.workflowAdmin.saveAndGeneratePipeline}
            </Button>
          </div>
        </div>
      }
    >
      <div className="flex flex-col gap-6" dir="rtl">
        {error !== null && (
          <div
            role="alert"
            className="border-danger/30 bg-danger/10 text-danger flex items-center gap-2 rounded-lg border p-3 text-sm font-medium"
          >
            <span>{error}</span>
          </div>
        )}

        {/* ما لا يمثّله المنشئ يُقال قبل الحفظ لا بعده */}
        {lostOnSave.length > 0 && (
          <div className="border-warning/40 bg-warning-soft text-content flex flex-col gap-2 rounded-lg border p-3 text-sm">
            <span className="text-warning flex items-center gap-2 font-bold">
              <AlertTriangle aria-hidden className="size-4 shrink-0" />
              شروط مركّبة لا يمثّلها المنشئ
            </span>
            <p className="text-content-muted text-xs leading-relaxed">
              المنشئ يعرف الشرط البسيط وحده (حقل · معامل · قيمة)، والحفظ منه يُعيد بناء
              المسودّة كاملةً — فتسقط هذه الشروط. عدّلها من
              <strong> المحرِّر التفصيليّ </strong>
              إن أردت إبقاءها.
            </p>
            <ul className="text-content-muted flex list-disc flex-col gap-0.5 ps-5 text-xs">
              {lostOnSave.map((item, idx) => (
                <li key={idx}>{item}</li>
              ))}
            </ul>
            <Checkbox
              label="أوافق على حذف هذه الشروط عند الحفظ"
              checked={acceptLoss}
              onChange={(e) => setAcceptLoss(e.target.checked)}
            />
          </div>
        )}

        {/* دليل إرشادي لتوضيح التسلسل والتفرع */}
        <div className="bg-primary/5 border-primary/20 text-content flex flex-col items-start justify-between gap-3 rounded-xl border p-3.5 text-xs shadow-xs md:flex-row md:items-center">
          <div className="flex items-start gap-2.5">
            <Sparkles className="text-primary mt-0.5 size-4 shrink-0" />
            <div className="flex flex-col gap-0.5">
              <span className="text-content text-sm font-bold">
                منشئ مسارات سير العمل السريع (مع دعم التفرع والتوازي)
              </span>
              <p className="text-content-muted leading-relaxed">
                بشكل افتراضي تسير المعاملة خطياً بالتسلسل الطبيعي (
                <span className="text-content font-semibold" dir="ltr">
                  1 → 2 → 3
                </span>
                ). لتشعيب المسار (توازي أو تخطي مراحل)، يمكنك في أي مرحلة التبديل إلى
                خيار «مخصص / توازي» لاختيار وجهاتها بحرية، وضبط سياسة الالتقاء في مرحلة
                التجميع اللاحقة على{" "}
                <strong className="text-blue-600 dark:text-blue-400">
                  انتظار الجميع (wait_all)
                </strong>
                .
              </p>
            </div>
          </div>
        </div>

        {/* شريط الأدوات */}
        <section className="bg-surface-sunken border-border flex flex-wrap items-center justify-between gap-2 rounded-xl border p-3">
          <span className="text-content-muted text-xs">
            ابنِ المسار من الصفر: سمِّه، ثم أضِف مراحله ومشاركيها وأزرارها.
          </span>
          <Button
            variant="ghost"
            size="sm"
            onClick={resetBuilder}
            startIcon={<FolderPlus className="size-3.5" />}
          >
            تفريغ / البدء من الصفر
          </Button>
        </section>

        {/* بيانات المسار الأساسية */}
        <section className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <FormField label="اسم المسار" required>
            {(id) => (
              <Input
                id={id}
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="مثال: مسار مراجعة واعتماد المراسلات والمذكرات"
              />
            )}
          </FormField>

          <FormField label="رمز نوع المعاملة (معرّف إنجليزي فريد)" required>
            {(id) => (
              <Input
                id={id}
                dir="ltr"
                value={transactionType}
                onChange={(e) => setTransactionType(e.target.value.toLowerCase())}
                placeholder="مثال: subcontractor_claim"
                disabled={isEditing}
              />
            )}
          </FormField>
        </section>

        {/* شريط خط الأنابيب (Pipeline Lanes) */}
        <section className="flex flex-col gap-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <span className="text-content text-base font-bold">
                مراحل المسار المتسلسلة ({stages.length})
              </span>
              <span className="text-content-muted text-xs">
                {t.workflowAdmin.dragToReorder}
              </span>
            </div>

            <Button
              variant="secondary"
              size="sm"
              onClick={() => handleAddStage()}
              startIcon={<Plus aria-hidden className="size-4" />}
            >
              {t.workflowAdmin.addStageToEnd}
            </Button>
          </div>

          {/* المسار الأفقي للمراحل */}
          <div className="bg-surface-sunken/50 border-border relative flex items-start gap-3 overflow-x-auto rounded-xl border p-4 pb-6">
            {stages.map((stage, index) => {
              const isFirst = index === 0;
              const isLast = index === stages.length - 1;
              const isDragging = draggedIndex === index;
              const isDropTarget = dragOverIndex === index;
              const hasAdvancedConfig =
                stage.completionPolicy !== "all" ||
                stage.joinPolicy !== "none" ||
                stage.claimPolicy !== "none" ||
                stage.requiresReceive ||
                stage.requiresAttachment ||
                stage.hasDeadline ||
                stage.conditions.length > 0 ||
                stage.participants.length > 1 ||
                stage.returnHours > 0 ||
                stage.returnMinutes > 0;

              return (
                <div
                  key={stage.id}
                  className="flex shrink-0 items-start gap-3"
                  onDragOver={(e) => handleDragOver(e, index)}
                  onDrop={(e) => handleDrop(e, index)}
                >
                  {/* زر إدراج مرحلة سريعة بين مرحلتين */}
                  {index > 0 && (
                    <button
                      type="button"
                      title={t.workflowAdmin.insertStageHere}
                      onClick={() => handleAddStage(index)}
                      className="border-border bg-surface text-content-muted hover:border-primary hover:text-primary -mx-1.5 mt-36 flex size-7 shrink-0 items-center justify-center rounded-full border shadow-xs transition-all hover:scale-110"
                    >
                      <Plus className="size-3.5" />
                    </button>
                  )}

                  {/* بطاقة المرحلة */}
                  <div
                    draggable={dragEnabledIndex === index}
                    onDragStart={(e) => handleDragStart(e, index)}
                    onDragEnd={handleDragEnd}
                    className={`bg-surface relative flex w-92 flex-col gap-3 rounded-xl border p-4 shadow-xs transition-all ${
                      isDropTarget
                        ? "border-primary ring-primary/20 scale-[1.01] ring-2"
                        : "border-border hover:border-primary/40"
                    } ${isDragging ? "border-primary/60 scale-[0.99] border-dashed opacity-50" : "opacity-100"}`}
                  >
                    {/* رأس بطاقة المرحلة */}
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <div
                          className="text-content-muted hover:text-content cursor-grab p-0.5 active:cursor-grabbing"
                          title={t.workflowAdmin.dragToReorder}
                          onMouseEnter={() => setDragEnabledIndex(index)}
                          onMouseLeave={() => {
                            if (draggedIndex === null) {
                              setDragEnabledIndex(null);
                            }
                          }}
                          onMouseDown={() => setDragEnabledIndex(index)}
                        >
                          <GripVertical className="size-4" />
                        </div>

                        <span className="bg-primary/10 text-primary flex size-6 items-center justify-center rounded-full text-xs font-bold">
                          {index + 1}
                        </span>

                        <Badge tone={isFirst ? "info" : isLast ? "success" : "neutral"}>
                          {isFirst
                            ? "بداية المسار"
                            : isLast
                              ? "نهاية وأرشفة"
                              : "مرحلة مراجعة"}
                        </Badge>
                      </div>

                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          aria-label="تحريك لليمين (سابق)"
                          disabled={isFirst}
                          onClick={() => handleMoveStage(index, index - 1)}
                          className="hover:bg-surface-sunken text-content-muted rounded p-1 disabled:opacity-20"
                        >
                          <ChevronRight className="size-4" />
                        </button>
                        <button
                          type="button"
                          aria-label="تحريك لليسار (لاحق)"
                          disabled={isLast}
                          onClick={() => handleMoveStage(index, index + 1)}
                          className="hover:bg-surface-sunken text-content-muted rounded p-1 disabled:opacity-20"
                        >
                          <ChevronLeft className="size-4" />
                        </button>

                        {stages.length > 1 && (
                          <button
                            type="button"
                            aria-label="حذف المرحلة"
                            onClick={() => handleRemoveStage(index)}
                            className="hover:bg-danger/10 text-content-muted hover:text-danger rounded p-1 transition-colors"
                          >
                            <Trash2 className="size-4" />
                          </button>
                        )}
                      </div>
                    </div>

                    {/* حقل اسم المرحلة */}
                    <div className="flex flex-col gap-1">
                      <label className="text-content-muted text-xs font-medium">
                        اسم المرحلة
                      </label>
                      <Input
                        value={stage.name}
                        onChange={(e) => updateStage(index, { name: e.target.value })}
                        placeholder="اسم المرحلة"
                        className="text-sm font-semibold"
                      />
                    </div>

                    {/* رمز المرحلة (إنجليزي فريد) */}
                    <div className="flex flex-col gap-1">
                      <div className="flex items-center justify-between">
                        <label className="text-content-muted text-xs font-medium">
                          رمز المرحلة (إنجليزي فريد)
                        </label>
                        <span
                          className="text-content-muted font-mono text-[10px]"
                          dir="ltr"
                        >
                          a-z, 0-9, _
                        </span>
                      </div>
                      <Input
                        dir="ltr"
                        value={stage.stageKey}
                        onChange={(e) =>
                          updateStage(index, {
                            stageKey: e.target.value
                              .toLowerCase()
                              .replace(/[^a-z0-9_]/g, ""),
                          })
                        }
                        placeholder={`stage_${index + 1}`}
                        className="font-mono text-xs"
                      />
                    </div>

                    {/* المشاركون في المرحلة */}
                    <div className="flex flex-col gap-2">
                      <div className="flex items-center justify-between">
                        <label className="text-content-muted flex items-center gap-1 text-xs font-medium">
                          <Users className="size-3.5" />
                          <span>
                            المشاركون في المرحلة ({stage.participants.length})
                          </span>
                        </label>

                        <button
                          type="button"
                          onClick={() => addParticipantToStage(index)}
                          className="text-primary hover:text-primary-hover flex items-center gap-1 text-[11px] font-semibold"
                        >
                          <UserPlus className="size-3" />
                          <span>+ مشارك إضافي</span>
                        </button>
                      </div>

                      {stage.participants.map((p, pIdx) => {
                        const isMain = pIdx === 0;
                        return (
                          <div
                            key={p.id}
                            className="bg-surface-sunken border-border/80 flex flex-col gap-2 rounded-lg border p-2.5 text-xs"
                          >
                            <div className="flex items-center justify-between">
                              <span className="text-content font-bold">
                                {isMain
                                  ? "المشارك الرئيسي"
                                  : `مشارك إضافي (${pIdx + 1})`}
                              </span>

                              {stage.participants.length > 1 && (
                                <button
                                  type="button"
                                  onClick={() => removeParticipant(index, pIdx)}
                                  className="text-content-muted hover:text-danger"
                                  title="إزالة المشارك"
                                >
                                  <Trash2 className="size-3.5" />
                                </button>
                              )}
                            </div>

                            <Select
                              value={p.kind}
                              onChange={(e) =>
                                updateParticipant(index, pIdx, {
                                  kind: e.target.value as ParticipantKind,
                                })
                              }
                              options={[
                                {
                                  value: "requester",
                                  label: "مقدّم الطلب (صاحب المعاملة)",
                                },
                                {
                                  value: "project_role",
                                  label: "دور في المشروع (مثل مدير المشروع)",
                                },
                                {
                                  value: "role",
                                  label: "دور عام في النظام (مثل المحاسب)",
                                },
                                { value: "user", label: "موظف محدد بالاسم" },
                              ]}
                            />

                            {(p.kind === "role" || p.kind === "project_role") && (
                              <div className="flex flex-col gap-1">
                                <Select
                                  value={resolveParticipantRoleId(p)}
                                  onChange={(e) =>
                                    updateParticipant(index, pIdx, {
                                      roleId: e.target.value,
                                    })
                                  }
                                  placeholder="اختر الدور المطلوب..."
                                  className={
                                    !resolveParticipantRoleId(p)
                                      ? "border-amber-500 ring-1 ring-amber-500/30"
                                      : ""
                                  }
                                  options={(roles.data ?? []).map((r) => ({
                                    value: r.id,
                                    label: r.name,
                                  }))}
                                />
                                {!resolveParticipantRoleId(p) && (
                                  <span className="text-[10px] font-medium text-amber-600 dark:text-amber-400">
                                    * يرجى اختيار الدور المطلوب
                                  </span>
                                )}
                              </div>
                            )}

                            {p.kind === "user" && (
                              <div className="flex flex-col gap-1">
                                <Select
                                  value={p.userId}
                                  onChange={(e) =>
                                    updateParticipant(index, pIdx, {
                                      userId: e.target.value,
                                    })
                                  }
                                  placeholder="اختر الموظف..."
                                  className={
                                    !p.userId
                                      ? "border-amber-500 ring-1 ring-amber-500/30"
                                      : ""
                                  }
                                  options={(profiles.data ?? [])
                                    .filter((prof) => prof.isActive)
                                    .map((prof) => ({
                                      value: prof.id,
                                      label: prof.fullName,
                                    }))}
                                />
                                {!p.userId && (
                                  <span className="text-[10px] font-medium text-amber-600 dark:text-amber-400">
                                    * يرجى اختيار الموظف المحدد
                                  </span>
                                )}
                              </div>
                            )}

                            <div className="flex flex-wrap items-center gap-2 pt-1 text-[11px]">
                              {p.kind === "project_role" && (
                                <label className="text-content-muted flex cursor-pointer items-center gap-1.5">
                                  <input
                                    type="checkbox"
                                    checked={p.requiresSign}
                                    onChange={(e) =>
                                      updateParticipant(index, pIdx, {
                                        requiresSign: e.target.checked,
                                      })
                                    }
                                    className="text-primary rounded border-gray-300"
                                  />
                                  <span>توقيع رقمي</span>
                                </label>
                              )}

                              {!isMain && (
                                <label className="text-content-muted flex cursor-pointer items-center gap-1.5">
                                  <input
                                    type="checkbox"
                                    checked={p.isOptional}
                                    onChange={(e) =>
                                      updateParticipant(index, pIdx, {
                                        isOptional: e.target.checked,
                                      })
                                    }
                                    className="text-primary rounded border-gray-300"
                                  />
                                  <span>مشارك اختياري</span>
                                </label>
                              )}

                              <label className="text-content-muted flex cursor-pointer items-center gap-1.5">
                                <input
                                  type="checkbox"
                                  checked={p.isObserver}
                                  onChange={(e) =>
                                    updateParticipant(index, pIdx, {
                                      isObserver: e.target.checked,
                                    })
                                  }
                                  className="text-primary rounded border-gray-300"
                                />
                                <span>مراقب (اطلاع فقط)</span>
                              </label>
                            </div>
                          </div>
                        );
                      })}
                    </div>

                    {/* المهلة الزمنية المحددة بالساعات والدقائق */}
                    <div className="flex flex-col gap-1.5">
                      <label className="text-content-muted flex items-center justify-between text-xs font-medium">
                        <span className="flex items-center gap-1">
                          <Clock className="text-primary size-3.5" />
                          <span>المهلة المحددة للإنجاز:</span>
                        </span>
                        {(stage.slaHours > 0 || stage.slaMinutes > 0) && (
                          <span className="text-primary font-mono text-[11px] font-bold">
                            {stage.slaHours > 0 ? `${stage.slaHours} س ` : ""}
                            {stage.slaMinutes > 0 ? `${stage.slaMinutes} د` : ""}
                          </span>
                        )}
                      </label>

                      <div className="grid grid-cols-2 gap-2">
                        <div className="bg-surface-sunken border-border/80 flex items-center gap-1.5 rounded-lg border px-2 py-1">
                          <Input
                            type="number"
                            min="0"
                            value={stage.slaHours === 0 ? "" : stage.slaHours}
                            onChange={(e) =>
                              updateStage(index, {
                                slaHours: Math.max(0, Number(e.target.value)),
                              })
                            }
                            placeholder="0"
                            className="text-center font-bold"
                          />
                          <span className="text-content-muted shrink-0 text-xs">
                            ساعة
                          </span>
                        </div>

                        <div className="bg-surface-sunken border-border/80 flex items-center gap-1.5 rounded-lg border px-2 py-1">
                          <Input
                            type="number"
                            min="0"
                            max="59"
                            value={stage.slaMinutes === 0 ? "" : stage.slaMinutes}
                            onChange={(e) =>
                              updateStage(index, {
                                slaMinutes: Math.max(
                                  0,
                                  Math.min(59, Number(e.target.value)),
                                ),
                              })
                            }
                            placeholder="0"
                            className="text-center font-bold"
                          />
                          <span className="text-content-muted shrink-0 text-xs">
                            دقيقة
                          </span>
                        </div>
                      </div>

                      {/* أزرار سريعة شائعة لملء الساعات */}
                      <div className="flex flex-wrap items-center gap-1 pt-0.5">
                        {[
                          { label: "12 س", h: 12, m: 0 },
                          { label: "24 س (يوم)", h: 24, m: 0 },
                          { label: "48 س (يومان)", h: 48, m: 0 },
                          { label: "72 س (3 أيام)", h: 72, m: 0 },
                        ].map((preset) => (
                          <button
                            key={preset.label}
                            type="button"
                            onClick={() =>
                              updateStage(index, {
                                slaHours: preset.h,
                                slaMinutes: preset.m,
                              })
                            }
                            className="border-border bg-surface hover:border-primary hover:text-primary rounded border px-2 py-0.5 text-[11px] transition-colors"
                          >
                            {preset.label}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* خيار سياسة الالتقاء والتجميع wait_all إن كان مفعلاً */}
                    {stage.joinPolicy === "wait_all" && (
                      <div className="flex items-center gap-2 rounded-lg border border-blue-300 bg-blue-50 px-2.5 py-1.5 text-xs font-medium text-blue-950 shadow-xs dark:border-blue-700/80 dark:bg-blue-950/60 dark:text-blue-100">
                        <Layers className="size-4 shrink-0 text-blue-700 dark:text-blue-300" />
                        <span>
                          محطة تجميع (wait_all): تنتظر اكتمال كافة الفروع السابقة قبل
                          الفتح
                        </span>
                      </div>
                    )}

                    {/* قسم المرحلة التالية والتوجيه - بتصميم راديو بارز وواضح جداً */}
                    <div className="bg-surface-sunken border-border/80 flex flex-col gap-2.5 rounded-lg border p-3 text-xs">
                      <div className="flex items-center justify-between">
                        <label className="text-content flex items-center gap-1.5 text-xs font-bold">
                          <ArrowLeft className="text-primary size-3.5" />
                          <span>المرحلة التالية بعد الاعتماد:</span>
                        </label>
                        {isLast && (
                          <span className="text-success flex items-center gap-1 text-[11px] font-bold">
                            <CheckCircle2 className="size-3.5" />
                            نهاية المسار
                          </span>
                        )}
                      </div>

                      {isLast ? (
                        <div className="text-content-muted bg-surface border-border/60 flex items-center gap-2 rounded-lg border p-2.5 text-xs">
                          <CheckCircle2 className="text-success size-4 shrink-0" />
                          <div>
                            <span className="text-content block font-bold">
                              المرحلة الختامية: اعتماد وأرشفة المعاملة
                            </span>
                            <span className="text-content-muted text-[11px]">
                              تُغلق المعاملة بعد اعتماد هذه المرحلة وتنتهي دورة سير
                              العمل.
                            </span>
                          </div>
                        </div>
                      ) : (
                        <div className="flex flex-col gap-2">
                          {/* مفتاح التبديل البارز والواضح: تلقائي vs مخصص */}
                          <div className="bg-surface border-border grid grid-cols-2 gap-2 rounded-lg border p-1">
                            {/* الخيار 1: خطي تلقائي */}
                            <button
                              type="button"
                              onClick={() => updateStage(index, { targetMode: "auto" })}
                              className={`flex items-center justify-center gap-2 rounded-md px-2 py-2 text-xs font-bold transition-all ${
                                stage.targetMode === "auto"
                                  ? "bg-primary ring-primary text-white shadow-xs ring-1"
                                  : "text-content-muted hover:text-content hover:bg-surface-sunken"
                              }`}
                            >
                              <div
                                className={`flex size-3.5 items-center justify-center rounded-full border ${stage.targetMode === "auto" ? "border-white" : "border-border"}`}
                              >
                                {stage.targetMode === "auto" && (
                                  <div className="size-1.5 rounded-full bg-white" />
                                )}
                              </div>
                              <CornerDownLeft className="size-3.5 shrink-0" />
                              <span>تلقائي (المرحلة التالية)</span>
                            </button>

                            {/* الخيار 2: مخصص وتوازي */}
                            <button
                              type="button"
                              onClick={() => {
                                const defaultTarget = stages[index + 1]?.stageKey || "";
                                updateStage(index, {
                                  targetMode: "custom",
                                  customTargets:
                                    stage.customTargets.length > 0
                                      ? stage.customTargets
                                      : defaultTarget
                                        ? [defaultTarget]
                                        : [],
                                });
                              }}
                              className={`flex items-center justify-center gap-2 rounded-md px-2 py-2 text-xs font-bold transition-all ${
                                stage.targetMode === "custom"
                                  ? "bg-amber-600 text-white shadow-xs ring-1 ring-amber-600"
                                  : "text-content-muted hover:text-content hover:bg-surface-sunken"
                              }`}
                            >
                              <div
                                className={`flex size-3.5 items-center justify-center rounded-full border ${stage.targetMode === "custom" ? "border-white" : "border-border"}`}
                              >
                                {stage.targetMode === "custom" && (
                                  <div className="size-1.5 rounded-full bg-white" />
                                )}
                              </div>
                              <GitFork className="size-3.5 shrink-0" />
                              <span>مخصص / تفرع متوازي</span>
                            </button>
                          </div>

                          {/* الشرح والمعاينة للوضع المختار */}
                          {stage.targetMode === "auto" ? (
                            <div className="bg-surface border-primary/20 bg-primary/5 flex items-center justify-between gap-2 rounded-lg border p-2.5 text-xs">
                              <div className="flex items-center gap-2">
                                <span className="text-content-muted">
                                  الوجهة التلقائية بعد الاعتماد:
                                </span>
                                <span className="text-primary flex items-center gap-1.5 font-bold">
                                  <span>
                                    {stages[index + 1]?.name || `المرحلة ${index + 2}`}
                                  </span>
                                  <span
                                    className="text-content-muted font-mono text-[11px] font-normal"
                                    dir="ltr"
                                  >
                                    ({stages[index + 1]?.stageKey})
                                  </span>
                                </span>
                              </div>
                              <Badge tone="info">خطي متسلسل</Badge>
                            </div>
                          ) : (
                            <div className="bg-surface flex flex-col gap-2 rounded-lg border border-amber-500/30 p-2.5">
                              <div className="flex items-center justify-between">
                                <span className="text-content text-[11px] font-medium">
                                  اختر المرحلة (أو المراحل) التي تنتقل إليها المعاملة:
                                </span>
                                {stage.customTargets.length > 1 && (
                                  <Badge tone="warning">
                                    تفرع متوازي ({stage.customTargets.length})
                                  </Badge>
                                )}
                              </div>

                              <div className="grid max-h-36 grid-cols-1 gap-1 overflow-y-auto">
                                {stages
                                  .filter((_, otherIdx) => otherIdx !== index)
                                  .map((otherStage, otherIdx) => {
                                    const isChecked = stage.customTargets.includes(
                                      otherStage.stageKey,
                                    );
                                    return (
                                      <label
                                        key={otherStage.id || otherIdx}
                                        className={`flex cursor-pointer items-center justify-between rounded-md border p-1.5 text-[11px] transition-all ${
                                          isChecked
                                            ? "border-amber-500/60 bg-amber-500/10 font-bold text-amber-900 dark:text-amber-200"
                                            : "border-border bg-surface-sunken text-content hover:bg-surface"
                                        }`}
                                      >
                                        <div className="flex items-center gap-2">
                                          <input
                                            type="checkbox"
                                            checked={isChecked}
                                            onChange={(e) => {
                                              const nextTargets = e.target.checked
                                                ? [
                                                    ...stage.customTargets,
                                                    otherStage.stageKey,
                                                  ]
                                                : stage.customTargets.filter(
                                                    (k) => k !== otherStage.stageKey,
                                                  );
                                              updateStage(index, {
                                                customTargets: nextTargets,
                                              });
                                            }}
                                            className="rounded border-gray-300 text-amber-600"
                                          />
                                          <span>
                                            {otherStage.name ||
                                              `مرحلة ${otherStage.stageKey}`}
                                          </span>
                                        </div>
                                        <span
                                          className="text-content-muted font-mono text-[10px]"
                                          dir="ltr"
                                        >
                                          {otherStage.stageKey}
                                        </span>
                                      </label>
                                    );
                                  })}
                              </div>

                              {stage.customTargets.length > 1 && (
                                <p className="rounded bg-amber-500/10 p-1.5 text-[11px] leading-relaxed text-amber-800 dark:text-amber-200">
                                  <strong>تفرع متوازي:</strong> ستسير هذه المراحل معاً
                                  في نفس الوقت، ويمكن ضبط مرحلة لاحقة لتكون محطة تجميع
                                  (wait_all).
                                </p>
                              )}

                              {stage.customTargets.length === 0 && (
                                <span className="text-danger text-[10px] font-medium">
                                  * يرجى اختيار مرحلة تالية واحدة على الأقل
                                </span>
                              )}
                            </div>
                          )}
                        </div>
                      )}
                    </div>

                    {/* أزرار فتح مودالات السياسات المتقدمة وتخصيص الأزرار */}
                    <div className="border-border/60 grid grid-cols-1 gap-2 border-t pt-1 sm:grid-cols-2">
                      {/* زر فتح مودال السياسات المتقدمة */}
                      <button
                        type="button"
                        onClick={() => setEditingPoliciesIndex(index)}
                        className={`flex flex-col gap-1.5 rounded-lg border p-2.5 text-right transition-all hover:shadow-xs ${
                          hasAdvancedConfig
                            ? "border-primary/40 bg-primary/5 hover:border-primary"
                            : "border-border bg-surface hover:bg-surface-sunken"
                        }`}
                      >
                        <div className="flex w-full items-center justify-between">
                          <span className="text-content flex items-center gap-1.5 text-xs font-bold">
                            <Sliders className="text-primary size-3.5" />
                            <span>الخيارات والسياسات المتقدمة</span>
                          </span>
                          <span className="text-primary text-[10px] font-semibold underline">
                            تعديل
                          </span>
                        </div>

                        {/* شارات الحالة المباشرة */}
                        <div className="flex flex-wrap items-center gap-1 text-[10px]">
                          {stage.completionPolicy !== "all" && (
                            <Badge tone="info">
                              {stage.completionPolicy === "any"
                                ? "أوّلهم"
                                : `نصاب (${stage.quorumCount})`}
                            </Badge>
                          )}
                          {stage.joinPolicy === "wait_all" && (
                            <Badge tone="neutral">انتظار الجميع</Badge>
                          )}
                          {stage.hasDeadline && (
                            <Badge tone="warning">موعد أسبوعي</Badge>
                          )}
                          {(stage.conditions.length > 0 ||
                            stage.requiresAttachment) && (
                            <Badge tone="success">
                              {stage.conditions.length > 0
                                ? `${stage.conditions.length} شروط`
                                : "مرفق إلزامي"}
                            </Badge>
                          )}
                          {!hasAdvancedConfig && (
                            <span className="text-content-muted text-[11px]">
                              السياسات الافتراضية القياسية
                            </span>
                          )}
                        </div>
                      </button>

                      {/* زر فتح مودال تخصيص الأزرار والمسارات */}
                      <button
                        type="button"
                        onClick={() => setEditingActionsIndex(index)}
                        className={`flex flex-col gap-1.5 rounded-lg border p-2.5 text-right transition-all hover:shadow-xs ${
                          stage.customActionsEnabled
                            ? "border-amber-500/40 bg-amber-500/5 hover:border-amber-500"
                            : "border-border bg-surface hover:bg-surface-sunken"
                        }`}
                      >
                        <div className="flex w-full items-center justify-between">
                          <span className="text-content flex items-center gap-1.5 text-xs font-bold">
                            <Route className="size-3.5 text-amber-600 dark:text-amber-400" />
                            <span>تخصيص الأزرار والمسارات</span>
                          </span>
                          <span className="text-[10px] font-semibold text-amber-600 underline dark:text-amber-400">
                            تعديل
                          </span>
                        </div>

                        {/* شارات حالة الأزرار */}
                        <div className="flex flex-wrap items-center gap-1 text-[10px]">
                          {stage.customActionsEnabled ? (
                            <Badge tone="warning">
                              مخصص ({stage.actions.length} أزرار)
                            </Badge>
                          ) : (
                            <span className="text-content-muted text-[11px]">
                              أزرار تلقائية (اعتماد / إرجاع / رفض)
                            </span>
                          )}
                        </div>
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}

            {/* بطاقة إضافة خطوة جديدة في النهاية */}
            <button
              type="button"
              onClick={() => handleAddStage()}
              className="hover:border-primary hover:bg-surface/80 border-border bg-surface/30 group flex w-36 shrink-0 flex-col items-center justify-center gap-2 rounded-xl border border-dashed transition-all"
              style={{ minHeight: "280px" }}
            >
              <div className="bg-surface group-hover:bg-primary group-hover:text-on-primary border-border text-content-muted flex size-10 items-center justify-center rounded-full border transition-all">
                <Plus className="size-5" />
              </div>
              <span className="text-content-muted group-hover:text-primary text-xs font-semibold">
                إضافة مرحلة
              </span>
            </button>
          </div>
        </section>

        {/* المعاينة الحية لتدفق الأزرار التلقائي */}
        <section className="bg-surface border-border flex flex-col gap-3 rounded-xl border p-4 shadow-xs">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <FileCheck className="text-success size-4" />
              <span className="text-content text-sm font-bold">
                المعاينة البصرية للتوجيه التلقائي (Auto-wiring)
              </span>
            </div>

            <label className="flex cursor-pointer items-center gap-2 text-xs font-medium">
              <input
                type="checkbox"
                checked={autoWireActions}
                onChange={(e) => setAutoWireActions(e.target.checked)}
                className="text-primary rounded border-gray-300"
              />
              <span>تفعيل الربط التلقائي للأزرار والتوجيهات</span>
            </label>
          </div>

          <div className="bg-surface-sunken flex flex-col gap-2 rounded-lg p-3 text-xs">
            <div className="flex flex-wrap items-center gap-3">
              <div className="flex items-center gap-1.5">
                <span className="size-2 rounded-full bg-emerald-500" />
                <span className="text-content font-medium">اعتماد وإرسال:</span>
                <span className="text-content-muted">
                  ينقل المعاملة للمرحلة التالية مباشرة
                </span>
              </div>

              <div className="flex items-center gap-1.5">
                <span className="size-2 rounded-full bg-rose-500" />
                <span className="text-content font-medium">إرجاع / رفض:</span>
                <span className="text-content-muted">
                  يُرجع المعاملة للمرحلة السابقة مع تدوين ملاحظة ومهلة الإرجاع المحددة
                </span>
              </div>

              <div className="flex items-center gap-1.5">
                <span className="size-2 rounded-full bg-blue-500" />
                <span className="text-content font-medium">إغلاق وأرشفة:</span>
                <span className="text-content-muted">
                  يُنهي مسار المعاملة ويحيلها للأرشيف
                </span>
              </div>
            </div>

            {/* خريطة التدفق البصري للمسار */}
            <div className="border-border/60 mt-2 flex flex-col gap-2 border-t pt-2">
              <span className="text-content text-xs font-bold">
                خريطة التدفق البصري للمسار:
              </span>
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
                {stages.map((stage, idx) => {
                  const isCustom = stage.targetMode === "custom";
                  const isLast = idx === stages.length - 1 && stage.isArchive;

                  let nextStageNames: string[];
                  if (isLast) {
                    nextStageNames = ["إغلاق وأرشفة المعاملة"];
                  } else if (isCustom) {
                    const mapped = stage.customTargets.map(
                      (k) => stages.find((st) => st.stageKey === k)?.name || k,
                    );
                    nextStageNames =
                      mapped.length > 0 ? mapped : ["(لم يتم تحديد وجهة)"];
                  } else if (idx < stages.length - 1) {
                    nextStageNames = [stages[idx + 1]?.name || `المرحلة ${idx + 2}`];
                  } else {
                    nextStageNames = ["إغلاق وأرشفة المعاملة"];
                  }

                  const isFork = nextStageNames.length > 1;

                  return (
                    <div
                      key={stage.id || idx}
                      className={`flex flex-col gap-1.5 rounded-lg border p-2 text-[11px] ${
                        isFork
                          ? "border-amber-400 bg-amber-50/80 text-amber-950 dark:border-amber-700/80 dark:bg-amber-950/40 dark:text-amber-100"
                          : stage.joinPolicy === "wait_all"
                            ? "border-blue-400 bg-blue-50/80 text-blue-950 dark:border-blue-700/80 dark:bg-blue-950/40 dark:text-blue-100"
                            : "border-border bg-surface text-content"
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="flex items-center gap-1.5 font-bold">
                          <span className="bg-primary/10 text-primary inline-flex size-4 items-center justify-center rounded-full text-[10px]">
                            {idx + 1}
                          </span>
                          <span>{stage.name || `المرحلة ${idx + 1}`}</span>
                        </span>
                        {stage.joinPolicy === "wait_all" && (
                          <Badge tone="info">wait_all</Badge>
                        )}
                        {isFork && (
                          <Badge tone="warning">
                            تفرع توازي ({nextStageNames.length})
                          </Badge>
                        )}
                      </div>

                      <div className="text-content-muted flex items-start gap-1.5 pt-0.5">
                        <ArrowLeft className="text-primary mt-0.5 size-3 shrink-0" />
                        <div className="flex flex-wrap gap-1">
                          {nextStageNames.map((n, nIdx) => (
                            <span
                              key={nIdx}
                              className={`rounded px-1.5 py-0.5 text-[10px] font-semibold ${
                                isFork
                                  ? "border border-amber-300 bg-amber-200/70 text-amber-950 dark:border-amber-700 dark:bg-amber-900/60 dark:text-amber-100"
                                  : "bg-surface-sunken text-content border-border/50 border"
                              }`}
                            >
                              {n}
                            </span>
                          ))}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </section>
      </div>

      {/* مودال الخيارات والسياسات المتقدمة للمرحلة */}
      <StageAdvancedConfigModal
        key={`policies:${editingPoliciesIndex ?? "none"}`}
        isOpen={editingPoliciesIndex !== null}
        onClose={() => setEditingPoliciesIndex(null)}
        stage={
          editingPoliciesIndex !== null ? (stages[editingPoliciesIndex] ?? null) : null
        }
        stageIndex={editingPoliciesIndex ?? 0}
        totalStages={stages.length}
        onSave={(idx, updated) => updateStage(idx, updated)}
      />

      {/* مودال تخصيص أزرار المرحلة ومساراتها الشرطية */}
      <StageCustomActionsModal
        key={`actions:${editingActionsIndex ?? "none"}`}
        isOpen={editingActionsIndex !== null}
        onClose={() => setEditingActionsIndex(null)}
        stage={
          editingActionsIndex !== null ? (stages[editingActionsIndex] ?? null) : null
        }
        stageIndex={editingActionsIndex ?? 0}
        stages={stages}
        onSave={(idx, updated) => updateStage(idx, updated)}
        createDefaultActions={createDefaultActionsForStage}
      />
    </Modal>
  );
}
