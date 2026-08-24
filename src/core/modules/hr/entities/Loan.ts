/**
 * Loan — سلفة العامل عبر الخدمة الذاتية [شؤون الموظفين 7].
 * يطلبها العامل لنفسه، ولا تُعدَّل بعد البتّ فيها.
 */
import { ValidationError } from "../../../shared/errors/domain-error";
import { err, okVoid, type Result } from "../../../shared/result";

export type LoanStatus = "requested" | "approved" | "rejected" | "paid" | "settled";

export interface LoanRequestInput {
  amount: number;
  installments: number;
  reason: string;
}

export function validateLoanRequest(
  input: LoanRequestInput,
): Result<void, ValidationError> {
  if (!Number.isFinite(input.amount) || input.amount <= 0) {
    return err(
      new ValidationError("قيمة السلفة يجب أن تكون أكبر من صفر", { amount: "invalid" }),
    );
  }
  if (!Number.isInteger(input.installments) || input.installments < 1) {
    return err(
      new ValidationError("عدد الأقساط يجب أن يكون واحدًا فأكثر", {
        installments: "invalid",
      }),
    );
  }
  return okVoid();
}

/** لا يُبتّ في سلفة إلا مرة واحدة. */
export function canDecide(status: LoanStatus): boolean {
  return status === "requested";
}

/** العامل يعدّل أو يسحب طلبه ما دام لم يُبتّ فيه. */
export function canWithdraw(status: LoanStatus): boolean {
  return status === "requested";
}

/** قسط السلفة الشهري — يُخصم من المستحقّ. */
export function installmentAmount(amount: number, installments: number): number {
  if (!Number.isFinite(amount) || !Number.isInteger(installments) || installments < 1) {
    return 0;
  }
  return Math.round((amount / installments) * 100) / 100;
}
