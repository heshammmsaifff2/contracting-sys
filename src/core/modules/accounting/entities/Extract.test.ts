import { describe, expect, it } from "vitest";
import {
  canApproveExtract,
  completionRatio,
  computeDeductions,
  computeGross,
  computeNet,
  remainingQty,
  validateLineQty,
} from "./Extract";

describe("Extract — حد العقد والكميات السابقة [الحسابات 18]", () => {
  it("المتبقّي = الحد − (السابق + الحالي)", () => {
    expect(remainingQty(100, 40, 60)).toBe(0);
    expect(remainingQty(100, 40, 20)).toBe(40);
  });

  it("لا يعطي متبقّيًا سالبًا", () => {
    expect(remainingQty(100, 90, 30)).toBe(0);
  });

  it("يقبل الكمية التي تستهلك الحد بالضبط", () => {
    expect(
      validateLineQty({ unitPrice: 1000, maxQty: 100, prevQty: 40, currentQty: 60 }).ok,
    ).toBe(true);
  });

  it("يرفض ما يتجاوز الحد ويسمّي المتبقّي", () => {
    const result = validateLineQty({
      unitPrice: 1000,
      maxQty: 100,
      prevQty: 40,
      currentQty: 61,
    });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.fields.currentQty).toBe("exceeds_contract");
    expect(result.error.fields.remaining).toBe("60");
  });

  it("نسبة التنفيذ التراكمية تجمع السابق والحالي", () => {
    expect(completionRatio(100, 40, 20)).toBeCloseTo(0.6, 5);
    expect(completionRatio(0, 0, 0)).toBeNull();
  });
});

describe("Extract — الإجمالي والاستقطاعات والصافي [الحسابات 19]", () => {
  const lines = [
    { unitPrice: 1000, maxQty: 100, prevQty: 0, currentQty: 40 },
    { unitPrice: 250.5, maxQty: 50, prevQty: 0, currentQty: 4 },
  ];

  it("الإجمالي = مجموع (الكمية × السعر)", () => {
    expect(computeGross(lines)).toBe(41002);
  });

  it("كل استقطاع نسبة من الإجمالي، والمعطّل لا يُحتسب", () => {
    const deductions = computeDeductions(40000, [
      { key: "retention", name: "ضمان", rate: 5 },
      { key: "tax", name: "ضريبة", rate: 1 },
      { key: "insurance", name: "تأمينات", rate: 0 },
    ]);

    expect(deductions).toHaveLength(2);
    expect(deductions[0]?.amount).toBe(2000);
    expect(deductions[1]?.amount).toBe(400);
  });

  it("الصافي = الإجمالي − الاستقطاعات", () => {
    const deductions = computeDeductions(40000, [
      { key: "retention", name: "ضمان", rate: 5 },
      { key: "tax", name: "ضريبة", rate: 1 },
    ]);
    expect(computeNet(40000, deductions)).toBe(37600);
  });

  it("الختامي يردّ الضمان المحتجز فيزيد الصافي", () => {
    const deductions = computeDeductions(60000, [
      { key: "retention", name: "ضمان", rate: 5 },
      { key: "tax", name: "ضريبة", rate: 1 },
    ]);
    expect(computeNet(60000, deductions, 2000)).toBe(58400);
  });

  it("لا يُعتمد مستخلص معتمَد ولا مستخلص بقيمة صفر", () => {
    expect(canApproveExtract("approved", 1000).ok).toBe(false);
    expect(canApproveExtract("draft", 0).ok).toBe(false);
    expect(canApproveExtract("draft", 1000).ok).toBe(true);
  });
});
