import type { DomainError } from "@core/shared/errors/domain-error";
import type { Result } from "@core/shared/result";
import type { UseCase } from "@application/shared/use-case";
import type { IProfileRepository } from "../ports/profile-repository";

export interface SetProfileActiveInput {
  id: string;
  isActive: boolean;
}

/** التعطيل بديل الحذف — لحفظ تاريخ المستندات المرتبطة بالموظف. */
export class SetProfileActive implements UseCase<SetProfileActiveInput, void> {
  private readonly profiles: IProfileRepository;

  constructor(profiles: IProfileRepository) {
    this.profiles = profiles;
  }

  async execute(input: SetProfileActiveInput): Promise<Result<void, DomainError>> {
    return this.profiles.setActive(input.id, input.isActive);
  }
}
