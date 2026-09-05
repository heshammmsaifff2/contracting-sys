import type { DomainError } from "@core/shared/errors/domain-error";
import { toDomainError } from "@core/shared/errors/domain-error";
import { err, ok, type Result } from "@core/shared/result";
import type {
  AssignmentStatus,
  InboxColor,
} from "@core/modules/workflow/entities/Assignment";
import type {
  CompletionPolicy,
  StageStatus,
} from "@core/modules/workflow/entities/StageInstance";
import type { TransactionStatus } from "@core/modules/workflow/entities/Transaction";
import type { ActionKind } from "@core/modules/workflow/entities/WorkflowAction";
import type { ArchiveState } from "@core/modules/workflow/entities/WorkflowGovernance";
import type {
  AvailableActionDto,
  InboxFilter,
  InboxItemDto,
  StageDto,
  TimelineEntryDto,
  TransactionBriefDto,
  TransactionDto,
} from "@application/modules/workflow/dtos";
import type { IInboxRepository } from "@application/modules/workflow/ports/inbox-repository";
import type { AppSupabaseClient } from "../client";
import { toDomainDbError } from "../errors";

/** صف عرض transaction_inbox — صفّ لكل تكليف، والعدّاد واللون محسوبان في Postgres. */
interface InboxRow {
  assignment_id: string | null;
  stage_instance_id: string | null;
  transaction_id: string | null;
  transaction_no: number | null;
  transaction_type: string | null;
  subject: string | null;
  transaction_status: string | null;
  requested_by: string | null;
  requester_name: string | null;
  project_id: string | null;
  project_name: string | null;
  seq: number | null;
  stage_key: string | null;
  stage_name: string | null;
  stage_status: string | null;
  completion_policy: string | null;
  quorum_count: number | null;
  is_archive: boolean | null;
  is_final: boolean | null;
  assignee_id: string | null;
  assignee_name: string | null;
  is_optional: boolean | null;
  allocated_minutes: number | null;
  arrived_at: string | null;
  received_at: string | null;
  completed_at: string | null;
  assignment_status: string | null;
  score: number | null;
  notes: string | null;
  manager_note: string | null;
  elapsed_minutes: number | null;
  remaining_minutes: number | null;
  elapsed_ratio: number | null;
  due_at: string | null;
  color: string | null;
  awaiting_duration: boolean | null;
  awaiting_receive: boolean | null;
  participants_count: number | null;
  stage_done_count: number | null;
  warnings_count: number | null;
  extended_minutes: number | null;
  claimed_at: string | null;
  claim_policy: string | null;
}

/** صف عرض transaction_stage_progress — تجميع المرحلة عبر مشاركيها. */
interface StageProgressRow {
  stage_instance_id: string | null;
  transaction_id: string | null;
  seq: number | null;
  stage_key: string | null;
  stage_name: string | null;
  stage_status: string | null;
  completion_policy: string | null;
  quorum_count: number | null;
  is_final: boolean | null;
  is_archive: boolean | null;
  requires_receive: boolean | null;
  entered_at: string | null;
  completed_at: string | null;
  participants_count: number | null;
  done_count: number | null;
  required_count: number | null;
  pending_count: number | null;
  awaiting_duration_count: number | null;
  avg_score: number | null;
}

const COLORS: readonly InboxColor[] = [
  "neutral",
  "info",
  "warning",
  "danger",
  "success",
];
const ASSIGNMENT_STATUSES: readonly AssignmentStatus[] = [
  "pending",
  "in_progress",
  // معلَّق بحجز زميل [المرحلة ٠٧] — يُعرَض ولا يُعمَل
  "on_hold",
  "done",
  "cancelled",
];
const ARCHIVE_STATES: readonly ArchiveState[] = ["none", "submitted", "archived"];
const STAGE_STATUSES: readonly StageStatus[] = [
  "pending",
  "in_progress",
  "done",
  "cancelled",
  "skipped",
];
const POLICIES: readonly CompletionPolicy[] = ["all", "any", "quorum"];
const ACTION_KINDS: readonly ActionKind[] = [
  "forward",
  "backward",
  "note",
  "closure",
  "final",
];

function actionKindOf(value: string | null): ActionKind {
  return ACTION_KINDS.includes(value as ActionKind) ? (value as ActionKind) : "forward";
}
const TRANSACTION_STATUSES: readonly TransactionStatus[] = [
  "in_progress",
  "awaiting_confirmation",
  "completed",
  "cancelled",
];

function stageStatusOf(value: string | null): StageStatus {
  return STAGE_STATUSES.includes(value as StageStatus)
    ? (value as StageStatus)
    : "pending";
}

