import type { DomainError } from "@core/shared/errors/domain-error";
import type { Result } from "@core/shared/result";
import type { UseCase } from "@application/shared/use-case";
import type { RoleDto } from "../dtos";
import type { IRoleRepository } from "../ports/role-repository";

export class ListRoles implements UseCase<void, readonly RoleDto[]> {
  private readonly roles: IRoleRepository;

  constructor(roles: IRoleRepository) {
    this.roles = roles;
  }

  async execute(): Promise<Result<readonly RoleDto[], DomainError>> {
    return this.roles.listRoles();
  }
}
