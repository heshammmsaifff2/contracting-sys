/**
 * وصف واجهة كل إعداد: اسمه بالعربية، ونوع الحقل، ووحدته.
 *
 * ما هنا **ليس قيمًا** بل طريقة عرضها. القيم كلها في جدول `settings` في
 * قاعدة البيانات ولا يُكتب أيّ منها هنا — القاعدة الرابعة في المواصفات.
 * إعداد لا يجد وصفه هنا يُعرَض بحقل مشتقّ من نوع قيمته، فلا تنكسر الشاشة
 * حين يُضاف إعداد جديد في قاعدة البيانات قبل أن تعرفه الواجهة.
 */

export type FieldKind =
  | "text"
  | "number"
  | "percent"
  | "time"
  | "account"
  | "currency"
  | "timezone"
  | "numberList"
  | "numberMap"
  | "scoreBands"
  | "json";

export interface FieldSpec {
  /** اسم مفهوم يحلّ محلّ مفتاح قاعدة البيانات. */
  label: string;
  kind: FieldKind;
  /** وحدة تظهر بعد الحقل: ٪، يوم، شهر… */
  unit?: string;
  /** شرح إضافي تحت الحقل حين لا يكفي وصف قاعدة البيانات. */
  help?: string;
  /** تسميات عربية لمفاتيح الكائن — تُستخدم مع `numberMap`. */
  entryLabels?: Record<string, string>;
  /** أصغر وأكبر قيمة مقبولة في الحقل الرقمي. */
  min?: number;
  max?: number;
  step?: number;
}

export const CATEGORY_LABELS: Record<string, string> = {
  general: "بيانات الشركة",
  finance: "المال والضريبة",
  accounting: "الحسابات والترحيل",
  workflow: "سير العمل والتقييم",
  hr: "شؤون الموظفين",
  warehouse: "المخازن",
};

/** ترتيب عرض التصنيفات — الأعمّ أولًا. */
export const CATEGORY_ORDER: readonly string[] = [
  "general",
  "finance",
  "accounting",
  "workflow",
  "hr",
  "warehouse",
];

export const FIELD_SPECS: Record<string, FieldSpec> = {
  company_name: {
    label: "اسم الشركة",
    kind: "text",
    help: "يظهر في رأس المستندات المطبوعة",
  },
  default_currency: {
    label: "عملة النظام",
    kind: "currency",
    help: "تُعرض بها كل المبالغ في النظام",
  },
  vat_rate: {
    label: "نسبة ضريبة القيمة المضافة",
    kind: "percent",
    unit: "٪",
    min: 0,
    max: 100,
    step: 0.5,
  },
  fiscal_year_start_month: {
    label: "شهر بداية السنة المالية",
    kind: "number",
    unit: "الشهر",
    min: 1,
    max: 12,
    step: 1,
  },
  vat_account_code: {
    label: "حساب ضريبة القيمة المضافة",
    kind: "account",
    help: "الحساب الذي تُرحَّل إليه الضريبة آليًا",
  },
  bank_fee_account_code: {
    label: "حساب مصاريف التحويل البنكي",
    kind: "account",
  },
  guarantee_alert_days: {
    label: "التنبيه قبل انتهاء خطاب الضمان",
    kind: "number",
    unit: "يومًا",
    min: 1,
    max: 365,
    step: 1,
  },
  timezone: {
    label: "المنطقة الزمنية",
    kind: "timezone",
    help: "عليها يُحسَب الدوام والعدّادات",
  },
  inbox_color_thresholds: {
    label: "عتبات ألوان صندوق الوارد",
    kind: "numberMap",
    help: "نسبة الوقت المستهلك من المدة التي يتحوّل عندها لون المعاملة",
    entryLabels: {
      info: "أزرق — مرّ من المدة",
      warning: "أصفر — مرّ من المدة",
      danger: "أحمر — انتهت المدة",
    },
    min: 0,
    max: 5,
    step: 0.05,
  },
  completion_score_bands: {
    label: "درجات الإنجاز حسب السرعة",
    kind: "scoreBands",
    help: "من أنجز في ربع المدة يأخذ الدرجة الأعلى، ومن تجاوز الضعف يأخذ الأدنى",
  },
  attendance_cutoff_time: {
    label: "آخر وقت لتسجيل يومية اليوم",
    kind: "time",
    help: "بعد هذا الوقت يحتاج المسجِّل صلاحية «التسجيل المتأخّر»",
  },
  attendance_day_values: {
    label: "قيمة اليوم لكل حالة",
    kind: "numberMap",
    help: "بالسالب يعني خصمًا من رصيد أيام العامل",
    entryLabels: {
      present: "حاضر",
      sick: "مرضي",
      excused: "غياب بإذن",
      absent: "غياب بلا إذن",
    },
    min: -10,
    max: 10,
    step: 0.5,
  },
  production_score_bands: {
    label: "درجات معدّل الإنتاج",
    kind: "scoreBands",
    help: "النسبة = دخل العامل ÷ تكلفة يومياته",
  },
  waste_deviation_ratio: {
    label: "حدّ اعتبار الاستهلاك هدرًا",
    kind: "number",
    unit: "× المتوسط",
    help: "١٫٥ يعني: ما تجاوز متوسط المشروع بمرّة ونصف يُعدّ هدرًا",
    min: 1,
    max: 10,
    step: 0.1,
  },
  consumption_trend_months: {
    label: "فترات التقرير التراكمي",
    kind: "numberList",
    unit: "أشهر",
    help: "افصل بين الأرقام بفاصلة",
  },
};

/** عملات شائعة — القيمة المختارة تُحفظ في قاعدة البيانات لا هنا. */
export const CURRENCY_OPTIONS: readonly { value: string; label: string }[] = [
  { value: "EGP", label: "جنيه مصري (EGP)" },
  { value: "SAR", label: "ريال سعودي (SAR)" },
  { value: "AED", label: "درهم إماراتي (AED)" },
  { value: "USD", label: "دولار أمريكي (USD)" },
  { value: "EUR", label: "يورو (EUR)" },
];

export const TIMEZONE_OPTIONS: readonly { value: string; label: string }[] = [
  { value: "Africa/Cairo", label: "القاهرة" },
  { value: "Asia/Riyadh", label: "الرياض" },
  { value: "Asia/Dubai", label: "دبي" },
  { value: "Africa/Tripoli", label: "طرابلس" },
  { value: "Asia/Baghdad", label: "بغداد" },
  { value: "UTC", label: "التوقيت العالمي (UTC)" },
];

/**
 * حين لا يوجد وصف للمفتاح، نستنتج الحقل من شكل القيمة نفسها.
 * الغرض ألّا تظهر شاشة مكسورة لإعداد أُضيف في قاعدة البيانات للتوّ.
 */
export function inferSpec(key: string, value: unknown): FieldSpec {
  const known = FIELD_SPECS[key];
  if (known !== undefined) return known;

  const label = key.replace(/_/g, " ");

  if (typeof value === "number") return { label, kind: "number" };
  if (typeof value === "string") return { label, kind: "text" };

  if (Array.isArray(value)) {
    if (value.every((v) => typeof v === "number")) {
      return { label, kind: "numberList" };
    }
    return { label, kind: "json" };
  }

  if (typeof value === "object" && value !== null) {
    const entries = Object.values(value as Record<string, unknown>);
    if (entries.length > 0 && entries.every((v) => typeof v === "number")) {
      return { label, kind: "numberMap" };
    }
  }

  return { label, kind: "json" };
}
