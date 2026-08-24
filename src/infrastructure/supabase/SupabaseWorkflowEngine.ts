/**
 * تحقيق منفذ المحرّك: كل انتقال حالة ينادي دالة Postgres واحدة.
 * الدوال تحسب الزمن داخل الدوام وتضع الدرجة وتفتح المرحلة التالية ذرّيًا،
 * وتفحص الصلاحية بنفسها — فلا يوجد مسار جانبي يتجاوز RLS.
 */
import type { DomainError } from "@core/shared/errors/domain-error";
import { toDomainError } from "@core/shared/errors/domain-error";
import { err, ok, okVoid, type Result } from "@core/shared/result";
import type {
  CompleteStepDto,
  SetStepDurationDto,
  StartTransactionDto,
} from "@application/modules/workflow/dtos";
import type { IWorkflowEngine } from "@application/modules/workflow/ports/workflow-engine";
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
      });

      if (error) return err(toDomainDbError(error, { entity: "المعاملة" }));
      return ok({ transactionId: data });
    } catch (e) {
      return err(toDomainError(e, "تعذّر بدء المعاملة"));
    }
  }

  async completeStep(
    input: CompleteStepDto,
  ): Promise<Result<{ nextStepInstanceId: string | null }, DomainError>> {
    try {
      const { data, error } = await this.client.rpc("complete_step", {
        p_step_instance_id: input.stepInstanceId,
        p_notes: input.notes,
      });

      if (error)
        return err(
          toDomainDbError(error, { entity: "المرحلة", id: input.stepInstanceId }),
        );
      return ok({ nextStepInstanceId: data ?? null });
    } catch (e) {
      return err(toDomainError(e, "تعذّر إنجاز المرحلة"));
    }
  }

  async setStepDuration(input: SetStepDurationDto): Promise<Result<void, DomainError>> {
    try {
      const { error } = await this.client.rpc("set_step_duration", {
        p_step_instance_id: input.stepInstanceId,
        p_minutes: input.minutes,
        p_scope: input.scope,
        p_reason: input.reason,
      });

      if (error)
        return err(
          toDomainDbError(error, { entity: "مدة المرحلة", id: input.stepInstanceId }),
        );
      return okVoid();
    } catch (e) {
      return err(toDomainError(e, "تعذّر تحديد المدة"));
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
