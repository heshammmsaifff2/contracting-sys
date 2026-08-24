import type { DomainError } from "@core/shared/errors/domain-error";
import type { Result } from "@core/shared/result";

/**
 * منفذ الترحيل الآلي — السياسة الموحّدة في القسم 8 من المواصفات.
 * التحقيق ينادي Edge Function التي تنادي دالة Postgres، فالقيد يُبنى على الخادم
 * ذرّيًا ولا تلمس الواجهة دفتر اليومية إطلاقًا.
 */
export interface IAccountingPoster {
  post(
    sourceType: string,
    sourceId: string,
  ): Promise<Result<{ entryId: string }, DomainError>>;
}
