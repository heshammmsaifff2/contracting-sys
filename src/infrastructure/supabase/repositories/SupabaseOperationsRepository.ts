/**
 * أدوات التشغيل — كلّها دوال Postgres تتحقّق من الصلاحية والسبب بنفسها،
 * وتكتب في الخطّ الزمني وتُشعِر المعنيّ. لا كتابة مباشرة على جدول.
 */
import type { DomainError } from "@core/shared/errors/domain-error";
import { toDomainError } from "@core/shared/errors/domain-error";
import { err, ok, okVoid, type Result } from "@core/shared/result";
import type {
  ArchiveDecisionDto,
  ArchiveQueueItemDto,
  ExtendDeadlineDto,
  ForceCloseDto,
  MentionDto,
  SendAlertDto,
  TransferAssignmentDto,
  TransferTargetDto,
} from "@application/modules/workflow/dtos";
import type { ArchiveState } from "@core/modules/workflow/entities/WorkflowGovernance";
import type { IOperationsRepository } from "@application/modules/workflow/ports/operations-repository";
import type { AppSupabaseClient } from "../client";
import { toDomainDbError } from "../errors";

export class SupabaseOperationsRepository implements IOperationsRepository {
  private readonly client: AppSupabaseClient;

  constructor(client: AppSupabaseClient) {
    this.client = client;
  }

  async transferTargets(
    assignmentId: string,
  ): Promise<Result<readonly TransferTargetDto[], DomainError>> {
    try {
      const { data, error } = await this.client.rpc("transfer_targets", {
        p_assignment_id: assignmentId,
      });

      if (error)
        return err(
          toDomainDbError(error, { entity: "وجهات التحويل", id: assignmentId }),
        );

      return ok(
        (data ?? []).map((row) => ({
          userId: row.user_id,
          fullName: row.full_name,
        })),
      );
    } catch (e) {
      return err(toDomainError(e, "تعذّر قراءة وجهات التحويل"));
    }
  }

  async transferAssignment(
    input: TransferAssignmentDto,
  ): Promise<Result<void, DomainError>> {
    try {
      const { error } = await this.client.rpc("transfer_assignment", {
        p_assignment_id: input.assignmentId,
        p_to_user_id: input.toUserId,
        p_reason: input.reason,
      });

      if (error)
        return err(
          toDomainDbError(error, { entity: "التحويل", id: input.assignmentId }),
        );
      return okVoid();
    } catch (e) {
      return err(toDomainError(e, "تعذّر تحويل المعاملة"));
    }
  }

  async sendAlert(input: SendAlertDto): Promise<Result<void, DomainError>> {
    try {
      const { error } = await this.client.rpc("send_assignment_alert", {
        p_assignment_id: input.assignmentId,
        p_kind: input.kind,
        p_reason: input.reason,
      });

      if (error)
        return err(
          toDomainDbError(error, { entity: "التنبيه", id: input.assignmentId }),
        );
      return okVoid();
    } catch (e) {
      return err(toDomainError(e, "تعذّر إرسال التنبيه"));
    }
  }

  async extendDeadline(input: ExtendDeadlineDto): Promise<Result<void, DomainError>> {
    try {
      const { error } = await this.client.rpc("extend_assignment_deadline", {
        p_assignment_id: input.assignmentId,
        p_extra_minutes: input.extraMinutes,
        p_reason: input.reason,
      });

      if (error)
        return err(
          toDomainDbError(error, { entity: "مدّ المهلة", id: input.assignmentId }),
        );
      return okVoid();
    } catch (e) {
      return err(toDomainError(e, "تعذّر مدّ المهلة"));
    }
  }

  async forceClose(input: ForceCloseDto): Promise<Result<void, DomainError>> {
    try {
      const { error } = await this.client.rpc("force_close_transaction", {
        p_transaction_id: input.transactionId,
        p_reason: input.reason,
      });

      if (error)
        return err(
          toDomainDbError(error, { entity: "المعاملة", id: input.transactionId }),
        );
      return okVoid();
    } catch (e) {
      return err(toDomainError(e, "تعذّر الإغلاق الإجباري"));
    }
  }

  async mention(input: MentionDto): Promise<Result<{ notified: number }, DomainError>> {
    try {
      const { data, error } = await this.client.rpc("mention_in_transaction", {
        p_action_log_id: input.actionLogId,
        p_user_ids: [...input.userIds],
      });

      if (error) return err(toDomainDbError(error, { entity: "الإشارة" }));
      return ok({ notified: Number(data ?? 0) });
    } catch (e) {
      return err(toDomainError(e, "تعذّر إرسال الإشارة"));
    }
  }

