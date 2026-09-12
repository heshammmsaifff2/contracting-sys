import type { DomainError } from "@core/shared/errors/domain-error";
import { toDomainError, ValidationError } from "@core/shared/errors/domain-error";
import { err, ok, okVoid, type Result } from "@core/shared/result";
import type { CompletionPolicy } from "@core/modules/workflow/entities/StageInstance";
import type { ActionKind } from "@core/modules/workflow/entities/WorkflowAction";
import { actionSupportsReturnMinutes } from "@core/modules/workflow/entities/WorkflowAction";
import type { WorkflowCondition } from "@core/modules/workflow/entities/WorkflowCondition";
import type {
  ClaimPolicy,
  DefinitionStatus,
  RequirementKind,
  RequirementScope,
} from "@core/modules/workflow/entities/WorkflowGovernance";
import type {
  ConflictPolicy,
  DeadlineAction,
  DeadlineSpec,
  DurationChangeDto,
  JoinPolicy,
  ParticipantKind,
  SaveActionRouteDto,
  SavePipelineWorkflowDto,
  SaveStageParticipantDto,
  SaveStagePositionsDto,
  SaveStageRequirementDto,
  SaveWorkflowActionDto,
  SaveWorkflowDefinitionDto,
  SaveWorkflowStageDto,
  WorkflowDefinitionDto,
} from "@application/modules/workflow/dtos";
import type { IWorkflowDefinitionRepository } from "@application/modules/workflow/ports/workflow-definition-repository";
import type { Json } from "../database.types";
import type { AppSupabaseClient } from "../client";
import { toDomainDbError } from "../errors";

// `workflow_stages` تشير إلى نفسها عبر default_next_stage_id، فاسم المرحلة
// التالية يُقرأ بتضمين مُسمّى. والتلميح هنا **اسم العمود** لا اسم القيد: القيد
// الذاتي يولّد علاقتين (أب وأبناء) بالاسم نفسه، فلا يميّزهما PostgREST ويردّ
// PGRST200. العلاقات غير الذاتية تُلمَّح باسم القيد كالمعتاد.
const SELECT_WITH_STAGES = `
  id, transaction_type, name, is_active,
  version, status, lineage_id, published_at, retired_at,
  transactions(count),
  workflow_stages!workflow_stages_definition_id_fkey(
    id, definition_id, stage_key, name, sort_order,
    completion_policy, quorum_count,
    is_start, is_final, is_archive, is_program_manager, requires_receive,
    sla_minutes, default_next_stage_id, join_policy, conflict_policy, claim_policy,
    deadline_spec, deadline_action, pos_x, pos_y,
    next_stage:workflow_stages!default_next_stage_id(name),
    workflow_stage_requirements(
      id, stage_id, kind, condition, min_attachments, message, applies_to, sort_order
    ),
    workflow_stage_participants(
      id, stage_id, kind, user_id, role_id, department_id, is_optional,
      requires_sign, is_observer, sort_order,
      profiles(full_name), roles(name), departments(name)
    ),
    workflow_actions(
      id, stage_id, action_key, label, kind, sort_order,
      requires_note, requires_attachment, requires_evaluation, return_minutes,
      workflow_action_routes(
        id, action_id, priority, condition, target_stage_id,
        target:workflow_stages!workflow_action_routes_target_stage_id_fkey(name)
      )
    )
  )
`;

interface ParticipantRow {
  id: string;
  stage_id: string;
  kind: string;
  user_id: string | null;
  role_id: string | null;
  department_id: string | null;
  is_optional: boolean;
  requires_sign: boolean;
  is_observer: boolean;
  sort_order: number;
  profiles: { full_name: string } | null;
  roles: { name: string } | null;
  departments: { name: string } | null;
}

interface RouteRow {
  id: string;
  action_id: string;
  priority: number;
  condition: unknown;
  target_stage_id: string;
  target: { name: string } | null;
}

interface ActionRow {
  id: string;
  stage_id: string;
  action_key: string;
  label: string;
  kind: string;
  sort_order: number;
  requires_note: boolean;
  requires_attachment: boolean;
  requires_evaluation: boolean;
  return_minutes: number | null;
  workflow_action_routes: RouteRow[] | null;
}

interface RequirementRow {
  id: string;
  stage_id: string;
  kind: string;
  condition: unknown;
  min_attachments: number | null;
  message: string;
  applies_to: string;
  sort_order: number;
}

interface StageRow {
  id: string;
  definition_id: string;
  stage_key: string;
  name: string;
  sort_order: number;
  completion_policy: string;
  quorum_count: number | null;
  is_start: boolean;
  is_final: boolean;
  is_archive: boolean;
  is_program_manager: boolean;
  requires_receive: boolean;
  sla_minutes: number | null;
  default_next_stage_id: string | null;
  join_policy: string;
  conflict_policy: string;
  claim_policy: string;
  deadline_spec: { time?: string; days?: number[] } | null;
  deadline_action: string;
  pos_x: number | string;
  pos_y: number | string;
  next_stage: { name: string } | null;
  workflow_stage_participants: ParticipantRow[] | null;
  workflow_stage_requirements: RequirementRow[] | null;
  workflow_actions: ActionRow[] | null;
}

interface DefinitionRow {
  id: string;
  transaction_type: string;
  name: string;
  is_active: boolean;
  version: number;
  status: string;
  lineage_id: string;
  published_at: string | null;
  retired_at: string | null;
  transactions: { count: number }[] | null;
  workflow_stages: StageRow[] | null;
}

const POLICIES: readonly CompletionPolicy[] = ["all", "any", "quorum"];
const DEADLINE_ACTIONS: readonly DeadlineAction[] = ["notify", "escalate"];

