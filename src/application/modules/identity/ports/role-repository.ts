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
  createRole(role: {
    key: string;
    name: string;
    description: string | null;
  }): Promise<Result<RoleDto, DomainError>>;
  updateRole(role: {
    id: string;
    name: string;
    description: string | null;
  }): Promise<Result<RoleDto, DomainError>>;
  deleteRole(id: string): Promise<Result<void, DomainError>>;
  getUsersCountForRole(roleId: string): Promise<Result<number, DomainError>>;
  assignRoleToUser(userId: string, roleId: string): Promise<Result<void, DomainError>>;
  removeRoleFromUser(
    userId: string,
    roleId: string,
  ): Promise<Result<void, DomainError>>;
}
