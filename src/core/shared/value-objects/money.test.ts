import { describe, expect, it } from "vitest";
import { Money } from "./money";

describe("Money", () => {
  it("يحفظ الدقّة في الجمع المتكرّر (لا أخطاء فاصلة عائمة)", () => {
    const a = Money.create(0.1);
    const b = Money.create(0.2);
    expect(a.ok && b.ok).toBe(true);
    if (!a.ok || !b.ok) return;

    const sum = a.value.add(b.value);
    expect(sum.ok).toBe(true);
    if (!sum.ok) return;
    expect(sum.value.amount).toBe(0.3);
  });

  it("يحسب ضريبة القيمة المضافة كبند منفصل", () => {
    const total = Money.create(1000);
    expect(total.ok).toBe(true);
    if (!total.ok) return;

    const vat = total.value.percentage(15);
    expect(vat.ok).toBe(true);
    if (!vat.ok) return;
    expect(vat.value.amount).toBe(150);
  });

  it("يرفض الجمع بين عملتين مختلفتين بدل رمي استثناء", () => {
    const sar = Money.create(100, "SAR");
    const usd = Money.create(100, "USD");
    if (!sar.ok || !usd.ok) throw new Error("setup failed");

    const sum = sar.value.add(usd.value);
    expect(sum.ok).toBe(false);
    if (sum.ok) return;
    expect(sum.error.code).toBe("VALIDATION");
  });

  it("يرفض المبالغ غير الرقمية", () => {
    const bad = Money.create(Number.NaN);
    expect(bad.ok).toBe(false);
  });
});
