/**
 * Quantity — كمية بوحدة قياس. لا تقبل السالب افتراضيًا،
 * وتُستخدم في طلبات الاحتياج والمخازن والمستخلصات.
 */
import { ValidationError } from "../errors/domain-error";
import { err, ok, type Result } from "../result";

/** دقّة الكميات: 3 خانات عشرية تكفي (متر مكعّب، طن...). */
const PRECISION = 3;
const FACTOR = 10 ** PRECISION;

export class Quantity {
  readonly value: number;
  readonly unit: string;

  private constructor(value: number, unit: string) {
    this.value = value;
    this.unit = unit;
    Object.freeze(this);
  }

  static create(
    value: number,
    unit: string,
    opts: { allowNegative?: boolean } = {},
  ): Result<Quantity, ValidationError> {
    if (!Number.isFinite(value)) {
      return err(new ValidationError("الكمية غير صالحة", { value: "not_a_number" }));
    }
    if (!opts.allowNegative && value < 0) {
      return err(
        new ValidationError("الكمية لا يمكن أن تكون سالبة", { value: "negative" }),
      );
    }
    if (unit.trim().length === 0) {
      return err(new ValidationError("وحدة القياس مطلوبة", { unit: "required" }));
    }
    return ok(new Quantity(Math.round(value * FACTOR) / FACTOR, unit.trim()));
  }

  static zero(unit: string): Quantity {
    return new Quantity(0, unit);
  }

  get isZero(): boolean {
    return this.value === 0;
  }

  add(other: Quantity): Result<Quantity, ValidationError> {
    const guard = this.assertSameUnit(other);
    if (guard) return err(guard);
    return Quantity.create(this.value + other.value, this.unit, {
      allowNegative: true,
    });
  }

  subtract(other: Quantity): Result<Quantity, ValidationError> {
    const guard = this.assertSameUnit(other);
    if (guard) return err(guard);
    return Quantity.create(this.value - other.value, this.unit, {
      allowNegative: true,
    });
  }

  /** هل تتجاوز هذه الكمية الحد الأقصى المسموح؟ (قاعدة max_qty في طلب الاحتياج) */
  exceeds(limit: Quantity): Result<boolean, ValidationError> {
    const guard = this.assertSameUnit(limit);
    if (guard) return err(guard);
    return ok(this.value > limit.value);
  }

  equals(other: Quantity): boolean {
    return this.value === other.value && this.unit === other.unit;
  }

  private assertSameUnit(other: Quantity): ValidationError | null {
    if (other.unit !== this.unit) {
      return new ValidationError("لا يمكن الجمع بين وحدتَي قياس مختلفتين", {
        left: this.unit,
        right: other.unit,
      });
    }
    return null;
  }
}