/**
 * وصف الموعد يصل من القاعدة jsonb حرًّا، فيُفحَص هنا لا في الشاشة.
 * وصفٌ بلا وقت أو بلا أيام لا معنى له، فيُعامَل كأن لا موعد.
 */
function toDeadlineSpec(
  raw: { time?: string; days?: number[] } | null,
): DeadlineSpec | null {
  if (raw === null || raw === undefined) return null;
  const days = (raw.days ?? []).filter((d) => Number.isInteger(d) && d >= 0 && d <= 6);
  if (typeof raw.time !== "string" || raw.time === "" || days.length === 0) return null;
  return { time: raw.time, days };
}
const KINDS: readonly ParticipantKind[] = [
  "user",
  "role",
  "project_role",
  "department_role",
  "requester",
];
const ACTION_KINDS: readonly ActionKind[] = [
  "forward",
  "backward",
  "note",
  "closure",
  "final",
];
const JOIN_POLICIES: readonly JoinPolicy[] = ["none", "wait_all"];
const CLAIM_POLICIES: readonly ClaimPolicy[] = ["none", "exclusive"];
const DEFINITION_STATUSES: readonly DefinitionStatus[] = [
  "draft",
  "published",
  "retired",
];
const REQUIREMENT_KINDS: readonly RequirementKind[] = ["condition", "attachment"];
const REQUIREMENT_SCOPES: readonly RequirementScope[] = ["advancing", "any_action"];
const CONFLICT_POLICIES: readonly ConflictPolicy[] = [
  "backward_wins",
  "first_wins",
  "last_wins",
];

function toDto(row: DefinitionRow): WorkflowDefinitionDto {
  return {
    id: row.id,
    transactionType: row.transaction_type,
    name: row.name,
    isActive: row.is_active,
    version: row.version,
    status: DEFINITION_STATUSES.includes(row.status as DefinitionStatus)
      ? (row.status as DefinitionStatus)
      : "draft",
    lineageId: row.lineage_id,
    publishedAt: row.published_at,
    retiredAt: row.retired_at,
    // العدّاد يمرّ بـ RLS، فقد يقلّ عمّا في القاعدة لمن لا يرى كل المعاملات.
    // وهو للعرض وحده: الحارس الحقيقي في `delete_workflow_definition`.
    transactionCount: row.transactions?.[0]?.count ?? 0,
    stages: [...(row.workflow_stages ?? [])]
      .sort((a, b) => a.sort_order - b.sort_order)
      .map((stage) => ({
        id: stage.id,
        definitionId: stage.definition_id,
        stageKey: stage.stage_key,
        name: stage.name,
        sortOrder: stage.sort_order,
        completionPolicy: POLICIES.includes(stage.completion_policy as CompletionPolicy)
          ? (stage.completion_policy as CompletionPolicy)
          : "all",
        quorumCount: stage.quorum_count,
        isStart: stage.is_start,
        isFinal: stage.is_final,
        isArchive: stage.is_archive,
        isProgramManager: stage.is_program_manager,
        requiresReceive: stage.requires_receive,
        slaMinutes: stage.sla_minutes,
        defaultNextStageId: stage.default_next_stage_id,
        defaultNextStageName: stage.next_stage?.name ?? null,
        joinPolicy: JOIN_POLICIES.includes(stage.join_policy as JoinPolicy)
          ? (stage.join_policy as JoinPolicy)
          : "none",
        conflictPolicy: CONFLICT_POLICIES.includes(
          stage.conflict_policy as ConflictPolicy,
        )
          ? (stage.conflict_policy as ConflictPolicy)
          : "backward_wins",
        claimPolicy: CLAIM_POLICIES.includes(stage.claim_policy as ClaimPolicy)
          ? (stage.claim_policy as ClaimPolicy)
          : "none",
        deadlineSpec: toDeadlineSpec(stage.deadline_spec),
        deadlineAction: DEADLINE_ACTIONS.includes(
          stage.deadline_action as DeadlineAction,
        )
          ? (stage.deadline_action as DeadlineAction)
          : "notify",
        // numeric يصل نصًّا من PostgREST؛ اللوحة تحسب بالأرقام لا بالنصوص
        posX: Number(stage.pos_x) || 0,
        posY: Number(stage.pos_y) || 0,
        requirements: [...(stage.workflow_stage_requirements ?? [])]
          .sort((a, b) => a.sort_order - b.sort_order)
          .map((r) => ({
            id: r.id,
            stageId: r.stage_id,
            kind: REQUIREMENT_KINDS.includes(r.kind as RequirementKind)
              ? (r.kind as RequirementKind)
              : "condition",
            condition: (r.condition ?? null) as WorkflowCondition | null,
            minAttachments: r.min_attachments,
            message: r.message,
            appliesTo: REQUIREMENT_SCOPES.includes(r.applies_to as RequirementScope)
              ? (r.applies_to as RequirementScope)
              : "advancing",
            sortOrder: r.sort_order,
          })),
        actions: [...(stage.workflow_actions ?? [])]
          .sort((a, b) => a.sort_order - b.sort_order)
          .map((action) => ({
            id: action.id,
            stageId: action.stage_id,
            actionKey: action.action_key,
            label: action.label,
            kind: ACTION_KINDS.includes(action.kind as ActionKind)
              ? (action.kind as ActionKind)
              : "forward",
            sortOrder: action.sort_order,
            requiresNote: action.requires_note,
            requiresAttachment: action.requires_attachment,
            requiresEvaluation: action.requires_evaluation,
            returnMinutes: action.return_minutes,
            routes: [...(action.workflow_action_routes ?? [])]
              .sort((a, b) => a.priority - b.priority)
              .map((route) => ({
                id: route.id,
                actionId: route.action_id,
                priority: route.priority,
                condition: (route.condition ?? null) as WorkflowCondition | null,
                targetStageId: route.target_stage_id,
                targetStageName: route.target?.name ?? null,
              })),
          })),
        participants: [...(stage.workflow_stage_participants ?? [])]
          .sort((a, b) => a.sort_order - b.sort_order)
          .map((p) => ({
            id: p.id,
            stageId: p.stage_id,
            kind: KINDS.includes(p.kind as ParticipantKind)
              ? (p.kind as ParticipantKind)
              : "user",
            userId: p.user_id,
            userName: p.profiles?.full_name ?? null,
            roleId: p.role_id,
            roleName: p.roles?.name ?? null,
            departmentId: p.department_id,
            departmentName: p.departments?.name ?? null,
            isOptional: p.is_optional,
            requiresSign: p.requires_sign,
            isObserver: p.is_observer,
            sortOrder: p.sort_order,
          })),
      })),
  };
}

