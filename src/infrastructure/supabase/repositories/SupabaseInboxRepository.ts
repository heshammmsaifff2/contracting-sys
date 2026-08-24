import type { DomainError } from "@core/shared/errors/domain-error";
import { toDomainError } from "@core/shared/errors/domain-error";
import { err, ok, type Result } from "@core/shared/result";
import type {
  InboxColor,
  StepStatus,
} from "@core/modules/workflow/entities/StepInstance";
import type { TransactionStatus } from "@core/modules/workflow/entities/Transaction";
import type {
  InboxFilter,
  InboxItemDto,
  TransactionBriefDto,
  TransactionDto,
} from "@application/modules/workflow/dtos";
import type { IInboxRepository } from "@application/modules/workflow/ports/inbox-repository";
import type { AppSupabaseClient } from "../client";
import { toDomainDbError } from "../errors";

/** صف عرض transaction_inbox — العدّاد واللون محسوبان في Postgres. */
interface InboxRow {
  step_instance_id: string | null;
  transaction_id: string | null;
  transaction_no: number | null;
  transaction_type: string | null;
  subject: string | null;
  transaction_status: string | null;
  requested_by: string | null;
  project_id: string | null;
  project_name: string | null;
  order_no: number | null;
  step_name: string | null;
  assignee_id: string | null;
  assignee_name: string | null;
  allocated_minutes: number | null;
  arrived_at: string | null;
  completed_at: string | null;
  step_status: string | null;
  score: number | null;
  manager_note: string | null;
  elapsed_minutes: number | null;
  remaining_minutes: number | null;
  elapsed_ratio: number | null;
  due_at: string | null;
  color: string | null;
  awaiting_duration: boolean | null;
}

const COLORS: readonly InboxColor[] = [
  "neutral",
  "info",
  "warning",
  "danger",
  "success",
];
const STEP_STATUSES: readonly StepStatus[] = [
  "pending",
  "in_progress",
  "done",
  "cancelled",
];
const TRANSACTION_STATUSES: readonly TransactionStatus[] = [
  "in_progress",
  "awaiting_confirmation",
  "completed",
  "cancelled",
];

function toDto(row: InboxRow): InboxItemDto {
  return {
    stepInstanceId: row.step_instance_id ?? "",
    transactionId: row.transaction_id ?? "",
    transactionNo: row.transaction_no ?? 0,
    transactionType: row.transaction_type ?? "",
    subject: row.subject ?? "",
    transactionStatus: TRANSACTION_STATUSES.includes(
      row.transaction_status as TransactionStatus,
    )
      ? (row.transaction_status as TransactionStatus)
      : "in_progress",
    projectId: row.project_id,
    projectName: row.project_name,
    orderNo: row.order_no ?? 0,
    stepName: row.step_name ?? "",
    assigneeId: row.assignee_id,
    assigneeName: row.assignee_name,
    allocatedMinutes: row.allocated_minutes,
    arrivedAt: row.arrived_at,
    completedAt: row.completed_at,
    stepStatus: STEP_STATUSES.includes(row.step_status as StepStatus)
      ? (row.step_status as StepStatus)
      : "pending",
    score: row.score === null ? null : Number(row.score),
    managerNote: row.manager_note ?? "",
    elapsedMinutes: row.elapsed_minutes ?? 0,
    remainingMinutes: row.remaining_minutes,
    elapsedRatio: row.elapsed_ratio === null ? null : Number(row.elapsed_ratio),
    dueAt: row.due_at,
    color: COLORS.includes(row.color as InboxColor)
      ? (row.color as InboxColor)
      : "neutral",
    awaitingDuration: row.awaiting_duration ?? false,
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
        query = query.eq("step_status", "in_progress");
      }

      const { data, error } = await query.overrideTypes<InboxRow[]>();
      if (error) return err(toDomainDbError(error, { entity: "صندوق الوارد" }));

      return ok((data ?? []).map(toDto));
    } catch (e) {
      return err(toDomainError(e, "تعذّر قراءة صندوق الوارد"));
    }
  }

  async findTransaction(
    id: string,
  ): Promise<Result<TransactionDto | null, DomainError>> {
    try {
      const { data: header, error: headerError } = await this.client
        .from("transactions")
        .select(
          "id, no, type, subject, entity_type, entity_id, project_id, status, requested_by, is_closed, closed_at, created_at, projects(name), profiles(full_name)",
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
          projects: { name: string } | null;
          profiles: { full_name: string } | null;
        }>();

      if (headerError)
        return err(toDomainDbError(headerError, { entity: "المعاملة", id }));
      if (header === null) return ok(null);

      const { data: steps, error: stepsError } = await this.client
        .from("transaction_inbox")
        .select("*")
        .eq("transaction_id", id)
        .order("order_no", { ascending: true })
        .overrideTypes<InboxRow[]>();

      if (stepsError)
        return err(toDomainDbError(stepsError, { entity: "مراحل المعاملة", id }));

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
        createdAt: header.created_at,
        steps: (steps ?? []).map(toDto),
      });
    } catch (e) {
      return err(toDomainError(e, "تعذّر قراءة المعاملة"));
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
