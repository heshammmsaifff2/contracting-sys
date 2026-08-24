import type { DomainError } from "@core/shared/errors/domain-error";
import type { Result } from "@core/shared/result";
import { Profile } from "@core/modules/identity/entities/Profile";
import type { UseCase } from "@application/shared/use-case";
import type { UpdateProfileInput } from "../dtos";
import type { IProfileRepository } from "../ports/profile-repository";

export class UpdateProfile implements UseCase<UpdateProfileInput, Profile> {
  private readonly profiles: IProfileRepository;

  constructor(profiles: IProfileRepository) {
    this.profiles = profiles;
  }

  async execute(input: UpdateProfileInput): Promise<Result<Profile, DomainError>> {
    // نتحقّق بقواعد الدومين قبل لمس قاعدة البيانات
    const validated = Profile.create({
      id: input.id,
      code: input.code,
      fullName: input.fullName,
      employeeType: input.employeeType,
    });
    if (!validated.ok) return validated;

    return this.profiles.update({
      id: input.id,
      fullName: validated.value.fullName,
      code: validated.value.code?.value ?? null,
      employeeType: validated.value.employeeType,
    });
  }
}
