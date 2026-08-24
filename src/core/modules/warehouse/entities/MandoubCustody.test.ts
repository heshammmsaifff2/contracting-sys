import { describe, expect, it } from "vitest";
import {
  MandoubCustody,
  validateAgainstCustody,
  validateStockLines,
} from "./MandoubCustody";

describe("MandoubCustody — عهدة المندوب", () => {
  it("تغطّي الكمية متى كان الرصيد كافيًا", () => {
    const custody = new MandoubCustody("p1", "u1", "i1", 10);
    expect(custody.covers(10)).toBe(true);
    expect(custody.covers(10.5)).toBe(false);
    expect(custody.covers(0)).toBe(false);
    expect(custody.isEmpty).toBe(false);
  });

  it("العهدة الفارغة لا تغطّي شيئًا", () => {
    const custody = new MandoubCustody("p1", "u1", "i1", 0);
    expect(custody.isEmpty).toBe(true);
    expect(custody.covers(1)).toBe(false);
  });
});

describe("validateStockLines — قواعد سند الحركة", () => {
  it("يرفض السند الفارغ", () => {
    const result = validateStockLines([]);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.fields.lines).toBe("empty");
  });

  it("يرفض الكمية الصفرية أو السالبة", () => {
    expect(validateStockLines([{ itemId: "i1", qty: 0 }]).ok).toBe(false);
    expect(validateStockLines([{ itemId: "i1", qty: -3 }]).ok).toBe(false);
  });

  it("يرفض تكرار الصنف في السند نفسه", () => {
    const result = validateStockLines([
      { itemId: "i1", qty: 2 },
      { itemId: "i1", qty: 3 },
    ]);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.fields.lines).toBe("duplicate");
  });

  it("يقبل سندًا سليمًا", () => {
    expect(
      validateStockLines([
        { itemId: "i1", qty: 2 },
        { itemId: "i2", qty: 3 },
      ]).ok,
    ).toBe(true);
  });
});

describe("validateAgainstCustody — لا تنزيل بلا رصيد", () => {
  const available = new Map([
    ["i1", 10],
    ["i2", 4],
  ]);

  it("يقبل ما تغطّيه العهدة تمامًا", () => {
    expect(
      validateAgainstCustody(
        [
          { itemId: "i1", qty: 10 },
          { itemId: "i2", qty: 1 },
        ],
        available,
      ).ok,
    ).toBe(true);
  });

  it("يرفض ما يتجاوز العهدة ويسمّي الصنف", () => {
    const result = validateAgainstCustody([{ itemId: "i2", qty: 5 }], available);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.fields.itemId).toBe("i2");
    expect(result.error.fields.available).toBe("4");
  });

  it("يرفض صنفًا ليس في العهدة أصلًا", () => {
    expect(validateAgainstCustody([{ itemId: "i9", qty: 1 }], available).ok).toBe(
      false,
    );
  });
});
