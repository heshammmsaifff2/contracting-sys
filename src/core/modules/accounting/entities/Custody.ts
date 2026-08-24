/**
 * Custody — العهدة وفواتيرها.
 * لا سقف لمبلغ العهدة (قرار العمل): الضبط بالمراجعة والاعتماد لا برقم.
 * قاعدة صارمة: لا تُعتمد عهدة فيها فاتورة مكرّرة لم تُراجَع — الكشف نفسه
 * يجري في قاعدة البيانات، وهذه القاعدة تمنع الواجهة من طلب اعتماد مرفوض.
 */
import { ValidationError } from "../../../shared/errors/domain-error";
import { err, okVoid, type Result } from "../../../shared/result";

export type CustodyStatus = "open" | "submitted" | "approved" | "closed" | "cancelled";

export interface InvoiceSummary {
  amount: number;
  isDuplicate: boolean;
  duplicateReviewed: boolean;
  isReturned: boolean;
}

/** إجمالي العهدة: الفواتير غير المرتجعة وحدها. */
export function custodyTotal(invoices: readonly InvoiceSummary[]): number {
  return round2(
    invoices
      .filter((invoice) => !invoice.isReturned)
      .reduce((sum, invoice) => sum + invoice.amount, 0),
  );
}

/** عدد المكرّرات التي تنتظر مراجعة صاحب الصلاحية. */
export function unreviewedDuplicates(invoices: readonly InvoiceSummary[]): number {
  return invoices.filter(
    (invoice) =>
      invoice.isDuplicate && !invoice.duplicateReviewed && !invoice.isReturned,
  ).length;
}

export function canApproveCustody(
  status: CustodyStatus,
  isReturnedBox: boolean,
  invoices: readonly InvoiceSummary[],
): Result<void, ValidationError> {
  if (isReturnedBox) {
    return err(
      new ValidationError("وعاء المرتجعات لا يُعتمد", { custody: "returned_box" }),
    );
  }
  if (status !== "open" && status !== "submitted") {
    return err(new ValidationError("العهدة معتمَدة بالفعل", { status }));
  }

  const pending = unreviewedDuplicates(invoices);
  if (pending > 0) {
    return err(
      new ValidationError("توجد فواتير مكرّرة لم تُراجَع", {
        duplicates: String(pending),
      }),
    );
  }

  if (custodyTotal(invoices) <= 0) {
    return err(new ValidationError("لا فواتير في العهدة", { invoices: "empty" }));
  }

  return okVoid();
}

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}
