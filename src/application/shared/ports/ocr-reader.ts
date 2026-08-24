/**
 * منفذ قراءة النصوص من الصور (OCR).
 * الواجهة لا تعرف المحرّك (Tesseract اليوم، غيره غدًا)، ولا يُبنى عليه
 * أي قرار أمني: ناتجه يملأ الحقول فقط، والحكم بالتكرار في قاعدة البيانات.
 */
import type { DomainError } from "@core/shared/errors/domain-error";
import type { Result } from "@core/shared/result";

export interface OcrResult {
  text: string;
  /** ثقة المحرّك 0–100 — تُعرض للمستخدم ليقرّر مراجعة ما مُسح. */
  confidence: number;
}

export interface OcrProgress {
  /** 0–1 */
  ratio: number;
  status: string;
}

export interface IOcrReader {
  /** يقرأ صورة (ملف من المستخدم) ويعيد نصّها. */
  readImage(
    file: File,
    onProgress?: (progress: OcrProgress) => void,
  ): Promise<Result<OcrResult, DomainError>>;
}
