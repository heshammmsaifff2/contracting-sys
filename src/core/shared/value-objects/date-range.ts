/**
 * DateRange — مدى زمني مغلق البداية مفتوح النهاية [from, to).
 * يُستخدم لحركة المعدّات، فترات التقييم، وتوفّر العمالة.
 */
import { ValidationError } from "../errors/domain-error";
import { err, ok, type Result } from "../result";

export class DateRange {
  readonly from: Date;
  /** null = مفتوح (ما زال ساريًا). */
  readonly to: Date | null;

  private constructor(from: Date, to: Date | null) {
    this.from = new Date(from.getTime());
    this.to = to ? new Date(to.getTime()) : null;
    Object.freeze(this);
  }

  static create(
    from: Date,
    to: Date | null = null,
  ): Result<DateRange, ValidationError> {
    if (Number.isNaN(from.getTime())) {
      return err(new ValidationError("تاريخ البداية غير صالح", { from: "invalid" }));
    }
    if (to && Number.isNaN(to.getTime())) {
      return err(new ValidationError("تاريخ النهاية غير صالح", { to: "invalid" }));
    }
    if (to && to.getTime() < from.getTime()) {
      return err(
        new ValidationError("تاريخ النهاية يسبق تاريخ البداية", { to: "before_from" }),
      );
    }
    return ok(new DateRange(from, to));
  }

  get isOpenEnded(): boolean {
    return this.to === null;
  }

  contains(date: Date): boolean {
    const t = date.getTime();
    if (t < this.from.getTime()) return false;
    return this.to === null || t < this.to.getTime();
  }

  overlaps(other: DateRange): boolean {
    const aEnd = this.to?.getTime() ?? Number.POSITIVE_INFINITY;
    const bEnd = other.to?.getTime() ?? Number.POSITIVE_INFINITY;
    return this.from.getTime() < bEnd && other.from.getTime() < aEnd;
  }

  /** عدد الأيام التقويمية (لا يراعي مواعيد العمل — ذلك من اختصاص Postgres). */
  get durationInDays(): number | null {
    if (!this.to) return null;
    return Math.ceil((this.to.getTime() - this.from.getTime()) / 86_400_000);
  }
}
