import type { DomainError } from "@core/shared/errors/domain-error";
import type { Result } from "@core/shared/result";
import type { UseCase } from "@application/shared/use-case";
import type { ProfileDto } from "../dtos";
import type { IProfileRepository } from "../ports/profile-repository";

/** RLS تُرجع كل الموظفين لمن يملك user.read فقط، وإلا فملفه هو. */
export class ListProfiles implements UseCase<void, readonly ProfileDto[]> {
  private readonly profiles: IProfileRepository;

  constructor(profiles: IProfileRepository) {
    this.profiles = profiles;
  }

  async execute(): Promise<Result<readonly ProfileDto[], DomainError>> {
    return this.profiles.list();
  }
}
