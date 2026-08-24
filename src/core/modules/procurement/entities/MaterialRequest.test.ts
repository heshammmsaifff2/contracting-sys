import { describe, expect, it } from "vitest";
import { MaterialRequest } from "./MaterialRequest";

describe("MaterialRequest — قاعدة الحد الأقصى [المشتريات 2]", () => {
  it("المتبقّي = الحد الأقصى − (السابق + الحالي)", () => {
    expect(MaterialRequest.computeRemaining(100, 0, 40)).toBe(60);
    expect(MaterialRequest.computeRemaining(100, 40, 30)).toBe(30);
    expect(MaterialRequest.computeRemaining(50, 20, 30)).toBe(0);
  });

  it("بلا حد من المكتب الفني لا يوجد متبقٍّ", () => {
    expect(MaterialRequest.computeRemaining(null, 10, 5)).toBeNull();
  });

  it("يقبل الكمية التي تستهلك الحد بالضبط", () => {
    const result = MaterialRequest.validateLineQuantity(30, 50, 20);
    expect(result.ok).toBe(true);
  });

  it("يرفض الكمية التي تتجاوز الحد", () => {
    const result = MaterialRequest.validateLineQuantity(31, 50, 20);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe("VALIDATION");
    expect(result.error.fields.requestedQty).toBe("exceeds_max");
  });

  it("يقبل أي كمية موجبة لصنف بلا حد", () => {
    expect(MaterialRequest.validateLineQuantity(9999, null, 0).ok).toBe(true);
  });

  it("يرفض الكمية الصفرية أو السالبة", () => {
    expect(MaterialRequest.validateLineQuantity(0, 100, 0).ok).toBe(false);
    expect(MaterialRequest.validateLineQuantity(-5, 100, 0).ok).toBe(false);
  });
});
