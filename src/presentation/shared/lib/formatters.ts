/**
 * تنسيق موحّد للأرقام والمبالغ والتواريخ.
 * الأرقام تُعرض بالخانات اللاتينية (0-9) لأنها المعتاد في الأنظمة المحاسبية،
 * مع نصوص عربية للتاريخ والوحدات.
 */
import dayjs from "dayjs";
import "dayjs/locale/ar";
import relativeTime from "dayjs/plugin/relativeTime";
import duration from "dayjs/plugin/duration";
import type { CurrencyCode } from "@core/shared/value-objects/money";

dayjs.extend(relativeTime);
dayjs.extend(duration);
dayjs.locale("ar");

/** ar-EG مع نظام أرقام لاتيني. */
const LOCALE = "ar-EG-u-nu-latn";

const numberFormatter = new Intl.NumberFormat(LOCALE, {
  maximumFractionDigits: 3,
});

/** Format a plain number (quantities, counts). */
export function formatNumber(value: number): string {
  return numberFormatter.format(value);
}

/** Format a monetary amount with its currency symbol. */
export function formatMoney(amount: number, currency: CurrencyCode): string {
  return new Intl.NumberFormat(LOCALE, {
    style: "currency",
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
}

/** نسبة مئوية (لدرجات التقييم ونسب الإنجاز). */
export function formatPercent(fraction: number): string {
  return new Intl.NumberFormat(LOCALE, {
    style: "percent",
    maximumFractionDigits: 1,
  }).format(fraction);
}

/** تاريخ قصير: 2026/08/23 */
export function formatDate(date: Date | string): string {
  return dayjs(date).format("YYYY/MM/DD");
}

/** تاريخ ووقت: 2026/08/23 14:30 */
export function formatDateTime(date: Date | string): string {
  return dayjs(date).format("YYYY/MM/DD HH:mm");
}

/** «منذ ساعتين» — يُستخدم في عدّاد «وصلت منذ…» في صندوق الوارد. */
export function formatRelative(date: Date | string): string {
  return dayjs(date).fromNow();
}

/** مدة بالدقائق إلى صيغة مقروءة: «3 س 20 د». */
export function formatDuration(minutes: number): string {
  const abs = Math.abs(Math.round(minutes));
  const days = Math.floor(abs / 1440);
  const hours = Math.floor((abs % 1440) / 60);
  const mins = abs % 60;

  const parts: string[] = [];
  if (days > 0) parts.push(`${formatNumber(days)} ي`);
  if (hours > 0) parts.push(`${formatNumber(hours)} س`);
  if (mins > 0 || parts.length === 0) parts.push(`${formatNumber(mins)} د`);

  const text = parts.join(" ");
  return minutes < 0 ? `-${text}` : text;
}

/** حجم ملف مقروء. */
export function formatFileSize(bytes: number): string {
  const units = ["بايت", "ك.ب", "م.ب", "ج.ب"];
  let value = bytes;
  let unitIndex = 0;
  while (value >= 1024 && unitIndex < units.length - 1) {
    value /= 1024;
    unitIndex += 1;
  }
  return `${formatNumber(Math.round(value * 10) / 10)} ${units[unitIndex] ?? ""}`.trim();
}