function policyOf(value: string | null): CompletionPolicy {
  return POLICIES.includes(value as CompletionPolicy)
    ? (value as CompletionPolicy)
    : "all";
}

function toDto(row: InboxRow): InboxItemDto {
  return {
    assignmentId: row.assignment_id ?? "",
    stageInstanceId: row.stage_instance_id ?? "",
    transactionId: row.transaction_id ?? "",
    transactionNo: row.transaction_no ?? 0,
    transactionType: row.transaction_type ?? "",
    subject: row.subject ?? "",
    transactionStatus: TRANSACTION_STATUSES.includes(
      row.transaction_status as TransactionStatus,
    )
      ? (row.transaction_status as TransactionStatus)
      : "in_progress",
    requestedBy: row.requested_by,
    requesterName: row.requester_name,
    projectId: row.project_id,
    projectName: row.project_name,
    seq: row.seq ?? 0,
    stageKey: row.stage_key ?? "",
    stageName: row.stage_name ?? "",
    stageStatus: stageStatusOf(row.stage_status),
    completionPolicy: policyOf(row.completion_policy),
    quorumCount: row.quorum_count,
    isArchive: row.is_archive ?? false,
    isFinal: row.is_final ?? false,
    assigneeId: row.assignee_id,
    assigneeName: row.assignee_name,
    isOptional: row.is_optional ?? false,
    allocatedMinutes: row.allocated_minutes,
    arrivedAt: row.arrived_at,
    receivedAt: row.received_at,
    claimedAt: row.claimed_at,
    claimPolicy: row.claim_policy === "exclusive" ? "exclusive" : "none",
    completedAt: row.completed_at,
    assignmentStatus: ASSIGNMENT_STATUSES.includes(
      row.assignment_status as AssignmentStatus,
    )
      ? (row.assignment_status as AssignmentStatus)
      : "pending",
    score: row.score === null ? null : Number(row.score),
    notes: row.notes ?? "",
    managerNote: row.manager_note ?? "",
    elapsedMinutes: row.elapsed_minutes ?? 0,
    remainingMinutes: row.remaining_minutes,
    elapsedRatio: row.elapsed_ratio === null ? null : Number(row.elapsed_ratio),
    dueAt: row.due_at,
    color: COLORS.includes(row.color as InboxColor)
      ? (row.color as InboxColor)
      : "neutral",
    awaitingDuration: row.awaiting_duration ?? false,
    awaitingReceive: row.awaiting_receive ?? false,
    participantsCount: row.participants_count ?? 1,
    stageDoneCount: row.stage_done_count ?? 0,
    warningsCount: Number(row.warnings_count ?? 0),
    extendedMinutes: Number(row.extended_minutes ?? 0),
  };
}

export class SupabaseInboxRepository implements IInboxRepository {
  private readonly client: AppSupabaseClient;

  constructor(client: AppSupabaseClient) {
    this.client = client;
  }

  /**
   * الترتيب حسب أولوية الوصول [المراسلات 25].
   * لا فلترة صلاحيات هنا: RLS تحصر ما يراه المستخدم.
   */
  async list(
    filter: InboxFilter,
  ): Promise<Result<readonly InboxItemDto[], DomainError>> {
    try {
      let query = this.client
        .from("transaction_inbox")
        .select("*")
        .order("arrived_at", { ascending: true })
        .limit(200);

      if (filter.mineOnly === true) {
        const { data: session } = await this.client.auth.getUser();
        const userId = session.user?.id;
        if (userId === undefined) return ok([]);
        query = query.eq("assignee_id", userId);
      }

      if (filter.openOnly === true) {
        query = query.eq("assignment_status", "in_progress");
      }

      const { data, error } = await query.overrideTypes<InboxRow[]>();
      if (error) return err(toDomainDbError(error, { entity: "صندوق الوارد" }));

      return ok((data ?? []).map(toDto));
    } catch (e) {
      return err(toDomainError(e, "تعذّر قراءة صندوق الوارد"));
    }
  }

