import { describe, expect, it } from "vitest";
import { BoqItem, type BoqComponent } from "./BoqItem";

const CEMENT: BoqComponent = {
  itemId: "11111111-1111-1111-1111-111111111111",
  itemCode: "IT-001",
  itemName: "أسمنت",
  itemUnit: "طن",
  quantityPerUnit: 0.35,
};

const SAND: BoqComponent = {
  itemId: "22222222-2222-2222-2222-222222222222",
  itemCode: "IT-003",
  itemName: "رمل",
  itemUnit: "م3",
  quantityPerUnit: 0.5,
};

const BASE = {
  id: "aaaaaaaa-0000-0000-0000-000000000001",
  code: "BOQ-01",
  name: "خرسانة عادية",
  unit: "م3",
};

describe("BoqItem", () => {
  it("يحسب احتياج الأصناف من كمية البند بلا إدخال يدوي", () => {
    const boq = BoqItem.create({ ...BASE, components: [CEMENT, SAND] });
    expect(boq.ok).toBe(true);
    if (!boq.ok) return;

    const exploded = boq.value.explodeTo(20);
    expect(exploded.ok).toBe(true);
    if (!exploded.ok) return;

    expect(exploded.value).toHaveLength(2);
    expect(exploded.value[0]?.quantity.value).toBe(7); // 0.35 × 20
    expect(exploded.value[0]?.quantity.unit).toBe("طن");
    expect(exploded.value[1]?.quantity.value).toBe(10); // 0.5 × 20
  });

  it("كمية صفر تُنتج احتياجًا صفريًا لا خطأ", () => {
    const boq = BoqItem.create({ ...BASE, components: [CEMENT] });
    if (!boq.ok) return;

    const exploded = boq.value.explodeTo(0);
    expect(exploded.ok).toBe(true);
    if (!exploded.ok) return;
    expect(exploded.value[0]?.quantity.isZero).toBe(true);
  });

  it("يرفض كمية سالبة للبند", () => {
    const boq = BoqItem.create({ ...BASE, components: [CEMENT] });
    if (!boq.ok) return;
    expect(boq.value.explodeTo(-1).ok).toBe(false);
  });

  it("يرفض تكرار الصنف نفسه في التكوين", () => {
    const boq = BoqItem.create({ ...BASE, components: [CEMENT, CEMENT] });
    expect(boq.ok).toBe(false);
    if (boq.ok) return;
    expect(boq.error.code).toBe("VALIDATION");
  });

  it("يرفض كمية غير موجبة داخل التكوين", () => {
    const boq = BoqItem.create({
      ...BASE,
      components: [{ ...CEMENT, quantityPerUnit: 0 }],
    });
    expect(boq.ok).toBe(false);
  });
});
