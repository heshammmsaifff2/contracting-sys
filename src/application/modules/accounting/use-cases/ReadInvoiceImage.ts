/**
 * قراءة صورة الفاتورة: مسح ضوئي في المتصفّح ثم استخراج مرشّحي الرقم والقيمة.
 * الغرض تعبئة الحقول لا الحكم: كشف التكرار يجري على الخادم بعد الحفظ،
 * فلو أخطأ المسح أو عُدّل النص يبقى الكشف قائمًا [الحسابات 29].
 */
import type { DomainError } from "@core/shared/errors/domain-error";
import { ok, type Result } from "@core/shared/result";
import { parseInvoiceFields } from "@core/modules/accounting/entities/InvoiceOcr";
import type { UseCase } from "@application/shared/use-case";
import type { IOcrReader, OcrProgress } from "@application/shared/ports/ocr-reader";

export interface ReadInvoiceImageInput {
  file: File;
  onProgress?: (progress: OcrProgress) => void;
}

export interface ReadInvoiceImageOutput {
  text: string;
  confidence: number;
  invoiceNo: string | null;
  amount: number | null;
  amountCandidates: readonly number[];
}

export class ReadInvoiceImage implements UseCase<
  ReadInvoiceImageInput,
  ReadInvoiceImageOutput
> {
  private readonly ocr: IOcrReader;

  constructor(ocr: IOcrReader) {
    this.ocr = ocr;
  }

  async execute(
    input: ReadInvoiceImageInput,
  ): Promise<Result<ReadInvoiceImageOutput, DomainError>> {
    const scanned = await this.ocr.readImage(input.file, input.onProgress);
    if (!scanned.ok) return scanned;

    const fields = parseInvoiceFields(scanned.value.text);

    return ok({
      text: scanned.value.text,
      confidence: scanned.value.confidence,
      invoiceNo: fields.invoiceNo,
      amount: fields.amount,
      amountCandidates: fields.amountCandidates,
    });
  }
}
