import type { DomainError } from "@core/shared/errors/domain-error";
import type { Result } from "@core/shared/result";
import type { CompleteStepDto, SetStepDurationDto, StartTransactionDto } from "../dtos";

/**
 * منفذ المحرّك: كل انتقال حالة يقع في دالة Postgres واحدة تحسب الزمن
 * داخل الدوام وتضع الدرجة وتفتح المرحلة التالية ذرّيًا.
 */
export interface IWorkflowEngine {
  startTransaction(
    input: StartTransactionDto,
  ): Promise<Result<{ transactionId: string }, DomainError>>;
  /** يعيد معرّف المرحلة التالية، أو null إن انتهت المراحل. */
  completeStep(
    input: CompleteStepDto,
  ): Promise<Result<{ nextStepInstanceId: string | null }, DomainError>>;
  setStepDuration(input: SetStepDurationDto): Promise<Result<void, DomainError>>;
  closeTransaction(transactionId: string): Promise<Result<void, DomainError>>;
  cancelTransaction(transactionId: string): Promise<Result<void, DomainError>>;
}
