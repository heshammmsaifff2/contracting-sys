import type { DomainError } from "@core/shared/errors/domain-error";
import { ValidationError } from "@core/shared/errors/domain-error";
import { err, type Result } from "@core/shared/result";
import type { UseCase } from "@application/shared/use-case";
import type { IRoleRepository } from "../ports/role-repository";

export interface SetRolePermissionsInput {
  roleId: string;
  permissionIds: readonly string[];
}

/**
 * يستبدل صلاحيات الدور بالكامل.
 * ملاحظة: لا نمنع تفريغ دور النظام هنا لأن الحماية الحقيقية في RLS،
 * لكن نمنع تمرير مُعرّفات مكرّرة لتفادي أخطاء المفتاح المركّب.
 */
export class SetRolePermissions implements UseCase<SetRolePermissionsInput, void> {
  private readonly roles: IRoleRepository;

  constructor(roles: IRoleRepository) {
    this.roles = roles;
  }

  async execute(input: SetRolePermissionsInput): Promise<Result<void, DomainError>> {
    if (input.roleId.trim().length === 0) {
      return err(new ValidationError("الدور مطلوب", { roleId: "required" }));
    }

    const unique = [...new Set(input.permissionIds)];
    return this.roles.setRolePermissions(input.roleId, unique);
  }
}
