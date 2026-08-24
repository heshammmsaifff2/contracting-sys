/**
 * Guarantee — خطاب الضمان.
 * قيمته في المتابعة لا في التسجيل: ما لم يُنبَّه قبل انتهائه بمدة كافية سقط.
 * عتبة التنبيه من الإعدادات (guarantee_alert_days) لا من الكود.
 */
export type GuaranteeKind = "initial" | "final" | "maintenance" | "advance";
export type GuaranteeStatus = "active" | "released" | "expired";

/** الأيام المتبقّية — سالبة يعني انتهى. */
export function daysUntil(expiresAt: string, today: Date = new Date()): number {
  const expiry = new Date(`${expiresAt}T00:00:00Z`).getTime();
  const start = Date.UTC(
    today.getUTCFullYear(),
    today.getUTCMonth(),
    today.getUTCDate(),
  );
  return Math.round((expiry - start) / 86_400_000);
}

export function isExpired(expiresAt: string, today: Date = new Date()): boolean {
  return daysUntil(expiresAt, today) < 0;
}

/** هل دخل الضمان نطاق التنبيه؟ */
export function isExpiring(
  expiresAt: string,
  alertDays: number,
  today: Date = new Date(),
): boolean {
  const left = daysUntil(expiresAt, today);
  return left >= 0 && left <= alertDays;
}