  /**
   * المعاملة بمراحلها، ولكل مرحلة مشاركوها.
   * التجميع هنا لأن المرحلة الواحدة تُرجع صفًّا لكل مكلَّف.
   */
  async findTransaction(
    id: string,
  ): Promise<Result<TransactionDto | null, DomainError>> {
    try {
      const { data: header, error: headerError } = await this.client
        .from("transactions")
        .select(
          `id, no, type, subject, entity_type, entity_id, project_id, status,
           requested_by, is_closed, closed_at, created_at,
           archive_state, archive_submitted_at, archived_at, archive_location,
           projects(name),
           profiles!transactions_requested_by_fkey(full_name),
           submitted_by:profiles!transactions_archive_submitted_by_fkey(full_name),
           archived_by_profile:profiles!transactions_archived_by_fkey(full_name)`,
        )
        .eq("id", id)
        .maybeSingle()
        .overrideTypes<{
          id: string;
          no: number;
          type: string;
          subject: string;
          entity_type: string | null;
          entity_id: string | null;
          project_id: string | null;
          status: string;
          requested_by: string | null;
          is_closed: boolean;
          closed_at: string | null;
          created_at: string;
          archive_state: string;
          archive_submitted_at: string | null;
          archived_at: string | null;
          archive_location: string;
          projects: { name: string } | null;
          profiles: { full_name: string } | null;
          submitted_by: { full_name: string } | null;
          archived_by_profile: { full_name: string } | null;
        }>();

      if (headerError)
        return err(toDomainDbError(headerError, { entity: "المعاملة", id }));
      if (header === null) return ok(null);

      const [{ data: stageRows, error: stageError }, { data: rows, error: rowsError }] =
        await Promise.all([
          this.client
            .from("transaction_stage_progress")
            .select("*")
            .eq("transaction_id", id)
            .order("seq", { ascending: true })
            .overrideTypes<StageProgressRow[]>(),
          this.client
            .from("transaction_inbox")
            .select("*")
            .eq("transaction_id", id)
            .order("seq", { ascending: true })
            .overrideTypes<InboxRow[]>(),
        ]);

      if (stageError)
        return err(toDomainDbError(stageError, { entity: "مراحل المعاملة", id }));
      if (rowsError)
        return err(toDomainDbError(rowsError, { entity: "تكليفات المعاملة", id }));

      const assignmentsByStage = new Map<string, InboxItemDto[]>();
      for (const row of rows ?? []) {
        const dto = toDto(row);
        const bucket = assignmentsByStage.get(dto.stageInstanceId);
        if (bucket === undefined) {
          assignmentsByStage.set(dto.stageInstanceId, [dto]);
        } else {
          bucket.push(dto);
        }
      }

      const stages: StageDto[] = (stageRows ?? []).map((stage) => {
        const stageInstanceId = stage.stage_instance_id ?? "";
        // السياسة لقطة على نسخة المرحلة، فتكليفاتها كلّها تحملها نفسها
        const mine = assignmentsByStage.get(stageInstanceId) ?? [];
        return {
          stageInstanceId,
          transactionId: stage.transaction_id ?? id,
          seq: stage.seq ?? 0,
          stageKey: stage.stage_key ?? "",
          stageName: stage.stage_name ?? "",
          stageStatus: stageStatusOf(stage.stage_status),
          completionPolicy: policyOf(stage.completion_policy),
          quorumCount: stage.quorum_count,
          isFinal: stage.is_final ?? false,
          isArchive: stage.is_archive ?? false,
          requiresReceive: stage.requires_receive ?? false,
          claimPolicy: mine[0]?.claimPolicy ?? "none",
          enteredAt: stage.entered_at,
          completedAt: stage.completed_at,
          participantsCount: stage.participants_count ?? 0,
          doneCount: stage.done_count ?? 0,
          requiredCount: stage.required_count ?? 0,
          pendingCount: stage.pending_count ?? 0,
          awaitingDurationCount: stage.awaiting_duration_count ?? 0,
          avgScore: stage.avg_score === null ? null : Number(stage.avg_score),
          assignments: [...mine].sort((a, b) =>
            (a.assigneeName ?? "").localeCompare(b.assigneeName ?? "", "ar"),
          ),
        };
      });

      return ok({
        id: header.id,
        no: header.no,
        type: header.type,
        subject: header.subject,
        entityType: header.entity_type,
        entityId: header.entity_id,
        projectId: header.project_id,
        projectName: header.projects?.name ?? null,
        status: TRANSACTION_STATUSES.includes(header.status as TransactionStatus)
          ? (header.status as TransactionStatus)
          : "in_progress",
        requestedBy: header.requested_by,
        requesterName: header.profiles?.full_name ?? "",
        isClosed: header.is_closed,
        closedAt: header.closed_at,
        archiveState: ARCHIVE_STATES.includes(header.archive_state as ArchiveState)
          ? (header.archive_state as ArchiveState)
          : "none",
        archiveSubmittedAt: header.archive_submitted_at,
        archiveSubmittedByName: header.submitted_by?.full_name ?? null,
        archivedAt: header.archived_at,
        archivedByName: header.archived_by_profile?.full_name ?? null,
        archiveLocation: header.archive_location ?? "",
        createdAt: header.created_at,
        stages,
      });
    } catch (e) {
      return err(toDomainError(e, "تعذّر قراءة المعاملة"));
    }
  }