export class SupabaseWorkflowDefinitionRepository implements IWorkflowDefinitionRepository {
  private readonly client: AppSupabaseClient;

  constructor(client: AppSupabaseClient) {
    this.client = client;
  }

  async list(): Promise<Result<readonly WorkflowDefinitionDto[], DomainError>> {
    try {
      const { data, error } = await this.client
        .from("workflow_definitions")
        .select(SELECT_WITH_STAGES)
        .order("name", { ascending: true })
        .overrideTypes<DefinitionRow[]>();

      if (error) return err(toDomainDbError(error, { entity: "مسارات سير العمل" }));
      return ok((data ?? []).map(toDto));
    } catch (e) {
      return err(toDomainError(e, "تعذّر قراءة مسارات سير العمل"));
    }
  }

  async saveDefinition(
    input: SaveWorkflowDefinitionDto,
  ): Promise<Result<WorkflowDefinitionDto, DomainError>> {
    try {
      const payload = {
        transaction_type: input.transactionType,
        name: input.name,
        is_active: input.isActive,
      };

      const query =
        input.id === null
          ? this.client.from("workflow_definitions").insert(payload)
          : this.client.from("workflow_definitions").update(payload).eq("id", input.id);

      const { data, error } = await query
        .select(SELECT_WITH_STAGES)
        .single()
        .overrideTypes<DefinitionRow>();

      if (error) return err(toDomainDbError(error, { entity: "مسار سير العمل" }));
      return ok(toDto(data));
    } catch (e) {
      return err(toDomainError(e, "تعذّر حفظ مسار سير العمل"));
    }
  }

  async saveStage(input: SaveWorkflowStageDto): Promise<Result<void, DomainError>> {
    try {
      const payload = {
        definition_id: input.definitionId,
        stage_key: input.stageKey,
        name: input.name,
        sort_order: input.sortOrder,
        completion_policy: input.completionPolicy,
        quorum_count: input.quorumCount,
        is_start: input.isStart,
        is_final: input.isFinal,
        is_archive: input.isArchive,
        is_program_manager: input.isProgramManager,
        requires_receive: input.requiresReceive,
        sla_minutes: input.slaMinutes,
        default_next_stage_id: input.defaultNextStageId,
        join_policy: input.joinPolicy,
        conflict_policy: input.conflictPolicy,
        claim_policy: input.claimPolicy,
        deadline_spec:
          input.deadlineSpec === null
            ? null
            : { time: input.deadlineSpec.time, days: [...input.deadlineSpec.days] },
        deadline_action: input.deadlineAction,
      };

      const { error } =
        input.id === null
          ? await this.client.from("workflow_stages").insert(payload)
          : await this.client
              .from("workflow_stages")
              .update(payload)
              .eq("id", input.id);

      if (error) return err(toDomainDbError(error, { entity: "مرحلة سير العمل" }));
      return okVoid();
    } catch (e) {
      return err(toDomainError(e, "تعذّر حفظ المرحلة"));
    }
  }

  /**
   * مواضع العُقَد دفعةً واحدة. دالّة لا تحديثات مباشرة: سحب عشرين مرحلة
   * يعني عشرين رسالة، وكلٌّ منها تفتح **كل** أعمدة المرحلة لا عمودَي الموضع.
   */
  async saveStagePositions(
    input: SaveStagePositionsDto,
  ): Promise<Result<void, DomainError>> {
    try {
      const { error } = await this.client.rpc("set_stage_positions", {
        p_definition_id: input.definitionId,
        p_positions: input.positions.map((position) => ({
          id: position.id,
          x: position.x,
          y: position.y,
        })) as unknown as Json,
      });

      if (error) return err(toDomainDbError(error, { entity: "مواضع المراحل" }));
      return okVoid();
    } catch (e) {
      return err(toDomainError(e, "تعذّر حفظ مواضع المراحل"));
    }
  }

