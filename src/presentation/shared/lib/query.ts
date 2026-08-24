/**
 * جسر بين نمط Result في طبقة التطبيق ونمط الاستثناءات الذي يتوقّعه react-query.
 * التحويل يحدث هنا فقط — الـ use-cases تبقى بلا استثناءات.
 */
import type { DomainError } from "@core/shared/errors/domain-error";
import type { Result } from "@core/shared/result";
import { t } from "@i18n/index";

/** Unwrap a Result for react-query, throwing on failure. */
export function unwrap<T>(result: Result<T, DomainError>): T {
  if (!result.ok) throw result.error;
  return result.value;
}

/** رسالة عربية مناسبة لأي خطأ يصل إلى الواجهة. */
export function errorMessage(error: unknown): string {
  if (error instanceof Error && "code" in error) {
    const code = (error as DomainError).code;
    return error.message || t.errors[code] || t.errors.UNEXPECTED;
  }
  return t.errors.UNEXPECTED;
}
