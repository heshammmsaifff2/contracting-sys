/**
 * قراءة صورة الفاتورة (OCR) — استخراج مرشّحين لرقم الفاتورة وقيمتها من النص.
 * هذا مُعين على التعبئة فقط: الحكم بالتكرار يقع في قاعدة البيانات على
 * الحقول المحفوظة، فلا يتغيّر بجودة المسح ولا يمكن الالتفاف عليه من الواجهة.
 */

/** أرقام عربية ← لاتينية، ليقرأ المحلّل ما مسحه المحرّك بأي شكل. */
export function toLatinDigits(text: string): string {
  return text.replace(/[٠-٩]/g, (d) => String(d.charCodeAt(0) - 0x0660));
}

export interface InvoiceOcrFields {
  invoiceNo: string | null;
  amount: number | null;
  /** المبالغ الأخرى التي وُجدت — يختار منها المستخدم إن أخطأ المرشّح الأول. */
  amountCandidates: readonly number[];
}

const INVOICE_LABELS = [
  "فاتورة رقم",
  "رقم الفاتورة",
  "فاتوره رقم",
  "رقم الفاتوره",
  "invoice no",
  "invoice number",
  "inv no",
  "no.",
];

const TOTAL_LABELS = [
  "الاجمالي",
  "الإجمالي",
  "المجموع",
  "اجمالي",
  "الصافي",
  "total",
  "amount",
  "grand total",
];

/**
 * يستخرج رقم الفاتورة من السطر الذي يحمل عنوانًا دالًّا،
 * والقيمة من سطر الإجمالي، وإلا فأكبر مبلغ في النص (الإجمالي غالبًا).
 */
export function parseInvoiceFields(rawText: string): InvoiceOcrFields {
  const text = toLatinDigits(rawText);
  const lines = text
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.length > 0);

  let invoiceNo: string | null = null;
  let labelledAmount: number | null = null;
  const amounts: number[] = [];

  for (const line of lines) {
    const lower = line.toLowerCase();

    if (invoiceNo === null && INVOICE_LABELS.some((l) => lower.includes(l))) {
      invoiceNo = extractInvoiceNo(line);
    }

    const lineAmounts = extractAmounts(line);
    amounts.push(...lineAmounts);

    if (
      labelledAmount === null &&
      TOTAL_LABELS.some((l) => lower.includes(l)) &&
      lineAmounts.length > 0
    ) {
      labelledAmount = Math.max(...lineAmounts);
    }
  }

  const sorted = [...new Set(amounts)].sort((a, b) => b - a);
  const amount = labelledAmount ?? sorted[0] ?? null;

  return { invoiceNo, amount, amountCandidates: sorted.slice(0, 5) };
}

/** الرمز التالي للعنوان: أرقام وحروف وشرطات، بلا الكلمات المجاورة. */
function extractInvoiceNo(line: string): string | null {
  const afterLabel = line.replace(/^[^0-9A-Za-z]*/, "");
  const match = /([0-9][0-9A-Za-zء-ي/\\-]*)/.exec(afterLabel);
  return match?.[1] ?? null;
}

/** المبالغ: أرقام بفواصل آلاف أو كسور عشرية. */
function extractAmounts(line: string): number[] {
  const matches = line.match(/\d[\d,]*(?:\.\d{1,2})?/g) ?? [];
  return matches
    .map((raw) => Number(raw.replace(/,/g, "")))
    .filter((value) => Number.isFinite(value) && value > 0);
}
