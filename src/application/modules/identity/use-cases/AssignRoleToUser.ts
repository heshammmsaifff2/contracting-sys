import type { DomainError } from "@core/shared/errors/domain-error";
import type { Result } from "@core/shared/result";
import type { UseCase } from "@application/shared/use-case";
import type { IRoleRepository } from "../ports/role-repository";

export interface UserRoleInput {
  userId: string;
  roleId: string;
}

export class AssignRoleToUser implements UseCase<UserRoleInput, void> {
  private readonly roles: IRoleRepository;

  constructor(roles: IRoleRepository) {
    this.roles = roles;
  }

  async execute(input: UserRoleInput): Promise<Result<void, DomainError>> {
    return this.roles.assignRoleToUser(input.userId, input.roleId);
  }
}
