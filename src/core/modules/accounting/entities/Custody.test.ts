import { describe, expect, it } from "vitest";
import {
  canApproveCustody,
  custodyTotal,
  unreviewedDuplicates,
  type InvoiceSummary,
} from "./Custody";
import { parseInvoiceFields, toLatinDigits } from "./InvoiceOcr";

function invoice(over: Partial<InvoiceSummary> = {}): InvoiceSummary {
  return {
    amount: 1000,
    isDuplicate: false,
    duplicateReviewed: false,
    isReturned: false,
    ...over,
  };
}

describe("Custody — الإجمالي والمرتجعات", () => {
  it("الفاتورة المرتجعة لا تدخل الإجمالي [الحسابات 30]", () => {
    expect(
      custodyTotal([
        invoice({ amount: 1500 }),
        invoice({ amount: 900, isReturned: true }),
      ]),
    ).toBe(1500);
  });

  it("يعدّ المكرّرات التي تنتظر المراجعة فقط", () => {
    const invoices = [
      invoice({ isDuplicate: true }),
      invoice({ isDuplicate: true, duplicateReviewed: true }),
      invoice({ isDuplicate: true, isReturned: true }),
    ];
    expect(unreviewedDuplicates(invoices)).toBe(1);
  });
});

describe("Custody — قاعدة الاعتماد [الحسابات 29]", () => {
  it("يمنع الاعتماد ما دامت هناك فاتورة مكرّرة لم تُراجَع", () => {
    const result = canApproveCustody("open", false, [
      invoice(),
      invoice({ isDuplicate: true }),
    ]);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.fields.duplicates).toBe("1");
  });

  it("يسمح بالاعتماد بعد المراجعة", () => {
    expect(
      canApproveCustody("open", false, [
        invoice(),
        invoice({ isDuplicate: true, duplicateReviewed: true }),
      ]).ok,
    ).toBe(true);
  });

  it("وعاء المرتجعات لا يُعتمد", () => {
    expect(canApproveCustody("open", true, [invoice()]).ok).toBe(false);
  });

  it("العهدة الفارغة أو المعتمَدة لا تُعتمد", () => {
    expect(canApproveCustody("open", false, []).ok).toBe(false);
    expect(canApproveCustody("approved", false, [invoice()]).ok).toBe(false);
  });
});

describe("InvoiceOcr — استخراج الحقول من نص المسح", () => {
  it("يحوّل الأرقام العربية إلى لاتينية", () => {
    expect(toLatinDigits("١٢٣٤٥٦٧٨٩٠")).toBe("1234567890");
  });

  it("يلتقط رقم الفاتورة من سطر العنوان والقيمة من سطر الإجمالي", () => {
    const fields = parseInvoiceFields(
      [
        "مؤسسة البناء الحديث",
        "فاتورة رقم 4471/أ",
        "بند: أسمنت 20",
        "الإجمالي 1,250.50 جنيه",
      ].join("\n"),
    );

    expect(fields.invoiceNo).toBe("4471/أ");
    expect(fields.amount).toBe(1250.5);
  });

  it("يقرأ الفاتورة المكتوبة بأرقام عربية", () => {
    const fields = parseInvoiceFields("رقم الفاتورة ١٢٣\nالمجموع ٩٠٠");
    expect(fields.invoiceNo).toBe("123");
    expect(fields.amount).toBe(900);
  });

  it("بلا سطر إجمالي يرشّح أكبر مبلغ ويحتفظ بالبدائل", () => {
    const fields = parseInvoiceFields("invoice no INV-7\n100\n2500\n300");
    expect(fields.amount).toBe(2500);
    expect(fields.amountCandidates).toContain(300);
  });

  it("نص بلا أرقام لا يُنتج مرشّحين", () => {
    const fields = parseInvoiceFields("فاتورة غير مقروءة");
    expect(fields.invoiceNo).toBeNull();
    expect(fields.amount).toBeNull();
  });
});
