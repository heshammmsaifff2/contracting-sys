/**
 * EvaluationRule — قاعدة إدارية تعدّل الدرجة.
 *
 * لغتها لغة التفريع المجمَّدة نفسها، لكنّ **حقولها غيرها**: التفريع يُقاس على
 * لقطة المعاملة، والقاعدة تُقاس على مقاييس الموظف في الفترة. ولذلك قائمة
 * الحقول هنا مغلقة كإغلاق قائمة المعاملات — ما ليس فيها لا يُشترَط عليه،
 * وكل حقل يُضاف يصير عقدًا لا يُنقَض.
 *
 * نسخة مطابقة لما يُرجعه `employee_period_metrics` في Postgres.
 */
import type { WorkflowCondition } from "./WorkflowCondition";

export type RuleEffect = "bonus" | "penalty";

/** حقول المقاييس — مغلقة، ومطابقة لما تُرجعه القاعدة. */
export const RULE_METRIC_FIELDS = [
  "completed_count",
  "late_count",
  "on_time_count",
  "on_time_ratio",
  "avg_score",
  "open_count",
  "warnings_count",
  "employee_type",
  "department_id",
] as const;

export type RuleMetricField = (typeof RULE_METRIC_FIELDS)[number];

/** ما يصلح مضروبًا فيه: العدّادات وحدها، لا النسب ولا المعرّفات. */
export const RULE_UNIT_FIELDS: readonly RuleMetricField[] = [
  "completed_count",
  "late_count",
  "on_time_count",
  "open_count",
  "warnings_count",
];

export function isRuleMetricField(field: string): field is RuleMetricField {
  return (RULE_METRIC_FIELDS as readonly string[]).includes(field);
}

export function isRuleUnitField(field: string): boolean {
  return (RULE_UNIT_FIELDS as readonly string[]).includes(field);
}

export interface RuleShape {
  readonly condition: WorkflowCondition | null;
  readonly effect: RuleEffect;
  readonly points: number;
  /** فارغ = نقاط ثابتة؛ وإلا تُضرَب في هذا الحقل من المقاييس. */
  readonly perUnitField: string | null;
  readonly maxPoints: number | null;
}

/**
 * أثر القاعدة على مقاييس بعينها — نسخة مطابقة لحساب الخادم.
 *
 * تُستعمل في الواجهة للعرض الفوري قبل الحفظ. والحساب الذي يُكتب في ملفّ
 * الموظف يبقى حساب الخادم: لو حُسبت النقاط مرّتين بطريقتين لاختلف ما رآه
 * المدير عمّا وقع.
 */
export function ruleImpact(
  rule: RuleShape,
  metrics: Readonly<Record<string, unknown>>,
): number {
  let points = rule.points;

  if (rule.perUnitField !== null) {
    const raw = metrics[rule.perUnitField];
    const units = typeof raw === "number" ? raw : Number(raw ?? 0);
    points = rule.points * Math.max(Number.isFinite(units) ? units : 0, 0);
  }

  if (rule.maxPoints !== null) points = Math.min(points, rule.maxPoints);
  return Math.round(Math.max(points, 0) * 100) / 100;
}

/** موجبٌ للمكافأة، سالبٌ للخصم — كما تجمعها اللقطة. */
export function signedImpact(
  rule: RuleShape,
  metrics: Readonly<Record<string, unknown>>,
): number {
  const points = ruleImpact(rule, metrics);
  return rule.effect === "bonus" ? points : -points;
}

/** الدرجة تبقى بين صفر ومئة مهما بلغت القواعد. */
export function clampScore(score: number): number {
  return Math.min(100, Math.max(0, Math.round(score * 100) / 100));
}

export type RuleProblem =
  | "no_condition"
  | "points_not_positive"
  | "unknown_unit_field"
  | "unit_without_cap"
  | "cap_not_positive";

/**
 * ما يمنع حفظ القاعدة.
 *
 * أهمّها **الوحدة بلا سقف**: «نقطتان لكل معاملة متأخّرة» على موظف تأخّر
 * في ستّين معاملة تمحو درجته كلّها وتزيد. السقف ليس تجميلًا.
 */
export function ruleProblems(rule: RuleShape): readonly RuleProblem[] {
  const problems: RuleProblem[] = [];

  if (rule.condition === null) problems.push("no_condition");
  if (!Number.isFinite(rule.points) || rule.points <= 0) {
    problems.push("points_not_positive");
  }

  if (rule.perUnitField !== null) {
    if (!isRuleUnitField(rule.perUnitField)) problems.push("unknown_unit_field");
    if (rule.maxPoints === null) problems.push("unit_without_cap");
  }

  if (
    rule.maxPoints !== null &&
    (!Number.isFinite(rule.maxPoints) || rule.maxPoints <= 0)
  ) {
    problems.push("cap_not_positive");
  }

  return problems;
}

export function isRuleValid(rule: RuleShape): boolean {
  return ruleProblems(rule).length === 0;
}

// ── اللقطة الشهرية ──────────────────────────────────────────────────────
/**
 * الفترة تُجمَّد بعد انقضائها وحدها.
 *
 * `period` و`currentPeriod` بصيغة `YYYY-MM`، والمقارنة النصّية تكفي: الصيغة
 * ثابتة الطول ومصفوفة بالسنة ثم الشهر، فترتيبها المعجمي هو ترتيبها الزمني.
 */
export function canFreezePeriod(period: string, currentPeriod: string): boolean {
  return /^[0-9]{4}-[0-9]{2}$/.test(period) && period < currentPeriod;
}

export function previousPeriod(reference: Date): string {
  const year = reference.getFullYear();
  const month = reference.getMonth(); // صفريّ: هذا هو الشهر السابق بالفعل
  const shifted =
    month === 0 ? new Date(year - 1, 11, 1) : new Date(year, month - 1, 1);
  return `${shifted.getFullYear()}-${String(shifted.getMonth() + 1).padStart(2, "0")}`;
}
