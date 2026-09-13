import { describe, expect, it } from "vitest";
import { matchesArabic } from "./arabic-search";

describe("matchesArabic — بحث عربيّ متسامح", () => {
  it("يتجاهل التشكيل", () => {
    expect(matchesArabic("مُدير المشروع", "مدير")).toBe(true);
  });

  it("يطوي الهمزات والتاء المربوطة", () => {
    expect(matchesArabic("الإدارة الهندسية", "الاداره")).toBe(true);
  });

  it("يطوي الألف المقصورة", () => {
    expect(matchesArabic("مصطفى", "مصطفي")).toBe(true);
  });

  /** مدى التشكيل يجاور الأرقام الهندية؛ مدًى أوسع بحرف يمحوها فيضيع البحث بالرقم. */
  it("لا يمحو الأرقام الهندية", () => {
    expect(matchesArabic("مهندس موقع ٢", "٢")).toBe(true);
    expect(matchesArabic("مهندس موقع ٢", "٣")).toBe(false);
  });

  it("لا يفرّق بين الحروف الإنجليزية الكبيرة والصغيرة", () => {
    expect(matchesArabic("Ahmed Farouk", "ahm")).toBe(true);
  });

  it("البحث الفارغ يطابق كل شيء، والمختلف لا يطابق", () => {
    expect(matchesArabic("مهندس", "   ")).toBe(true);
    expect(matchesArabic("مهندس", "محاسب")).toBe(false);
  });
});
