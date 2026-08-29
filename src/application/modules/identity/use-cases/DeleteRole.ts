import type { DomainError } from "@core/shared/errors/domain-error";
import { ConflictError, NotFoundError } from "@core/shared/errors/domain-error";
import { err, okVoid, type Result } from "@core/shared/result";
import type { UseCase } from "@application/shared/use-case";
import type { DeleteRoleInput } from "../dtos";
import type { IRoleRepository } from "../ports/role-repository";

export class DeleteRole implements UseCase<DeleteRoleInput, void> {
  private readonly roles: IRoleRepository;

  constructor(roles: IRoleRepository) {
    this.roles = roles;
  }

  async execute(input: DeleteRoleInput): Promise<Result<void, DomainError>> {
    const rolesResult = await this.roles.listRoles();
    if (!rolesResult.ok) return rolesResult;

    const targetRole = rolesResult.value.find((r) => r.id === input.id);
    if (!targetRole) {
      return err(new NotFoundError("الدور", input.id));
    }

    if (targetRole.isSystem) {
      return err(new ConflictError("لا يمكن حذف أدوار النظام الأساسية"));
    }

    const countResult = await this.roles.getUsersCountForRole(input.id);
    if (!countResult.ok) return countResult;

    if (countResult.value > 0) {
      return err(
        new ConflictError(
          `لا يمكن حذف هذا الدور لأنه مُسنَد إلى ${countResult.value} من الموظفين حالياً. يرجى إزالة الدور من الموظفين أولاً.`,
        ),
      );
    }

    const deleteResult = await this.roles.deleteRole(input.id);
    if (!deleteResult.ok) return deleteResult;

    return okVoid();
  }
}
