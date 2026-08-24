import type { DomainError } from "@core/shared/errors/domain-error";
import type { Result } from "@core/shared/result";
import type { UseCase } from "@application/shared/use-case";
import type { PermissionDto } from "../dtos";
import type { IRoleRepository } from "../ports/role-repository";

export class ListPermissions implements UseCase<void, readonly PermissionDto[]> {
  private readonly roles: IRoleRepository;

  constructor(roles: IRoleRepository) {
    this.roles = roles;
  }

  async execute(): Promise<Result<readonly PermissionDto[], DomainError>> {
    return this.roles.listPermissions();
  }
}
