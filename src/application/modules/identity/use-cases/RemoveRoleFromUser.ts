import type { DomainError } from "@core/shared/errors/domain-error";
import type { Result } from "@core/shared/result";
import type { UseCase } from "@application/shared/use-case";
import type { IRoleRepository } from "../ports/role-repository";
import type { UserRoleInput } from "./AssignRoleToUser";

export class RemoveRoleFromUser implements UseCase<UserRoleInput, void> {
  private readonly roles: IRoleRepository;

  constructor(roles: IRoleRepository) {
    this.roles = roles;
  }

  async execute(input: UserRoleInput): Promise<Result<void, DomainError>> {
    return this.roles.removeRoleFromUser(input.userId, input.roleId);
  }
}