  /**
   * إنشاء مسار كامل عبر منشئ خطوط الأنابيب (Pipeline Builder).
   * يُنشئ المسار والمراحل والمشاركين والأزرار والتوجيهات تلقائيًا وبشكل متسلسل.
   */
  async savePipeline(
    input: SavePipelineWorkflowDto,
  ): Promise<Result<WorkflowDefinitionDto, DomainError>> {
    if (!input.name || input.name.trim().length === 0) {
      return err(new ValidationError("اسم المسار مطلوب"));
    }
    if (!input.transactionType || input.transactionType.trim().length === 0) {
      return err(new ValidationError("نوع المعاملة مطلوب"));
    }
    if (!input.stages || input.stages.length === 0) {
      return err(new ValidationError("المسار يجب أن يحتوي على مرحلة واحدة على الأقل"));
    }

    try {
      /**
       * نوعٌ له مسار بالفعل يعني **إصدارًا تاليًا** لا رفضًا.
       *
       * كان الإدراج يمضي بالإصدار ١ دائمًا، فيصطدم بالفهرس الفريد
       * (نوع المعاملة، الإصدار) ويُردّ المستخدم بعد أن بنى المسار كلّه.
       * والنظام كلّه قائم على الإصدارات: المنشور يتقاعد عند نشر تاليه،
       * ومعاملاته تكمل عليه. فيُقرأ آخر إصدار ويُبنى ما بعده، وتُورَّث
       * السلالة ليبقى الجميع إصداراتِ مسارٍ واحد لا مساراتٍ متفرّقة.
       */
      const trimmedType = input.transactionType.trim();
      const { data: siblings, error: siblingErr } = await this.client
        .from("workflow_definitions")
        .select("version, lineage_id")
        .eq("transaction_type", trimmedType)
        .order("version", { ascending: false })
        .limit(1);

      if (siblingErr) {
        return err(toDomainDbError(siblingErr, { entity: "مسار سير العمل" }));
      }

      const previous = siblings?.[0] ?? null;
      const nextVersion = (previous?.version ?? 0) + 1;

      /**
       * تعديل مسودّةٍ قائمة: تُفرَّغ مراحلها ثم تُبنى من جديد.
       *
       * وليس تحديثًا حقلًا حقلًا: المنشئ يُسلّم صورةً كاملة للمسار، ومطابقةُ
       * ما تغيّر مرحلةً مرحلةً وزرًّا زرًّا تُضاعف الشيفرة وتتباعد عن البناء.
       * وحذف المرحلة يجرّ مشاركيها وأزرارها ووجهاتها (`cascade`)، فالتفريغ
       * سطرٌ واحد. والمسودّة وحدها تُفرَّغ — والمنشور يحرسه المُشغّل المجمِّد.
       */
      const isEditingDraft =
        input.definitionId !== undefined && input.definitionId !== null;
      let definitionId: string;

      if (isEditingDraft) {
        definitionId = input.definitionId as string;

        const { error: renameErr } = await this.client
          .from("workflow_definitions")
          .update({ name: input.name.trim() })
          .eq("id", definitionId)
          .eq("status", "draft");
        if (renameErr) {
          return err(toDomainDbError(renameErr, { entity: "مسار سير العمل" }));
        }

        const { error: clearErr } = await this.client
          .from("workflow_stages")
          .delete()
          .eq("definition_id", definitionId);
        if (clearErr) {
          return err(toDomainDbError(clearErr, { entity: "مراحل المسودّة" }));
        }
      } else {
        // 1. إنشاء تعريف المسار
        const { data: defData, error: defError } = await this.client
          .from("workflow_definitions")
          .insert({
            transaction_type: trimmedType,
            name: input.name.trim(),
            is_active: input.isActive ?? true,
            version: nextVersion,
            ...(previous?.lineage_id ? { lineage_id: previous.lineage_id } : {}),
          })
          .select("id")
          .single();

        if (defError) {
          return err(toDomainDbError(defError, { entity: "مسار سير العمل" }));
        }
        definitionId = defData.id;
      }

      // التراجع يمحو ما أُنشئ، ولا يمحو مسودّةً كانت قائمة قبل التعديل
      const rollback = async () => {
        if (isEditingDraft) return;
        try {
          await this.client
            .from("workflow_definitions")
            .delete()
            .eq("id", definitionId);
        } catch {
          // ignore rollback errors
        }
      };

      // 2. إنشاء المراحل بالترتيب
      const stageIds: string[] = [];
      const stageKeyToId = new Map<string, string>();
      const stageCount = input.stages.length;

      for (let i = 0; i < stageCount; i++) {
        const s = input.stages[i];
        if (!s) continue;
        const isStart = i === 0;
        const isFinal = i === stageCount - 1;
        const stageName = s.name.trim() || `المرحلة ${i + 1}`;
        const stageKey = s.stageKey?.trim() || `stage_${i + 1}`;

        const { data: stageData, error: stageError } = await this.client
          .from("workflow_stages")
          .insert({
            definition_id: definitionId,
            stage_key: stageKey,
            name: stageName,
            sort_order: (i + 1) * 10,
            completion_policy: s.completionPolicy ?? "all",
            quorum_count: s.quorumCount ?? null,
            is_start: isStart,
            is_final: isFinal,
            /**
             * `?? true` لا يعمل: الباني يُرسل `false` صريحًا لا فراغًا، فلا
             * يقع الافتراض أبدًا. والاختيار صار خانةً ظاهرة في الباني،
             * فيُحترَم ما اختاره المؤلِّف ولا يُفترَض عنه.
             */
            is_archive: s.isArchive ?? false,
            is_program_manager: s.isProgramManager ?? false,
            requires_receive: s.requiresReceive ?? false,
            sla_minutes: s.slaMinutes ?? null,
            join_policy: s.joinPolicy ?? "none",
            conflict_policy: s.conflictPolicy ?? "backward_wins",
            claim_policy: s.claimPolicy ?? "none",
            deadline_spec: s.deadlineSpec
              ? { time: s.deadlineSpec.time, days: [...s.deadlineSpec.days] }
              : null,
            deadline_action: s.deadlineAction ?? "notify",
            pos_x: 100 + i * 280,
            pos_y: 200,
          })
          .select("id")
          .single();

        if (stageError) {
          await rollback();
          return err(toDomainDbError(stageError, { entity: "مرحلة سير العمل" }));
        }
        stageIds.push(stageData.id);
        stageKeyToId.set(stageKey.toLowerCase(), stageData.id);
      }

      // 3. ربط المرحلة التالية الافتراضية default_next_stage_id
      for (let i = 0; i < stageCount; i++) {
        const currentId = stageIds[i];
        if (!currentId) continue;
        const s = input.stages[i];
        let defaultNextId: string | null = null;
        if (s?.targetStageKeys && s.targetStageKeys.length > 0) {
          const firstTargetKey = s.targetStageKeys[0]?.trim().toLowerCase();
          if (firstTargetKey) {
            defaultNextId = stageKeyToId.get(firstTargetKey) ?? null;
          }
        } else if (i < stageIds.length - 1) {
          defaultNextId = stageIds[i + 1] ?? null;
        }

        if (defaultNextId) {
          const { error: linkError } = await this.client
            .from("workflow_stages")
            .update({ default_next_stage_id: defaultNextId })
            .eq("id", currentId);

          if (linkError) {
            await rollback();
            return err(toDomainDbError(linkError, { entity: "ربط المرحلة التالية" }));
          }
        }
      }

      // 4. تعيين المشاركين وشروط الجاهزية
      for (let i = 0; i < stageCount; i++) {
        const s = input.stages[i];
        const currentStageId = stageIds[i];
        if (!s || !currentStageId) continue;

        const participantsList =
          s.participants && s.participants.length > 0
            ? s.participants
            : [
                s.participant ?? {
                  kind: s.kind ?? "requester",
                  roleId: s.roleId ?? null,
                  userId: s.userId ?? null,
                  departmentId: s.departmentId ?? null,
                  requiresSign: s.requiresSign ?? false,
                  isObserver: s.isObserver ?? false,
                  isOptional: s.isOptional ?? false,
                },
              ];

        for (let pIdx = 0; pIdx < participantsList.length; pIdx++) {
          const p = participantsList[pIdx];
          if (!p) continue;
          const kind: ParticipantKind = p.kind ?? "requester";
          const roleId = p.roleId ?? null;
          const userId = p.userId ?? null;
          const deptId = p.departmentId ?? null;
          const requiresSign = p.requiresSign ?? false;
          const isObserver = p.isObserver ?? false;
          const isOptional = p.isOptional ?? false;

          const participantPayload = {
            stage_id: currentStageId,
            kind,
            user_id: kind === "user" ? userId : null,
            role_id:
              kind === "role" || kind === "project_role" || kind === "department_role"
                ? roleId
                : null,
            department_id: kind === "department_role" ? deptId : null,
            is_optional: isObserver ? false : isOptional,
            requires_sign: kind === "project_role" ? requiresSign : false,
            is_observer: isObserver,
            sort_order: pIdx + 1,
          };

          const { error: partError } = await this.client
            .from("workflow_stage_participants")
            .insert(participantPayload);

          if (partError) {
            await rollback();
            return err(toDomainDbError(partError, { entity: "مشارك المرحلة" }));
          }
        }

        // إدراج شروط الجاهزية (مثل اشتراط إرفاق مستندات قبل المتابعة أو شروط منطقية)
        if (s.requirements && s.requirements.length > 0) {
          for (let rIdx = 0; rIdx < s.requirements.length; rIdx++) {
            const req = s.requirements[rIdx];
            if (!req) continue;
            const { error: reqError } = await this.client
              .from("workflow_stage_requirements")
              .insert({
                stage_id: currentStageId,
                kind: req.kind,
                condition:
                  req.kind === "condition" && req.condition
                    ? (JSON.parse(JSON.stringify(req.condition)) as Json)
                    : null,
                min_attachments:
                  req.kind === "attachment" ? (req.minAttachments ?? 1) : null,
                message: req.message || "",
                applies_to: req.appliesTo ?? "advancing",
                sort_order: rIdx + 1,
              });

            if (reqError) {
              await rollback();
              return err(toDomainDbError(reqError, { entity: "شرط الجاهزية" }));
            }
          }
        }
      }

      // 5. ربط الإجراءات والمسارات
      // إذا وفّر المستخدم إجراءات مخصصة لمرحلة، تُحفظ كما هي؛ وإلا إذا كان autoWire مفعلاً، يُنفّذ الربط التلقائي القياسي
      const autoWire = input.autoWireActions !== false;

      for (let i = 0; i < stageCount; i++) {
        const s = input.stages[i];
        const currentStageId = stageIds[i];
        if (!currentStageId) continue;
        const isFinal = i === stageCount - 1;

        if (s?.actions && s.actions.length > 0) {
          // حفظ الإجراءات المخصصة المحددة من المستخدم
          for (let aIdx = 0; aIdx < s.actions.length; aIdx++) {
            const act = s.actions[aIdx];
            if (!act) continue;

            const { data: actData, error: actErr } = await this.client
              .from("workflow_actions")
              .insert({
                stage_id: currentStageId,
                action_key: (act.actionKey || `action_${aIdx + 1}`)
                  .trim()
                  .toLowerCase(),
                label: act.label.trim(),
                kind: act.kind,
                sort_order: act.sortOrder ?? aIdx + 1,
                requires_note: act.requiresNote ?? false,
                requires_attachment: act.requiresAttachment ?? false,
                requires_evaluation: act.requiresEvaluation ?? false,
                return_minutes:
                  actionSupportsReturnMinutes(act.kind) && act.returnMinutes
                    ? act.returnMinutes
                    : null,
              })
              .select("id")
              .single();

            if (actErr) {
              await rollback();
              return err(toDomainDbError(actErr, { entity: "إجراء المرحلة" }));
            }

            // مسارات هذا الإجراء إن وُجدت
            if (act.routes && act.routes.length > 0) {
              for (let rIdx = 0; rIdx < act.routes.length; rIdx++) {
                const r = act.routes[rIdx];
                if (!r) continue;
                const targetKey = r.targetStageKey.trim().toLowerCase();
                const targetId = stageKeyToId.get(targetKey);
                if (!targetId) continue;

                const { error: rErr } = await this.client
                  .from("workflow_action_routes")
                  .insert({
                    action_id: actData.id,
                    priority: r.priority ?? (rIdx + 1) * 10,
                    condition: r.condition
                      ? (JSON.parse(JSON.stringify(r.condition)) as Json)
                      : null,
                    target_stage_id: targetId,
                  });

                if (rErr) {
                  await rollback();
                  return err(toDomainDbError(rErr, { entity: "مسار الإجراء" }));
                }
              }
            }
          }
        } else if (autoWire) {
          // التوجيه التلقائي الافتراضي (Auto-wiring)
          // تحديد الوجهات التالية لهذه المرحلة
          let targetIds: string[] = [];
          if (s?.targetStageKeys && s.targetStageKeys.length > 0) {
            targetIds = s.targetStageKeys
              .map((k) => stageKeyToId.get(k.trim().toLowerCase()))
              .filter((id): id is string => Boolean(id));
          } else if (!isFinal && i < stageCount - 1) {
            const nextStageId = stageIds[i + 1];
            if (nextStageId) targetIds = [nextStageId];
          }

          if (targetIds.length > 0) {
            // زر الاعتماد والتقدم (Forward)
            const { data: forwardAction, error: fwdErr } = await this.client
              .from("workflow_actions")
              .insert({
                stage_id: currentStageId,
                action_key: "forward",
                label: "اعتماد وإرسال",
                kind: "forward",
                sort_order: 1,
                requires_note: false,
                requires_attachment: false,
                requires_evaluation: false,
                return_minutes: null,
              })
              .select("id")
              .single();

            if (fwdErr) {
              await rollback();
              return err(toDomainDbError(fwdErr, { entity: "إجراء اعتماد المرحلة" }));
            }

            // مسارات للأمام (إذا كانت وجهات متعددة، فجميعها تأخذ نفس الأولوية 1 لتشكيل تفرع متوازي)
            for (const targetId of targetIds) {
              const { error: routeErr } = await this.client
                .from("workflow_action_routes")
                .insert({
                  action_id: forwardAction.id,
                  priority: 1,
                  condition: null,
                  target_stage_id: targetId,
                });

              if (routeErr) {
                await rollback();
                return err(
                  toDomainDbError(routeErr, { entity: "مسار الإجراء للأمام" }),
                );
              }
            }
          } else {
            // زر الإغلاق والأرشفة للمرحلة النهائية
            const { error: finalErr } = await this.client
              .from("workflow_actions")
              .insert({
                stage_id: currentStageId,
                action_key: "archive",
                label: "إغلاق وأرشفة",
                kind: "final",
                sort_order: 1,
                requires_note: false,
                requires_attachment: false,
                requires_evaluation: false,
                return_minutes: null,
              });

            if (finalErr) {
              await rollback();
              return err(toDomainDbError(finalErr, { entity: "إجراء إغلاق المسار" }));
            }
          }

          // زر الإرجاع / الرفض للمراحل اللاحقة للأولى
          if (i > 0) {
            const prevStageId = stageIds[i - 1];
            if (prevStageId) {
              const { data: backwardAction, error: bwdErr } = await this.client
                .from("workflow_actions")
                .insert({
                  stage_id: currentStageId,
                  action_key: "backward",
                  label: isFinal ? "إرجاع للمراجعة" : "إرجاع / رفض",
                  kind: "backward",
                  sort_order: 2,
                  requires_note: true,
                  requires_attachment: false,
                  requires_evaluation: false,
                  return_minutes: s?.returnMinutes ?? null,
                })
                .select("id")
                .single();

              if (bwdErr) {
                await rollback();
                return err(toDomainDbError(bwdErr, { entity: "إجراء إرجاع المرحلة" }));
              }

              // مسار للخلف
              const { error: bwdRouteErr } = await this.client
                .from("workflow_action_routes")
                .insert({
                  action_id: backwardAction.id,
                  priority: 1,
                  condition: null,
                  target_stage_id: prevStageId,
                });

              if (bwdRouteErr) {
                await rollback();
                return err(
                  toDomainDbError(bwdRouteErr, { entity: "مسار الإجراء للخلف" }),
                );
              }
            }
          }

          // زر الملاحظة
          const { error: noteErr } = await this.client.from("workflow_actions").insert({
            stage_id: currentStageId,
            action_key: "note",
            label: "إضافة ملاحظة",
            kind: "note",
            sort_order: 3,
            requires_note: true,
            requires_attachment: false,
            requires_evaluation: false,
            return_minutes: null,
          });

          if (noteErr) {
            await rollback();
            return err(toDomainDbError(noteErr, { entity: "إجراء ملاحظة المرحلة" }));
          }
        }
      }

      // 6. استرجاع المسار الكامل مع جميع الكيانات التابعة
      const { data: fullDef, error: fetchErr } = await this.client
        .from("workflow_definitions")
        .select(SELECT_WITH_STAGES)
        .eq("id", definitionId)
        .single()
        .overrideTypes<DefinitionRow>();

      if (fetchErr) {
        await rollback();
        return err(toDomainDbError(fetchErr, { entity: "مسار سير العمل" }));
      }

      /**
       * 7. النشر — وفشلُه **لا يمحو ما بُني**.
       *
       * كان الفشل يستدعي التراجع فيُمسح المسار كلّه. وأخطاء النشر قابلة
       * للإصلاح كلّها («مرحلة بلا مشاركين»، «زرّ بلا وجهة»)، فمحوُ عشر
       * دقائق من البناء عقوبةٌ على خطأ مطبعيّ. تبقى مسودّةً تُصلَح وتُنشَر.
       */
      if (input.autoPublish) {
        const pubResult = await this.publishVersion(definitionId);
        if (!pubResult.ok) {
          return err(pubResult.error);
        }
        const { data: publishedDef, error: pubFetchErr } = await this.client
          .from("workflow_definitions")
          .select(SELECT_WITH_STAGES)
          .eq("id", definitionId)
          .single()
          .overrideTypes<DefinitionRow>();

        if (!pubFetchErr && publishedDef) {
          return ok(toDto(publishedDef));
        }
      }

      return ok(toDto(fullDef));
    } catch (e) {
      return err(toDomainError(e, "تعذّر حفظ مسار خط الأنابيب"));
    }
  }

