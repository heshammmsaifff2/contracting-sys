/**
 * منفذ تخزين الملفّات — الواجهة لا تعرف أن المزوّد هو Cloudinary.
 * الرفع يتم بتوقيع آمن: الخادم يُصدر التوقيع، والمتصفّح يرفع مباشرة للمزوّد.
 */
import type { DomainError } from "@core/shared/errors/domain-error";
import type { Result } from "@core/shared/result";

/** ما يُخزَّن في قاعدة البيانات — لا الملف نفسه. */
export interface StoredFile {
  publicId: string;
  url: string;
}

/** توقيع مؤقّت صادر عن الخادم للرفع المباشر. */
export interface UploadTicket {
  uploadUrl: string;
  params: Record<string, string>;
}

export interface UploadUrlOptions {
  width?: number;
  height?: number;
  quality?: number;
  /** أصل خاص يتطلّب رابطًا موقّعًا (عقود، فواتير). */
  authenticated?: boolean;
}

export interface CreateUploadTicketInput {
  /** مجلّد منظّم حسب الوحدة والمشروع، مثل: erp/{project_id}/invoices */
  folder: string;
  /** للمستندات الحسّاسة: أصل خاص بدل عام. */
  authenticated?: boolean;
}

export interface IFileStorage {
  /** يُصدر توقيعًا مؤقّتًا عبر Edge Function للرفع المباشر من المتصفّح. */
  createUploadTicket(
    input: CreateUploadTicketInput,
  ): Promise<Result<UploadTicket, DomainError>>;

  /** تحويل publicId إلى رابط عرض مع تحويلات اختيارية. */
  buildUrl(publicId: string, opts?: UploadUrlOptions): string;

  /** رفع الملف فعليًا باستخدام التذكرة، وإرجاع مرجع التخزين. */
  upload(ticket: UploadTicket, file: File): Promise<Result<StoredFile, DomainError>>;

  /** الحذف يمرّ عبر Edge Function لأنه يتطلّب api_secret على الخادم. */
  remove(publicId: string): Promise<Result<void, DomainError>>;
}
