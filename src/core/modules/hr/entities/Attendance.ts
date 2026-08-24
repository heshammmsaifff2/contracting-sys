/**
 * Attendance — اليومية.
 * ثلاث قواعد: عامل واحد ليوم واحد [16]، ولا تسجيل بعد الموعد إلا بصلاحية [17]،
 * وقيمة اليوم بحسب حالته [3]. القيمتان الأخيرتان من الإعدادات لا من الكود،
 * والفحص المُلزِم في قاعدة البيانات — وهذه نسخة الواجهة تمنع طلبًا مرفوضًا سلفًا.
 */
import { ValidationError } from "../../../shared/errors/domain-error";
import { err, okVoid, type Result } from "../../../shared/result";

export type AttendanceStatus = "present" | "excused" | "absent" | "sick";

/** قيمة اليوم لكل حالة — تُقرأ من settings.attendance_day_values. */
export type DayValues = Readonly<Record<AttendanceStatus, number>>;

export interface AttendanceEntry {
  workerId: string;
  status: AttendanceStatus;
}

/**
 * اليوميات المستحقّة: الحاضر يوم، المريض نصف، والغياب يخصم.
 * المجموع قد يكون سالبًا — وهو المقصود: الغياب يأكل من المستحقّ.
 */
export function payableDays(
  entries: readonly { status: AttendanceStatus }[],
  values: DayValues,
): number {
  const total = entries.reduce((sum, entry) => sum + (values[entry.status] ?? 0), 0);
  return Math.round(total * 100) / 100;
}

/** هل انقضى وقت التسجيل؟ الساعة بصيغة HH:MM من الإعدادات. */
export function isPastCutoff(cutoff: string, now: Date = new Date()): boolean {
  const parts = cutoff.split(":");
  const hour = Number(parts[0]);
  const minute = Number(parts[1] ?? "0");
  if (!Number.isFinite(hour) || !Number.isFinite(minute)) return false;

  const nowMinutes = now.getHours() * 60 + now.getMinutes();
  return nowMinutes > hour * 60 + minute;
}

/** لا يُسجَّل عامل مرتين في الكشف الواحد، ولا كشف بلا أسماء. */
export function validateSheet(
  entries: readonly AttendanceEntry[],
): Result<void, ValidationError> {
  if (entries.length === 0) {
    return err(new ValidationError("الكشف بلا عمّال", { entries: "empty" }));
  }
  const ids = new Set(entries.map((entry) => entry.workerId));
  if (ids.size !== entries.length) {
    return err(new ValidationError("العامل مكرّر في الكشف", { entries: "duplicate" }));
  }
  return okVoid();
}