  /** الحذف بدالّة: الحارس المجمِّد يمنع حذف مراحل المنشور بالمسار المباشر. */
  async removeDefinition(id: string): Promise<Result<void, DomainError>> {
    try {
      const { error } = await this.client.rpc("delete_workflow_definition", {
        p_definition_id: id,
      });
      if (error) return err(toDomainDbError(error, { entity: "المسار", id }));
      return okVoid();
    } catch (e) {
      return err(toDomainError(e, "تعذّر حذف المسار"));
    }
  }

  async removeStage(id: string): Promise<Result<void, DomainError>> {
    try {
      const { error } = await this.client.from("workflow_stages").delete().eq("id", id);
      if (error) return err(toDomainDbError(error, { entity: "المرحلة", id }));
      return okVoid();
    } catch (e) {
      return err(toDomainError(e, "تعذّر حذف المرحلة"));
    }
  }

  async saveParticipant(
    input: SaveStageParticipantDto,
  ): Promise<Result<void, DomainError>> {
    try {
      // القيد `participant_shape` في القاعدة يرفض الخلط، فنُفرغ ما لا يخصّ النوع
      const payload = {
        stage_id: input.stageId,
        kind: input.kind,
        user_id: input.kind === "user" ? input.userId : null,
        role_id:
          input.kind === "role" ||
          input.kind === "project_role" ||
          input.kind === "department_role"
            ? input.roleId
            : null,
        department_id: input.kind === "department_role" ? input.departmentId : null,
        is_optional: input.isObserver ? false : input.isOptional,
        requires_sign: input.kind === "project_role" ? input.requiresSign : false,
        is_observer: input.isObserver,
        sort_order: input.sortOrder,
      };

      const { error } =
        input.id === null
          ? await this.client.from("workflow_stage_participants").insert(payload)
          : await this.client
              .from("workflow_stage_participants")
              .update(payload)
              .eq("id", input.id);

      if (error) return err(toDomainDbError(error, { entity: "مشارك المرحلة" }));
      return okVoid();
    } catch (e) {
      return err(toDomainError(e, "تعذّر حفظ مشارك المرحلة"));
    }
  }

