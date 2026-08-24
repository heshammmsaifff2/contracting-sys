/**
 * Money — قيمة مالية غير قابلة للتعديل.
 * تُخزَّن داخليًا بالوحدات الصغرى (هللات/قروش) كعدد صحيح لتفادي أخطاء الفاصلة العائمة،
 * فكل الحسابات المحاسبية (مستخلصات، عهد، ضريبة) تبقى دقيقة.
 */
import { ValidationError } from "../errors/domain-error";
import { err, ok, type Result } from "../result";

export type CurrencyCode = "SAR" | "EGP" | "USD" | "AED";

const MINOR_UNITS = 100;

export class Money {
  /** المبلغ بالوحدات الصغرى (عدد صحيح). */
  readonly minor: number;
  readonly currency: CurrencyCode;

  private constructor(minor: number, currency: CurrencyCode) {
    this.minor = minor;
    this.currency = currency;
    Object.freeze(this);
  }

  /** Create from a major-unit amount (e.g. 1250.75). */
  static create(
    amount: number,
    currency: CurrencyCode = "SAR",
  ): Result<Money, ValidationError> {
    if (!Number.isFinite(amount)) {
      return err(new ValidationError("المبلغ غير صالح", { amount: "not_a_number" }));
    }
    return ok(new Money(Math.round(amount * MINOR_UNITS), currency));
  }

  /** Create from an already-integer minor amount. */
  static fromMinor(
    minor: number,
    currency: CurrencyCode = "SAR",
  ): Result<Money, ValidationError> {
    if (!Number.isInteger(minor)) {
      return err(
        new ValidationError("المبلغ بالوحدات الصغرى يجب أن يكون عددًا صحيحًا", {
          minor: "not_an_integer",
        }),
      );
    }
    return ok(new Money(minor, currency));
  }

  static zero(currency: CurrencyCode = "SAR"): Money {
    return new Money(0, currency);
  }

  /** المبلغ بالوحدات الكبرى. */
  get amount(): number {
    return this.minor / MINOR_UNITS;
  }

  get isZero(): boolean {
    return this.minor === 0;
  }

  get isNegative(): boolean {
    return this.minor < 0;
  }

  add(other: Money): Result<Money, ValidationError> {
    const guard = this.assertSameCurrency(other);
    if (guard) return err(guard);
    return ok(new Money(this.minor + other.minor, this.currency));
  }

  subtract(other: Money): Result<Money, ValidationError> {
    const guard = this.assertSameCurrency(other);
    if (guard) return err(guard);
    return ok(new Money(this.minor - other.minor, this.currency));
  }

  /** الضرب في كمية أو معامل (يُقرَّب لأقرب وحدة صغرى). */
  multiply(factor: number): Result<Money, ValidationError> {
    if (!Number.isFinite(factor)) {
      return err(new ValidationError("المعامل غير صالح", { factor: "not_a_number" }));
    }
    return ok(new Money(Math.round(this.minor * factor), this.currency));
  }

  /** نسبة مئوية (مثال: ضريبة القيمة المضافة 15٪). */
  percentage(percent: number): Result<Money, ValidationError> {
    return this.multiply(percent / 100);
  }

  compare(other: Money): Result<number, ValidationError> {
    const guard = this.assertSameCurrency(other);
    if (guard) return err(guard);
    return ok(Math.sign(this.minor - other.minor));
  }

  equals(other: Money): boolean {
    return this.minor === other.minor && this.currency === other.currency;
  }

  /** القيمة كما تُرسل لقاعدة البيانات (numeric). */
  toNumeric(): number {
    return this.amount;
  }

  private assertSameCurrency(other: Money): ValidationError | null {
    if (other.currency !== this.currency) {
      return new ValidationError("لا يمكن الجمع بين عملتين مختلفتين", {
        left: this.currency,
        right: other.currency,
      });
    }
    return null;
  }
}
