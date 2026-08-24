import { describe, expect, it } from "vitest";
import {
  Facility,
  consumptionPerWeight,
  isWasteful,
  wasteDeviationRatio,
} from "./Facility";

describe("Facility — الوزن النسبي وكشف الهدر [المخازن 9]", () => {
  it("يرفض وزنًا صفريًا أو سالبًا", () => {
    const result = Facility.create({
      id: "f1",
      projectId: "p1",
      code: "F-1",
      name: "منشأة",
      weight: 0,
    });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.fields.weight).toBe("invalid");
  });

  it("يبني المسار الكامل: تجمّع ← حي ← منشأة", () => {
    const result = Facility.create({
      id: "f1",
      projectId: "p1",
      code: "F-1",
      groupName: "تجمّع أ",
      district: "حي 3",
      name: "مدرسة",
      weight: 12,
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.fullPath).toBe("تجمّع أ ← حي 3 ← مدرسة");
    expect(result.value.canReceiveConsumption).toBe(true);
  });

  it("يتجاهل المستويات الفارغة في المسار", () => {
    const result = Facility.create({
      id: "f1",
      projectId: "p1",
      code: "F-1",
      name: "مدرسة",
      weight: 1,
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.fullPath).toBe("مدرسة");
  });

  it("الاستهلاك لكل وحدة وزن يساوي الكمية ÷ الوزن", () => {
    expect(consumptionPerWeight(20, 10)).toBe(2);
    expect(consumptionPerWeight(20, 40)).toBe(0.5);
  });

  it("لا يقسم على وزن غير صالح", () => {
    expect(consumptionPerWeight(20, 0)).toBeNull();
    expect(consumptionPerWeight(20, -1)).toBeNull();
  });

  it("المنشأة الصغيرة التي استهلكت كالكبيرة تُعدّ هدرًا", () => {
    // منشأتان استهلكتا 20 كلٌّ منهما، بوزنَي 10 و40 ⇒ المتوسط 1.25
    const small = consumptionPerWeight(20, 10);
    const large = consumptionPerWeight(20, 40);
    const average = ((small ?? 0) + (large ?? 0)) / 2;

    const smallRatio = wasteDeviationRatio(small, average);
    const largeRatio = wasteDeviationRatio(large, average);

    expect(smallRatio).toBeCloseTo(1.6, 3);
    expect(largeRatio).toBeCloseTo(0.4, 3);
    expect(isWasteful(smallRatio, 1.5)).toBe(true);
    expect(isWasteful(largeRatio, 1.5)).toBe(false);
  });

  it("عتبة أعلى تعني تسامحًا أكبر — والعتبة من الإعدادات لا من الكود", () => {
    const ratio = wasteDeviationRatio(2, 1.25);
    expect(isWasteful(ratio, 1.5)).toBe(true);
    expect(isWasteful(ratio, 2)).toBe(false);
  });

  it("بلا متوسط للمقارنة لا يوجد حكم بالهدر", () => {
    expect(wasteDeviationRatio(2, 0)).toBeNull();
    expect(isWasteful(null, 1.5)).toBe(false);
  });
});
