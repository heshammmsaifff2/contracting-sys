import { Role } from "@core/modules/identity/entities/Role";
import type { UseCase } from "@application/shared/use-case";
import type { CreateRoleInput, RoleDto } from "../dtos";
import type { IRoleRepository } from "../ports/role-repository";

const PLACEHOLDER_ID = "00000000-0000-0000-0000-000000000000";

export class CreateRole implements UseCase<CreateRoleInput, RoleDto> {
  private readonly roles: IRoleRepository;

  constructor(roles: IRoleRepository) {
    this.roles = roles;
  }

  async execute(input: CreateRoleInput) {
    const key = input.key.trim().toLowerCase();
    const name = input.name.trim();
    const description = input.description?.trim() || null;
    const now = new Date();

    const validated = Role.create({
      id: PLACEHOLDER_ID,
      key,
      name,
      description,
      isSystem: false,
      permissionKeys: [],
      createdAt: now,
      updatedAt: now,
      createdBy: null,
    });

    if (!validated.ok) return validated;

    const createResult = await this.roles.createRole({
      key: validated.value.key,
      name: validated.value.name,
      description: validated.value.description,
    });

    if (!createResult.ok) return createResult;

    if (input.permissionIds && input.permissionIds.length > 0) {
      const permResult = await this.roles.setRolePermissions(
        createResult.value.id,
        input.permissionIds,
      );
      if (!permResult.ok) return permResult;
    }

    return createResult;
  }
}
