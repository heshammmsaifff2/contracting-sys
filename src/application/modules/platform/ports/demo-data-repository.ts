import type { DomainError } from "@core/shared/errors/domain-error";
import type { Result } from "@core/shared/result";
import type { DemoDataStatusDto } from "../dtos/demo-data";

/**
 * منفذ النسخة الاختبارية.
 *
 * التوليد والحذف دالّتان في Postgres لا منطق في المتصفّح: النسخة يجب أن
 * تمرّ بمحرّك الترحيل نفسه وتخضع للقيود نفسها، وإلا تدرّب الموظف على نظام
 * غير النظام. وحدود الصلاحية داخل الدالّتين لا هنا.
 */
export interface IDemoDataRepository {
  status(): Promise<Result<DemoDataStatusDto, DomainError>>;
  seed(): Promise<Result<{ trackedRows: number }, DomainError>>;
  clear(): Promise<Result<{ removedRows: number }, DomainError>>;
}