  async removeParticipant(id: string): Promise<Result<void, DomainError>> {
    try {
      const { error } = await this.client
        .from("workflow_stage_participants")
        .delete()
        .eq("id", id);
      if (error) return err(toDomainDbError(error, { entity: "مشارك المرحلة", id }));
      return okVoid();
    } catch (e) {
      return err(toDomainError(e, "تعذّر حذف مشارك المرحلة"));
    }
  }

  async saveAction(input: SaveWorkflowActionDto): Promise<Result<void, DomainError>> {
    try {
      const payload = {
        stage_id: input.stageId,
        action_key: input.actionKey,
        label: input.label,
        kind: input.kind,
        sort_order: input.sortOrder,
        requires_note: input.requiresNote,
        requires_attachment: input.requiresAttachment,
        requires_evaluation: input.requiresEvaluation,
        return_minutes: input.returnMinutes,
      };

      const { error } =
        input.id === null
          ? await this.client.from("workflow_actions").insert(payload)
          : await this.client
              .from("workflow_actions")
              .update(payload)
              .eq("id", input.id);

      if (error) return err(toDomainDbError(error, { entity: "إجراء المرحلة" }));
      return okVoid();
    } catch (e) {
      return err(toDomainError(e, "تعذّر حفظ الإجراء"));
    }
  }

