import { describe, expect, it } from "vitest";
import { createElement } from "react";
import { toCsv, type CsvColumn } from "./csv";

interface Row {
  name: string;
  amount: number;
  note: string;
}

const rows: readonly Row[] = [
  { name: "مورّد الأسمنت", amount: 2050, note: "عادي" },
  // الفاصلة وعلامة الاقتباس والسطر الجديد: ثلاثة ما يكسر CSV غير المقتبَس
  { name: 'شركة "الوفاء", ش.م.م', amount: 0, note: "سطر\nثانٍ" },
];

const columns: readonly CsvColumn<Row>[] = [
  { header: "الاسم", render: (r) => r.name },
  { header: "القيمة", render: (r) => r.amount },
  { header: "ملاحظة", render: (r) => r.note },
];

describe("toCsv", () => {
  it("يقتبس كل الحقول ويضاعف علامة الاقتباس بداخلها", () => {
    const csv = toCsv(columns, rows);
    const lines = csv.split("\r\n");

    expect(lines[0]).toBe('"الاسم","القيمة","ملاحظة"');
    expect(lines[1]).toBe('"مورّد الأسمنت","2050","عادي"');
    expect(lines[2]).toBe('"شركة ""الوفاء"", ش.م.م","0","سطر ثانٍ"');
  });

  it("يُبقي عدد الأسطر مساويًا للصفوف + الترويسة", () => {
    expect(toCsv(columns, rows).split("\r\n")).toHaveLength(3);
    expect(toCsv(columns, []).split("\r\n")).toHaveLength(1);
  });

  it("يستخرج نص العناصر لا يطبع [object Object]", () => {
    // الأعمدة الحقيقية تعيد شارات ووسومًا لا نصًّا خامًا
    const withElements: readonly CsvColumn<Row>[] = [
      {
        header: "شارة",
        render: (r) => createElement("span", { className: "badge" }, r.name),
      },
    ];

    const csv = toCsv(withElements, [rows[0] as Row]);

    expect(csv.split("\r\n")[1]).toBe('"مورّد الأسمنت"');
    expect(csv).not.toContain("object Object");
  });

  it("الأيقونة بلا نص تسقط بلا ضجيج بدل أن تُفسد الخلية", () => {
    const iconOnly: readonly CsvColumn<Row>[] = [
      {
        header: "حالة",
        render: () => createElement("span", null, createElement("svg"), "متأخّرة"),
      },
    ];

    expect(toCsv(iconOnly, [rows[0] as Row]).split("\r\n")[1]).toBe('"متأخّرة"');
  });

  it("القيم الفارغة تُصبح خلية فارغة لا كلمة null", () => {
    const nullable: readonly CsvColumn<Row>[] = [
      { header: "فارغ", render: () => null },
      { header: "غير معرَّف", render: () => undefined },
    ];

    expect(toCsv(nullable, [rows[0] as Row]).split("\r\n")[1]).toBe('"",""');
  });
});
