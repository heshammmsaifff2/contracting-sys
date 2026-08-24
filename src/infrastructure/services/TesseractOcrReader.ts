/**
 * TesseractOcrReader — تحقيق منفذ OCR بمحرّك Tesseract.js (مجّاني، بلا خدمة خارجية).
 * يعمل في المتصفّح: الصورة لا تغادر جهاز المستخدم للمسح، وما يُرسَل للخادم
 * هو الحقول والنص المستخرج. المحرّك ثقيل التحميل، فيُنشأ مرة ويُعاد استخدامه.
 */
import type { Worker } from "tesseract.js";
import type { DomainError } from "@core/shared/errors/domain-error";
import { toDomainError } from "@core/shared/errors/domain-error";
import { err, ok, type Result } from "@core/shared/result";
import type {
  IOcrReader,
  OcrProgress,
  OcrResult,
} from "@application/shared/ports/ocr-reader";

/** العربية أولًا ثم الإنجليزية: فواتير السوق تخلط الاثنين. */
const LANGUAGES = "ara+eng";

export class TesseractOcrReader implements IOcrReader {
  private workerPromise: Promise<Worker> | null = null;

  async readImage(
    file: File,
    onProgress?: (progress: OcrProgress) => void,
  ): Promise<Result<OcrResult, DomainError>> {
    try {
      const worker = await this.getWorker(onProgress);
      const { data } = await worker.recognize(file);

      return ok({
        text: data.text,
        confidence: Math.round(data.confidence),
      });
    } catch (e) {
      return err(toDomainError(e, "تعذّر قراءة صورة الفاتورة"));
    }
  }

  /** تحرير الذاكرة عند إغلاق الشاشة — المحرّك يحجز عدّة ميجابايت. */
  async dispose(): Promise<void> {
    const pending = this.workerPromise;
    this.workerPromise = null;
    if (pending === null) return;
    const worker = await pending;
    await worker.terminate();
  }

  /**
   * المحرّك يُحمَّل عند أول مسح لا عند بدء التطبيق (import ديناميكي)،
   * فلا يدفع ثمنَه من لا يفتح شاشة العهد.
   */
  private getWorker(onProgress?: (progress: OcrProgress) => void): Promise<Worker> {
    if (this.workerPromise === null) {
      this.workerPromise = import("tesseract.js").then((module) =>
        module.createWorker(LANGUAGES, undefined, {
          logger: (message: { progress?: number; status?: string }) => {
            onProgress?.({
              ratio: message.progress ?? 0,
              status: message.status ?? "",
            });
          },
        }),
      );
    }
    return this.workerPromise;
  }
}
