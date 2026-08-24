import type { DomainError } from "@core/shared/errors/domain-error";
import type { Result } from "@core/shared/result";

/**
 * يقرأ صلاحيات المستخدم الحالي ومشاريعه المعتمدة عبر دوال قاعدة البيانات،
 * فتكون الواجهة والـ RLS معتمدتين على المصدر نفسه.
 */
export interface IAuthorizationRepository {
  currentPermissions(): Promise<Result<readonly string[], DomainError>>;
  currentProjectIds(): Promise<Result<readonly string[], DomainError>>;
}