  async removeAction(id: string): Promise<Result<void, DomainError>> {
    try {
      const { error } = await this.client
        .from("workflow_actions")
        .delete()
        .eq("id", id);
      if (error) return err(toDomainDbError(error, { entity: "الإجراء", id }));
      return okVoid();
    } catch (e) {
      return err(toDomainError(e, "تعذّر حذف الإجراء"));
    }
  }

  /**
   * وجهة مشروطة. الحارس في القاعدة يرفض الشرط المعطوب والوجهة خارج المسار
   * والزرّ الذي لا يحمل وجهة أصلًا — فرسالة الخطأ تأتي منه مفهومة.
   */
  async saveRoute(input: SaveActionRouteDto): Promise<Result<void, DomainError>> {
    try {
      const payload = {
        action_id: input.actionId,
        priority: input.priority,
        // الشرط بنية للقراءة فقط في الدومين؛ يُمرَّر كـ JSON عند الحفظ
        condition: (input.condition === null
          ? null
          : (JSON.parse(JSON.stringify(input.condition)) as Json)) as Json,
        target_stage_id: input.targetStageId,
      };

      const { error } =
        input.id === null
          ? await this.client.from("workflow_action_routes").insert(payload)
          : await this.client
              .from("workflow_action_routes")
              .update(payload)
              .eq("id", input.id);

      if (error) return err(toDomainDbError(error, { entity: "مسار الإجراء" }));
      return okVoid();
    } catch (e) {
      return err(toDomainError(e, "تعذّر حفظ المسار"));
    }
  }