  /**
   * الأزرار المتاحة على التكليفات المفتوحة.
   * RLS تحصر الصفوف؛ `mineOnly` يضيّق على تكليفاتي وحدها.
   */
  async listAvailableActions(filter: {
    transactionId?: string;
    mineOnly?: boolean;
  }): Promise<Result<readonly AvailableActionDto[], DomainError>> {
    try {
      let query = this.client
        .from("assignment_available_actions")
        .select("*")
        .order("sort_order", { ascending: true });

      if (filter.transactionId !== undefined) {
        query = query.eq("transaction_id", filter.transactionId);
      }

      if (filter.mineOnly === true) {
        const { data: session } = await this.client.auth.getUser();
        const userId = session.user?.id;
        if (userId === undefined) return ok([]);
        query = query.eq("assignee_id", userId);
      }

      const { data, error } = await query.overrideTypes<
        {
          assignment_id: string | null;
          action_id: string | null;
          action_key: string | null;
          label: string | null;
          kind: string | null;
          sort_order: number | null;
          requires_note: boolean | null;
          requires_attachment: boolean | null;
          requires_evaluation: boolean | null;
          return_minutes: number | null;
          routes_count: number | null;
          attachment_count: number | null;
        }[]
      >();

      if (error) return err(toDomainDbError(error, { entity: "إجراءات المرحلة" }));

      return ok(
        (data ?? []).map((row) => ({
          assignmentId: row.assignment_id ?? "",
          actionId: row.action_id ?? "",
          actionKey: row.action_key ?? "",
          label: row.label ?? "",
          kind: actionKindOf(row.kind),
          sortOrder: row.sort_order ?? 1,
          requiresNote: row.requires_note ?? false,
          requiresAttachment: row.requires_attachment ?? false,
          requiresEvaluation: row.requires_evaluation ?? false,
          returnMinutes: row.return_minutes,
          routesCount: Number(row.routes_count ?? 0),
          attachmentCount: Number(row.attachment_count ?? 0),
          unmetRequirements: row.unmet_requirements ?? [],
        })),
      );
    } catch (e) {
      return err(toDomainError(e, "تعذّر قراءة إجراءات المرحلة"));
    }
  }

  /** الخطّ الزمني — بما فيه الملاحظات التي لم تحرّك مرحلة. */
  async listTimeline(
    transactionId: string,
  ): Promise<Result<readonly TimelineEntryDto[], DomainError>> {
    try {
      const { data, error } = await this.client
        .from("transaction_timeline")
        .select("*")
        .eq("transaction_id", transactionId)
        .order("acted_at", { ascending: true })
        .overrideTypes<
          {
            id: string | null;
            transaction_id: string | null;
            stage_instance_id: string | null;
            seq: number | null;
            stage_name: string | null;
            action_key: string | null;
            action_label: string | null;
            kind: string | null;
            notes: string | null;
            acted_by: string | null;
            acted_by_name: string | null;
            acted_at: string | null;
          }[]
        >();

      if (error)
        return err(
          toDomainDbError(error, { entity: "الخط الزمني", id: transactionId }),
        );

      return ok(
        (data ?? []).map((row) => ({
          id: row.id ?? "",
          transactionId: row.transaction_id ?? transactionId,
          stageInstanceId: row.stage_instance_id,
          seq: row.seq,
          stageName: row.stage_name,
          actionKey: row.action_key ?? "",
          actionLabel: row.action_label ?? "",
          kind: actionKindOf(row.kind),
          notes: row.notes ?? "",
          actedBy: row.acted_by,
          actedByName: row.acted_by_name,
          actedAt: row.acted_at ?? "",
        })),
      );
    } catch (e) {
      return err(toDomainError(e, "تعذّر قراءة الخط الزمني"));
    }
  }

  /** بحث مختصر — الدالة في Postgres تحجب التفاصيل عن غير الموقّعين. */
  async searchBrief(
    query: string,
  ): Promise<Result<readonly TransactionBriefDto[], DomainError>> {
    try {
      const { data, error } = await this.client.rpc("search_transactions_brief", {
        p_query: query,
      });

      if (error) return err(toDomainDbError(error, { entity: "بحث المعاملات" }));

      return ok(
        (data ?? []).map((row) => ({
          transactionNo: row.transaction_no,
          transactionType: row.transaction_type,
          status: row.status,
          createdAt: row.created_at,
          isParticipant: row.is_participant,
        })),
      );
    } catch (e) {
      return err(toDomainError(e, "تعذّر البحث في المعاملات"));
    }
  }
}
