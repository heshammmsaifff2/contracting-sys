import type { DomainError } from "@core/shared/errors/domain-error";
import type { Result } from "@core/shared/result";
import type {
  CompleteAssignmentDto,
  SetAssignmentDurationDto,
  StartTransactionDto,
} from "../dtos";

/**
 * منفذ المحرّك: كل انتقال حالة يقع في دالة Postgres واحدة تحسب الزمن
 * داخل الدوام، وتضع الدرجة، وتطبّق سياسة إنجاز المرحلة، وتفتح ما يليها ذرّيًا.
 *
 * الكتابة المباشرة على جداول المحرّك ممنوعة من الواجهة — هذه هي المنافذ كلّها.
 */
export interface IWorkflowEngine {
  startTransaction(
    input: StartTransactionDto,
  ): Promise<Result<{ transactionId: string }, DomainError>>;
  /**
   * يتّخذ إجراءً على تكليف. يعيد معرّف المرحلة التالية إن أُغلقت المرحلة
   * وفُتح ما بعدها، و`null` إن كان الإجراء ملاحظة، أو كانت المرحلة ما زالت
   * تنتظر بقيّة مشاركيها، أو انتهت المعاملة.
   */
  completeAssignment(
    input: CompleteAssignmentDto,
  ): Promise<Result<{ nextStageInstanceId: string | null }, DomainError>>;
  /** استلام التكليف — يلزم قبل الإنجاز إن كانت المرحلة تشترطه. */
  receiveAssignment(assignmentId: string): Promise<Result<void, DomainError>>;
  setAssignmentDuration(
    input: SetAssignmentDurationDto,
  ): Promise<Result<void, DomainError>>;
  /** يحدّث لقطة السياق فتتغيّر وجهة التفريعات القادمة. */
  setTransactionContext(
    transactionId: string,
    patch: Readonly<Record<string, unknown>>,
  ): Promise<Result<void, DomainError>>;
  closeTransaction(transactionId: string): Promise<Result<void, DomainError>>;
  cancelTransaction(transactionId: string): Promise<Result<void, DomainError>>;
}
