import type { DomainError } from "@core/shared/errors/domain-error";
import type { Result } from "@core/shared/result";
import type { UseCase } from "@application/shared/use-case";
import type { SettingDto } from "../dtos";
import type { ISettingsRepository } from "../ports/settings-repository";

export class ListSettings implements UseCase<void, readonly SettingDto[]> {
  private readonly settings: ISettingsRepository;

  constructor(settings: ISettingsRepository) {
    this.settings = settings;
  }

  async execute(): Promise<Result<readonly SettingDto[], DomainError>> {
    return this.settings.list();
  }
}
