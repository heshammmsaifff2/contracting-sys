import type { DomainError } from "@core/shared/errors/domain-error";
import { ValidationError } from "@core/shared/errors/domain-error";
import { err, type Result } from "@core/shared/result";
import type { UseCase } from "@application/shared/use-case";
import type { RoleDto, UpdateRoleInput } from "../dtos";
import type { IRoleRepository } from "../ports/role-repository";

export class UpdateRole implements UseCase<UpdateRoleInput, RoleDto> {
  private readonly roles: IRoleRepository;

  constructor(roles: IRoleRepository) {
    this.roles = roles;
  }

  async execute(input: UpdateRoleInput): Promise<Result<RoleDto, DomainError>> {
    const name = input.name.trim();
    if (name.length < 2) {
      return err(new ValidationError("اسم الدور مطلوب ويجب أن يتكون من حرفين على الأقل", { name: "required" }));
    }

    const description = input.description?.trim() || null;

    const updateResult = await this.roles.updateRole({
      id: input.id,
      name,
      description,
    });

    if (!updateResult.ok) return updateResult;

    if (input.permissionIds !== undefined) {
      const permResult = await this.roles.setRolePermissions(
        input.id,
        input.permissionIds,
      );
      if (!permResult.ok) return permResult;
    }

    return updateResult;
  }
}
