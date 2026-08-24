/**
 * Worker — العامل: ملف موظف بامتداد (بطاقة، مهن، نوع أجر).
 * حالته واحدة في كل لحظة: شاغر أو منتدب أو عليه ملاحظة [4، 5، 6].
 */
import type { EntityId } from "../../../shared/entities/base-entity";
import { ValidationError } from "../../../shared/errors/domain-error";
import { err, okVoid, type Result } from "../../../shared/result";

export type SalaryType = "monthly" | "daily" | "production";
export type WorkerStatus = "available" | "seconded" | "problem";

export interface WorkerInput {
  fullName: string;
  cardNo: string | null;
  professions: readonly string[];
  salaryType: SalaryType;
}

export function validateWorker(input: WorkerInput): Result<void, ValidationError> {
  if (input.fullName.trim().length < 2) {
    return err(new ValidationError("اسم العامل مطلوب", { fullName: "required" }));
  }
  if (input.professions.length === 0) {
    return err(new ValidationError("مهنة واحدة على الأقل", { professions: "empty" }));
  }
  return okVoid();
}

/** العامل الشاغر وحده يُندب لمشروع جديد. */
export function canSecond(status: WorkerStatus): boolean {
  return status === "available";
}

/**
 * تكلفة العامل في فترة: اليوميات المستحقّة × الأجر اليومي.
 * الحساب نفسه في Postgres؛ هذه نسخة العرض.
 */
export function laborCost(payableDays: number, dailyWage: number): number {
  if (!Number.isFinite(payableDays) || !Number.isFinite(dailyWage)) return 0;
  return Math.round(payableDays * dailyWage * 100) / 100;
}

/** نسبة الإنتاج: الدخل ÷ التكلفة — أساس درجة معدّل الإنتاج [10]. */
export function productionRatio(income: number, cost: number): number | null {
  if (!Number.isFinite(income) || !Number.isFinite(cost) || cost <= 0) return null;
  return Math.round((income / cost) * 1000) / 1000;
}

export interface WorkerRef {
  id: EntityId;
  fullName: string;
}