  async removeRoute(id: string): Promise<Result<void, DomainError>> {
    try {
      const { error } = await this.client
        .from("workflow_action_routes")
        .delete()
        .eq("id", id);
      if (error) return err(toDomainDbError(error, { entity: "المسار", id }));
      return okVoid();
    } catch (e) {
      return err(toDomainError(e, "تعذّر حذف المسار"));
    }
  }

  async saveRequirement(
    input: SaveStageRequirementDto,
  ): Promise<Result<void, DomainError>> {
    try {
      // القيد `requirement_shape` يرفض الخلط، فنُفرغ ما لا يخصّ النوع
      const payload = {
        stage_id: input.stageId,
        kind: input.kind,
        condition:
          input.kind === "condition" && input.condition !== null
            ? (JSON.parse(JSON.stringify(input.condition)) as Json)
            : null,
        min_attachments: input.kind === "attachment" ? input.minAttachments : null,
        message: input.message,
        applies_to: input.appliesTo,
        sort_order: input.sortOrder,
      };

      const { error } =
        input.id === null
          ? await this.client.from("workflow_stage_requirements").insert(payload)
          : await this.client
              .from("workflow_stage_requirements")
              .update(payload)
              .eq("id", input.id);

      if (error) return err(toDomainDbError(error, { entity: "شرط الجاهزية" }));
      return okVoid();
    } catch (e) {
      return err(toDomainError(e, "تعذّر حفظ شرط الجاهزية"));
    }
  }

  async removeRequirement(id: string): Promise<Result<void, DomainError>> {
    try {
      const { error } = await this.client
        .from("workflow_stage_requirements")
        .delete()
        .eq("id", id);
      if (error) return err(toDomainDbError(error, { entity: "شرط الجاهزية", id }));
      return okVoid();
    } catch (e) {
      return err(toDomainError(e, "تعذّر حذف شرط الجاهزية"));
    }
  }

  /** النسخ يجري كلّه في القاعدة: ترجمة المعرّفات لا تحتمل جولةً ثانية. */
  async createDraft(definitionId: string): Promise<Result<string, DomainError>> {
    try {
      const { data, error } = await this.client.rpc("create_workflow_draft", {
        p_definition_id: definitionId,
      });
      if (error) return err(toDomainDbError(error, { entity: "مسودّة المسار" }));
      return ok(data as string);
    } catch (e) {
      return err(toDomainError(e, "تعذّر إنشاء مسودّة المسار"));
    }
  }

  async publishVersion(definitionId: string): Promise<Result<void, DomainError>> {
    try {
      const { error } = await this.client.rpc("publish_workflow_version", {
        p_definition_id: definitionId,
      });
      if (error) return err(toDomainDbError(error, { entity: "نشر المسار" }));
      return okVoid();
    } catch (e) {
      return err(toDomainError(e, "تعذّر نشر المسار"));
    }
  }

  /** تقرير المدد المعدّلة: قبل/بعد/الموظف [المراسلات 5]. */
  async listDurationChanges(): Promise<
    Result<readonly DurationChangeDto[], DomainError>
  > {
    try {
      const { data, error } = await this.client
        .from("duration_change_log")
        .select(
          // التضمينات مُسمّاة بمفاتيحها الأجنبية: بين `transaction_assignments`
          // و`profiles` علاقتان (المكلَّف، ومن تُعرض له ملاحظة المدير) فيلتبس
          // التضمين المجرّد على PostgREST فيردّه بخطأ.
          `id, assignment_id, old_minutes, new_minutes, reason, changed_at,
           profiles!duration_change_log_changed_by_fkey(full_name),
           transaction_assignments!duration_change_log_assignment_id_fkey(
             transactions(no),
             transaction_stage_instances(name),
             profiles!transaction_assignments_assignee_id_fkey(full_name)
           )`,
        )
        .order("changed_at", { ascending: false })
        .limit(200)
        .overrideTypes<
          {
            id: string;
            assignment_id: string;
            old_minutes: number | null;
            new_minutes: number;
            reason: string;
            changed_at: string;
            profiles: { full_name: string } | null;
            transaction_assignments: {
              transactions: { no: number } | null;
              transaction_stage_instances: { name: string } | null;
              profiles: { full_name: string } | null;
            } | null;
          }[]
        >();

      if (error) return err(toDomainDbError(error, { entity: "تقرير المدد" }));

      return ok(
        (data ?? []).map((row) => ({
          id: row.id,
          assignmentId: row.assignment_id,
          transactionNo: row.transaction_assignments?.transactions?.no ?? 0,
          stageName:
            row.transaction_assignments?.transaction_stage_instances?.name ?? "",
          assigneeName: row.transaction_assignments?.profiles?.full_name ?? "",
          oldMinutes: row.old_minutes,
          newMinutes: row.new_minutes,
          reason: row.reason,
          changedByName: row.profiles?.full_name ?? "",
          changedAt: row.changed_at,
        })),
      );
    } catch (e) {
      return err(toDomainError(e, "تعذّر قراءة تقرير المدد"));
    }
  }
}
