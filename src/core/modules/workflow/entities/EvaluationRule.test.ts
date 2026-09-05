import { describe, expect, it } from "vitest";
import {
  canFreezePeriod,
  clampScore,
  isRuleMetricField,
  isRuleUnitField,
  isRuleValid,
  previousPeriod,
  ruleImpact,
  ruleProblems,
  signedImpact,
  type RuleShape,
} from "./EvaluationRule";

function rule(over: Partial<RuleShape> = {}): RuleShape {
  return {
    condition: { op: "gt", field: "warnings_count", value: 0 },
    effect: "penalty",
    points: 2,
    perUnitField: null,
    maxPoints: null,
    ...over,
  };
}

describe("EvaluationRule — الحقول المغلقة", () => {
  it("يعرف حقول المقاييس ولا يقبل غيرها", () => {
    expect(isRuleMetricField("warnings_count")).toBe(true);
    expect(isRuleMetricField("salary")).toBe(false);
  });

  it("الضرب على العدّادات وحدها لا على النسب ولا المعرّفات", () => {
    expect(isRuleUnitField("late_count")).toBe(true);
    expect(isRuleUnitField("on_time_ratio")).toBe(false);
    expect(isRuleUnitField("department_id")).toBe(false);
  });
});

describe("EvaluationRule — الأثر", () => {
  const metrics = { warnings_count: 3, late_count: 60, completed_count: 0 };

  it("النقاط الثابتة تُطبَّق مرّة", () => {
    expect(ruleImpact(rule({ points: 5 }), metrics)).toBe(5);
  });

  it("النقاط بوحدة تُضرَب في الحقل", () => {
    const r = rule({ points: 2, perUnitField: "warnings_count", maxPoints: 10 });
    expect(ruleImpact(r, metrics)).toBe(6);
  });

  it("السقف يحبس ما يتجاوزه", () => {
    const r = rule({ points: 2, perUnitField: "late_count", maxPoints: 10 });
    expect(ruleImpact(r, metrics)).toBe(10);
  });

  it("الحقل الغائب لا يعطي أثرًا سالبًا", () => {
    const r = rule({ points: 2, perUnitField: "warnings_count", maxPoints: 10 });
    expect(ruleImpact(r, {})).toBe(0);
  });

  it("المكافأة موجبة والخصم سالب", () => {
    expect(signedImpact(rule({ effect: "bonus", points: 5 }), metrics)).toBe(5);
    expect(signedImpact(rule({ effect: "penalty", points: 5 }), metrics)).toBe(-5);
  });

  it("الدرجة تبقى بين صفر ومئة", () => {
    expect(clampScore(120)).toBe(100);
    expect(clampScore(-8)).toBe(0);
    expect(clampScore(73.456)).toBe(73.46);
  });
});

describe("EvaluationRule — ما يمنع الحفظ", () => {
  it("القاعدة السليمة تُحفَظ", () => {
    expect(isRuleValid(rule())).toBe(true);
  });

  it("لا قاعدة بلا شرط", () => {
    expect(ruleProblems(rule({ condition: null }))).toContain("no_condition");
  });

  it("النقاط أكبر من صفر", () => {
    expect(ruleProblems(rule({ points: 0 }))).toContain("points_not_positive");
  });

  it("الوحدة تلزمها سقف — وإلا محت الدرجة كلّها", () => {
    const problems = ruleProblems(rule({ perUnitField: "late_count" }));
    expect(problems).toContain("unit_without_cap");
  });

  it("لا ضرب في حقل ليس عدّادًا", () => {
    const problems = ruleProblems(
      rule({ perUnitField: "on_time_ratio", maxPoints: 10 }),
    );
    expect(problems).toContain("unknown_unit_field");
  });

  it("السقف أكبر من صفر", () => {
    expect(ruleProblems(rule({ maxPoints: 0 }))).toContain("cap_not_positive");
  });
});

describe("EvaluationRule — الفترة", () => {
  it("لا تُجمَّد فترة لم تنتهِ", () => {
    expect(canFreezePeriod("2026-08", "2026-09")).toBe(true);
    expect(canFreezePeriod("2026-09", "2026-09")).toBe(false);
    expect(canFreezePeriod("2026-10", "2026-09")).toBe(false);
  });

  it("يرفض الصيغة الخاطئة", () => {
    expect(canFreezePeriod("2026-8", "2026-09")).toBe(false);
  });

  it("الشهر السابق، ويلتفّ عند يناير", () => {
    expect(previousPeriod(new Date(2026, 8, 5))).toBe("2026-08");
    expect(previousPeriod(new Date(2026, 0, 5))).toBe("2025-12");
  });
});
