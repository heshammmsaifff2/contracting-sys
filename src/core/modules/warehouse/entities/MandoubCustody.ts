/**
 * MandoubCustody — سطر عهدة المندوب (المخزن الفرعي).
 * الرصيد نفسه يُحسب على الخادم؛ ما هنا هو قواعد الصرف التي تحمي الواجهة
 * من إرسال طلب مرفوض أصلًا: لا تنزيل بلا رصيد ولا كمية صفرية.
 */
import type { EntityId } from "../../../shared/entities/base-entity";
import { ValidationError } from "../../../shared/errors/domain-error";
import { err, okVoid, type Result } from "../../../shared/result";

export interface StockLine {
  itemId: EntityId;
  qty: number;
}

/** اتجاه الحركة المخزنية — يقابل قيود العمود direction في قاعدة البيانات. */
export type StockDirection =
  "site_to_mandoub" | "mandoub_to_site" | "mandoub_to_facility";

export class MandoubCustody {
  readonly projectId: EntityId;
  readonly mandoubId: EntityId;
  readonly itemId: EntityId;
  readonly quantity: number;

  constructor(
    projectId: EntityId,
    mandoubId: EntityId,
    itemId: EntityId,
    quantity: number,
  ) {
    this.projectId = projectId;
    this.mandoubId = mandoubId;
    this.itemId = itemId;
    this.quantity = quantity;
    Object.freeze(this);
  }

  /** هل تكفي العهدة لتنزيل هذه الكمية؟ */
  covers(qty: number): boolean {
    return Number.isFinite(qty) && qty > 0 && this.quantity >= qty;
  }

  get isEmpty(): boolean {
    return this.quantity <= 0;
  }
}

/**
 * تحقّق مشترك لأي سند حركة: أصناف موجودة، كميات موجبة، بلا تكرار.
 */
export function validateStockLines(
  lines: readonly StockLine[],
): Result<void, ValidationError> {
  if (lines.length === 0) {
    return err(new ValidationError("السند بلا أصناف", { lines: "empty" }));
  }
  if (lines.some((line) => !Number.isFinite(line.qty) || line.qty <= 0)) {
    return err(
      new ValidationError("الكمية يجب أن تكون أكبر من صفر", { lines: "invalid_qty" }),
    );
  }
  const ids = new Set(lines.map((line) => line.itemId));
  if (ids.size !== lines.length) {
    return err(new ValidationError("الصنف مكرّر في السند", { lines: "duplicate" }));
  }
  return okVoid();
}

/**
 * تحقّق أن كل سطر مغطّى برصيد متاح — يُستدعى قبل التنزيل بأرصدة العهدة الحالية.
 * الخادم يعيد الفحص تحت قفل الصف، وهذا للتجربة لا للأمان.
 */
export function validateAgainstCustody(
  lines: readonly StockLine[],
  available: ReadonlyMap<string, number>,
): Result<void, ValidationError> {
  const short = lines.find((line) => (available.get(line.itemId) ?? 0) < line.qty);
  if (short !== undefined) {
    return err(
      new ValidationError("الرصيد المتاح لا يكفي", {
        itemId: short.itemId,
        available: String(available.get(short.itemId) ?? 0),
      }),
    );
  }
  return okVoid();
}
