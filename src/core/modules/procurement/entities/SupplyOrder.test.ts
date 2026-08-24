import { describe, expect, it } from "vitest";
import { SupplyOrder } from "./SupplyOrder";

const LINES = [
  { qty: 30, unitPrice: 1000 }, // 30,000
  { qty: 30, unitPrice: 2000 }, // 60,000
];

describe("SupplyOrder — الضريبة بند منفصل [المشتريات 12]", () => {
  it("يحسب الصافي والضريبة 14٪ والإجمالي", () => {
    const totals = SupplyOrder.computeTotals(LINES, 14, "EGP");

    expect(totals.ok).toBe(true);
    if (!totals.ok) return;
    expect(totals.value.subtotal.amount).toBe(90000);
    expect(totals.value.vat.amount).toBe(12600);
    expect(totals.value.total.amount).toBe(102600);
  });

  it("نسبة صفر تعني بلا ضريبة", () => {
    const totals = SupplyOrder.computeTotals(LINES, 0, "EGP");

    expect(totals.ok).toBe(true);
    if (!totals.ok) return;
    expect(totals.value.vat.isZero).toBe(true);
    expect(totals.value.total.amount).toBe(90000);
  });

  it("يحفظ الدقّة في الكسور", () => {
    const totals = SupplyOrder.computeTotals([{ qty: 3, unitPrice: 33.33 }], 14, "EGP");

    expect(totals.ok).toBe(true);
    if (!totals.ok) return;
    expect(totals.value.subtotal.amount).toBe(99.99);
    expect(totals.value.vat.amount).toBe(14);
    expect(totals.value.total.amount).toBe(113.99);
  });

  it("يرفض نسبة ضريبة سالبة", () => {
    expect(SupplyOrder.computeTotals(LINES, -1, "EGP").ok).toBe(false);
  });
});
