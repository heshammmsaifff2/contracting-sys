import type { DomainError } from "@core/shared/errors/domain-error";
import type { Result } from "@core/shared/result";
import type { PermissionDto, RoleDto } from "../dtos";

export interface IRoleRepository {
  listRoles(): Promise<Result<readonly RoleDto[], DomainError>>;
  listPermissions(): Promise<Result<readonly PermissionDto[], DomainError>>;
  /** يستبدل صلاحيات الدور بالكامل بالمجموعة الممرَّرة. */
  setRolePermissions(
    roleId: string,
    permissionIds: readonly string[],
  ): Promise<Result<void, DomainError>>;
  assignRoleToUser(userId: string, roleId: string): Promise<Result<void, DomainError>>;
  removeRoleFromUser(
    userId: string,
    roleId: string,
  ): Promise<Result<void, DomainError>>;
}
