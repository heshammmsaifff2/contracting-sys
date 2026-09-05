/**
 * تحقيق منفذ المحرّك: كل انتقال حالة ينادي دالة Postgres واحدة.
 * الدوال تحسب الزمن داخل الدوام، وتضع الدرجة، وتطبّق سياسة إنجاز المرحلة،
 * وتفتح ما يليها ذرّيًا، وتفحص الصلاحية بنفسها — فلا مسار جانبي يتجاوز RLS.
 *
 * ولا يوجد هنا كتابة مباشرة على جدول: الجداول للقراءة فقط من `authenticated`.
 */
import type { DomainError } from "@core/shared/errors/domain-error";
import { toDomainError } from "@core/shared/errors/domain-error";
import { err, ok, okVoid, type Result } from "@core/shared/result";
import type {
  CompleteAssignmentDto,
  SetAssignmentDurationDto,
  StartTransactionDto,
} from "@application/modules/workflow/dtos";
import type { IWorkflowEngine } from "@application/modules/workflow/ports/workflow-engine";
import type { Json } from "./database.types";
import type { AppSupabaseClient } from "./client";
import { toDomainDbError } from "./errors";

export class SupabaseWorkflowEngine implements IWorkflowEngine {
  private readonly client: AppSupabaseClient;

  constructor(client: AppSupabaseClient) {
    this.client = client;
  }

  async startTransaction(
    input: StartTransactionDto,
  ): Promise<Result<{ transactionId: string }, DomainError>> {
    try {
      // المعامل اختياري في الدالة، فنحذفه بدل تمرير null
      const { data, error } = await this.client.rpc("start_transaction", {
        p_type: input.type,
        p_subject: input.subject,
        ...(input.projectId === null ? {} : { p_project_id: input.projectId }),
        ...(input.context === undefined ? {} : { p_context: input.context as Json }),
      });

      if (error) return err(toDomainDbError(error, { entity: "المعاملة" }));
      return ok({ transactionId: data });
    } catch (e) {
      return err(toDomainError(e, "تعذّر بدء المعاملة"));
    }
  }

  /**
   * `null` في النتيجة لا يعني الفشل: الإجراء قد يكون ملاحظة لا تحرّك شيئًا،
   * أو تبقى المرحلة مفتوحة بانتظار بقيّة مشاركيها، أو تكون المعاملة انتهت.
   */
  async completeAssignment(
    input: CompleteAssignmentDto,
  ): Promise<Result<{ nextStageInstanceId: string | null }, DomainError>> {
    try {
      const { data, error } = await this.client.rpc("complete_assignment", {
        p_assignment_id: input.assignmentId,
        // المعامل اختياري في الدالة: المسارات القديمة بلا إجراءات تمرّ بلا مفتاح
        ...(input.actionKey === null ? {} : { p_action_key: input.actionKey }),
        p_notes: input.notes,
      });

      if (error)
        return err(
          toDomainDbError(error, { entity: "التكليف", id: input.assignmentId }),
        );
      return ok({ nextStageInstanceId: data ?? null });
    } catch (e) {
      return err(toDomainError(e, "تعذّر إنجاز التكليف"));
    }
  }

  async receiveAssignment(assignmentId: string): Promise<Result<void, DomainError>> {
    try {
      const { error } = await this.client.rpc("receive_assignment", {
        p_assignment_id: assignmentId,
      });

      if (error)
        return err(toDomainDbError(error, { entity: "التكليف", id: assignmentId }));
      return okVoid();
    } catch (e) {
      return err(toDomainError(e, "تعذّر استلام المعاملة"));
    }
  }

  async setAssignmentDuration(
    input: SetAssignmentDurationDto,
  ): Promise<Result<void, DomainError>> {
    try {
      const { error } = await this.client.rpc("set_assignment_duration", {
        p_assignment_id: input.assignmentId,
        p_minutes: input.minutes,
        p_scope: input.scope,
        p_reason: input.reason,
      });

      if (error)
        return err(
          toDomainDbError(error, { entity: "مدة التكليف", id: input.assignmentId }),
        );
      return okVoid();
    } catch (e) {
      return err(toDomainError(e, "تعذّر تحديد المدة"));
    }
  }

  async setTransactionContext(
    transactionId: string,
    patch: Readonly<Record<string, unknown>>,
  ): Promise<Result<void, DomainError>> {
    try {
      const { error } = await this.client.rpc("set_transaction_context", {
        p_transaction_id: transactionId,
        p_patch: patch as Json,
      });

      if (error)
        return err(
          toDomainDbError(error, { entity: "سياق المعاملة", id: transactionId }),
        );
      return okVoid();
    } catch (e) {
      return err(toDomainError(e, "تعذّر تحديث سياق المعاملة"));
    }
  }

  async closeTransaction(transactionId: string): Promise<Result<void, DomainError>> {
    try {
      const { error } = await this.client.rpc("close_transaction", {
        p_transaction_id: transactionId,
      });

      if (error)
        return err(toDomainDbError(error, { entity: "المعاملة", id: transactionId }));
      return okVoid();
    } catch (e) {
      return err(toDomainError(e, "تعذّر تأكيد الإنجاز"));
    }
  }

  async cancelTransaction(transactionId: string): Promise<Result<void, DomainError>> {
    try {
      const { error } = await this.client.rpc("cancel_transaction", {
        p_transaction_id: transactionId,
      });

      if (error)
        return err(toDomainDbError(error, { entity: "المعاملة", id: transactionId }));
      return okVoid();
    } catch (e) {
      return err(toDomainError(e, "تعذّر إلغاء المعاملة"));
    }
  }
}
