/**
 * Extract — المستخلص.
 * قواعده ثلاث: الترقيم متسلسل حتى الختامي، والكمية لا تتجاوز حد العقد
 * بعد إضافة ما سبق، والصافي = الإجمالي − الاستقطاعات + المردود من الضمان.
 * الحساب نفسه يقع على الخادم؛ ما هنا هو القاعدة التي تحمي الواجهة وتُختبر.
 */
import { ValidationError } from "../../../shared/errors/domain-error";
import { err, okVoid, type Result } from "../../../shared/result";

export type ExtractStatus = "draft" | "submitted" | "approved" | "paid" | "cancelled";

export interface ExtractLineInput {
  unitPrice: number;
  maxQty: number;
  prevQty: number;
  currentQty: number;
}

export interface DeductionRate {
  key: string;
  name: string;
  rate: number;
}

export interface ComputedDeduction extends DeductionRate {
  amount: number;
}

/** المتبقّي من حد العقد بعد ما سبق وما في هذا المستخلص. */
export function remainingQty(
  maxQty: number,
  prevQty: number,
  currentQty: number,
): number {
  return Math.max(maxQty - prevQty - currentQty, 0);
}

/** نسبة التنفيذ التراكمية للبند — تُعرض في المستخلص وتقارير المتابعة. */
export function completionRatio(
  maxQty: number,
  prevQty: number,
  currentQty: number,
): number | null {
  if (!Number.isFinite(maxQty) || maxQty <= 0) return null;
  return (prevQty + currentQty) / maxQty;
}

/**
 * كمية السطر: موجبة، ولا تتجاوز ما بقي من حد العقد.
 * القاعدة نفسها مُشغِّل في قاعدة البيانات — هذه نسخة الواجهة لا بديلها.
 */
export function validateLineQty(line: ExtractLineInput): Result<void, ValidationError> {
  if (!Number.isFinite(line.currentQty) || line.currentQty < 0) {
    return err(new ValidationError("الكمية لا تكون سالبة", { currentQty: "negative" }));
  }
  if (line.maxQty > 0 && line.prevQty + line.currentQty > line.maxQty) {
    return err(
      new ValidationError("الكمية تتجاوز حد العقد", {
        currentQty: "exceeds_contract",
        remaining: String(Math.max(line.maxQty - line.prevQty, 0)),
      }),
    );
  }
  return okVoid();
}

/** إجمالي المستخلص قبل أي استقطاع. */
export function computeGross(lines: readonly ExtractLineInput[]): number {
  return round2(lines.reduce((sum, line) => sum + line.currentQty * line.unitPrice, 0));
}

/** الاستقطاعات النشطة محسوبة على الإجمالي — النسب من الإعداد لا من الكود. */
export function computeDeductions(
  gross: number,
  rates: readonly DeductionRate[],
): readonly ComputedDeduction[] {
  return rates
    .filter((rate) => rate.rate > 0)
    .map((rate) => ({ ...rate, amount: round2((gross * rate.rate) / 100) }));
}

export function computeNet(
  gross: number,
  deductions: readonly ComputedDeduction[],
  retentionReleased = 0,
): number {
  const total = deductions.reduce((sum, d) => sum + d.amount, 0);
  return round2(gross - total + retentionReleased);
}

/** المستخلص لا يُعتمد إلا مسودّة بقيمة موجبة. */
export function canApproveExtract(
  status: ExtractStatus,
  gross: number,
): Result<void, ValidationError> {
  if (status !== "draft" && status !== "submitted") {
    return err(new ValidationError("المستخلص معتمَد بالفعل", { status }));
  }
  if (gross <= 0) {
    return err(new ValidationError("قيمة المستخلص صفر", { gross: "zero" }));
  }
  return okVoid();
}

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}
