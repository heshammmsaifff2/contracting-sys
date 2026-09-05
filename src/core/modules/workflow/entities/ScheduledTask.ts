/**
 * ScheduledTask — ما يفعله النظام بنفسه بجدول زمني.
 *
 * الخطاب ليس كيانًا خاصًّا: `start_workflow` يبدأ **أي** مسار، والجمهور يصير
 * مشاركين على مرحلته الأولى. و`notify` إشعار عابر بلا معاملة ولا عدّاد.
 *
 * القواعد هنا نسخة مطابقة لما تفرضه القاعدة — الواجهة تمنع الحفظ المعطوب،
 * والخادم لا يثق بالواجهة.
 */
import { ValidationError } from "../../../shared/errors/domain-error";
import { err, okVoid, type Result } from "../../../shared/result";

export type TaskAction = "start_workflow" | "notify";

/**
 * `cron` ليس منها عمدًا: مفسّر cron في القاعدة مساحةُ خطأ كبيرة مقابل فائدة
 * صغيرة، وهذه الستّة تغطّي ما طُلب.
 */
export type ScheduleKind =
  "once" | "daily" | "weekly" | "monthly" | "quarterly" | "yearly";

export type AudienceScope = "company" | "department" | "role" | "project" | "users";

export const SCHEDULE_KINDS: readonly ScheduleKind[] = [
  "once",
  "daily",
  "weekly",
  "monthly",
  "quarterly",
  "yearly",
];

export const AUDIENCE_SCOPES: readonly AudienceScope[] = [
  "company",
  "department",
  "role",
  "project",
  "users",
];

export interface Audience {
  readonly scope: AudienceScope;
  readonly ids?: readonly string[];
}

export interface ScheduleSpec {
  /** "HH:MM" — لكل الأنواع عدا `once`. */
  readonly time?: string;
  /** `once`: لحظة صريحة بصيغة ISO. */
  readonly at?: string;
  /** `weekly`: 0 = الأحد … 6 = السبت. */
  readonly days?: readonly number[];
  /** `monthly` و`quarterly`: 1–28 حتى لا يضيع يوم في فبراير. */
  readonly day_of_month?: number;
  /** `yearly`. */
  readonly month?: number;
  readonly day?: number;
}

const TIME_PATTERN = /^([01][0-9]|2[0-3]):[0-5][0-9]$/;
const WEEK_DAY_NAMES = [
  "الأحد",
  "الاثنين",
  "الثلاثاء",
  "الأربعاء",
  "الخميس",
  "الجمعة",
  "السبت",
];
const MONTH_NAMES = [
  "يناير",
  "فبراير",
  "مارس",
  "أبريل",
  "مايو",
  "يونيو",
  "يوليو",
  "أغسطس",
  "سبتمبر",
  "أكتوبر",
  "نوفمبر",
  "ديسمبر",
];

function invalid(message: string, field: string): Result<void, ValidationError> {
  return err(new ValidationError(message, { [field]: "invalid" }));
}

/** `company` وحدها لا تحتاج معرّفات. */
export function validateAudience(audience: Audience): Result<void, ValidationError> {
  if (!AUDIENCE_SCOPES.includes(audience.scope)) {
    return invalid("نطاق الجمهور غير معروف", "scope");
  }
  if (audience.scope === "company") return okVoid();

  if (audience.ids === undefined || audience.ids.length === 0) {
    return invalid("اختر جمهور المهمة", "ids");
  }
  return okVoid();
}

export function validateScheduleSpec(
  kind: ScheduleKind,
  spec: ScheduleSpec,
): Result<void, ValidationError> {
  if (!SCHEDULE_KINDS.includes(kind)) {
    return invalid("نوع الجدولة غير مدعوم", "scheduleKind");
  }

  if (kind === "once") {
    if (spec.at === undefined || Number.isNaN(new Date(spec.at).getTime())) {
      return invalid("حدّد لحظة التشغيل", "at");
    }
    return okVoid();
  }

  if (spec.time !== undefined && !TIME_PATTERN.test(spec.time)) {
    return invalid("الوقت بصيغة HH:MM", "time");
  }

  if (kind === "weekly") {
    if (spec.days === undefined || spec.days.length === 0) {
      return invalid("اختر يومًا واحدًا على الأقل", "days");
    }
    if (spec.days.some((d) => !Number.isInteger(d) || d < 0 || d > 6)) {
      return invalid("اليوم بين 0 (الأحد) و6 (السبت)", "days");
    }
  }

  if (kind === "monthly" || kind === "quarterly") {
    const dom = spec.day_of_month;
    // 28 سقفًا: يوم 31 لا يوجد في كل شهر
    if (dom !== undefined && (!Number.isInteger(dom) || dom < 1 || dom > 28)) {
      return invalid("اليوم بين 1 و28", "day_of_month");
    }
  }

  if (kind === "yearly") {
    const month = spec.month;
    const day = spec.day;
    if (month !== undefined && (!Number.isInteger(month) || month < 1 || month > 12)) {
      return invalid("الشهر بين 1 و12", "month");
    }
    if (day !== undefined && (!Number.isInteger(day) || day < 1 || day > 28)) {
      return invalid("اليوم بين 1 و28", "day");
    }
  }

  return okVoid();
}

/** وصف الجدولة بالعربية — يُعرض تحت المهمة فيعرف من يقرؤها متى تعمل. */
export function describeSchedule(
  kind: ScheduleKind,
  spec: ScheduleSpec,
  shiftToWorkday = false,
): string {
  const time = spec.time ?? "09:00";
  const dom = spec.day_of_month ?? 1;
  let base: string;

  switch (kind) {
    case "once":
      base =
        spec.at === undefined
          ? "مرة واحدة"
          : `مرة واحدة في ${new Date(spec.at).toLocaleString("ar-EG")}`;
      break;
    case "daily":
      base = `كل يوم الساعة ${time}`;
      break;
    case "weekly": {
      const days = (spec.days ?? [])
        .map((d) => WEEK_DAY_NAMES[d] ?? String(d))
        .join("، ");
      base = `كل أسبوع: ${days === "" ? "—" : days} الساعة ${time}`;
      break;
    }
    case "monthly":
      base = `كل شهر يوم ${dom} الساعة ${time}`;
      break;
    case "quarterly":
      base = `كل ربع سنة يوم ${dom} الساعة ${time} (يناير · أبريل · يوليو · أكتوبر)`;
      break;
    case "yearly":
      base = `كل سنة ${dom} ${MONTH_NAMES[(spec.month ?? 1) - 1] ?? ""} الساعة ${time}`;
      break;
  }

  return shiftToWorkday && kind !== "once" ? `${base} — ويُزاح لأول يوم عمل` : base;
}

/** وصف الجمهور — الأسماء تأتي من الواجهة لأن الدومين لا يعرف الجداول. */
export function describeAudience(
  audience: Audience,
  names: Readonly<Record<string, string>> = {},
): string {
  if (audience.scope === "company") return "كل الشركة";

  const labels = (audience.ids ?? []).map((id) => names[id] ?? id);
  const list = labels.length === 0 ? "—" : labels.join("، ");

  switch (audience.scope) {
    case "department":
      return `أقسام: ${list}`;
    case "role":
      return `أدوار: ${list}`;
    case "project":
      return `مشاريع: ${list}`;
    case "users":
      return `موظفون: ${list}`;
  }
}