  // ── حسم التكليف [المرحلة ٠٧] ──────────────────────────────────────────
  async claimAssignment(assignmentId: string): Promise<Result<void, DomainError>> {
    try {
      const { error } = await this.client.rpc("claim_assignment", {
        p_assignment_id: assignmentId,
      });
      if (error)
        return err(toDomainDbError(error, { entity: "الحجز", id: assignmentId }));
      return okVoid();
    } catch (e) {
      return err(toDomainError(e, "تعذّر حجز المعاملة"));
    }
  }

  async releaseClaim(
    assignmentId: string,
    reason: string,
  ): Promise<Result<void, DomainError>> {
    try {
      const { error } = await this.client.rpc("release_assignment_claim", {
        p_assignment_id: assignmentId,
        p_reason: reason,
      });
      if (error)
        return err(toDomainDbError(error, { entity: "الحجز", id: assignmentId }));
      return okVoid();
    } catch (e) {
      return err(toDomainError(e, "تعذّر إطلاق الحجز"));
    }
  }

  // ── الأرشفة على مرحلتين [المرحلة ٠٧] ──────────────────────────────────
  /** الطابور عرضٌ لا جدول: الترتيب بأقدم إغلاق، فما تأخّر يظهر أولًا. */
  async listArchiveQueue(): Promise<
    Result<readonly ArchiveQueueItemDto[], DomainError>
  > {
    try {
      const { data, error } = await this.client
        .from("archive_queue")
        .select("*")
        .order("closed_at", { ascending: true })
        .limit(500)
        .overrideTypes<
          {
            transaction_id: string;
            transaction_no: number;
            transaction_type: string;
            subject: string;
            project_id: string | null;
            project_name: string | null;
            closed_at: string | null;
            archive_state: string;
            archive_submitted_at: string | null;
            submitted_by_name: string | null;
            archived_at: string | null;
            archived_by_name: string | null;
            archive_location: string;
            days_since_closed: number;
          }[]
        >();

      if (error) return err(toDomainDbError(error, { entity: "طابور الأرشيف" }));

      return ok(
        (data ?? []).map((row) => ({
          transactionId: row.transaction_id,
          transactionNo: row.transaction_no,
          transactionType: row.transaction_type,
          subject: row.subject,
          projectId: row.project_id,
          projectName: row.project_name,
          closedAt: row.closed_at,
          archiveState: row.archive_state as ArchiveState,
          archiveSubmittedAt: row.archive_submitted_at,
          submittedByName: row.submitted_by_name,
          archivedAt: row.archived_at,
          archivedByName: row.archived_by_name,
          archiveLocation: row.archive_location,
          daysSinceClosed: row.days_since_closed,
        })),
      );
    } catch (e) {
      return err(toDomainError(e, "تعذّر قراءة طابور الأرشيف"));
    }
  }

  async submitOriginal(
    transactionId: string,
    notes: string,
  ): Promise<Result<void, DomainError>> {
    try {
      const { error } = await this.client.rpc("submit_transaction_original", {
        p_transaction_id: transactionId,
        p_notes: notes,
      });
      if (error)
        return err(
          toDomainDbError(error, { entity: "إيداع الأصل", id: transactionId }),
        );
      return okVoid();
    } catch (e) {
      return err(toDomainError(e, "تعذّر إيداع الأصل"));
    }
  }

  async acceptArchive(input: ArchiveDecisionDto): Promise<Result<void, DomainError>> {
    try {
      const { error } = await this.client.rpc("accept_transaction_archive", {
        p_transaction_id: input.transactionId,
        p_location: input.text,
        p_notes: input.notes ?? "",
      });
      if (error)
        return err(
          toDomainDbError(error, { entity: "الأرشفة", id: input.transactionId }),
        );
      return okVoid();
    } catch (e) {
      return err(toDomainError(e, "تعذّر قبول الأرشفة"));
    }
  }

  async rejectArchive(input: ArchiveDecisionDto): Promise<Result<void, DomainError>> {
    try {
      const { error } = await this.client.rpc("reject_transaction_archive", {
        p_transaction_id: input.transactionId,
        p_reason: input.text,
      });
      if (error)
        return err(
          toDomainDbError(error, { entity: "الأرشفة", id: input.transactionId }),
        );
      return okVoid();
    } catch (e) {
      return err(toDomainError(e, "تعذّر ردّ الإيداع"));
    }
  }
}
