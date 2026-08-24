import type { DomainError } from "@core/shared/errors/domain-error";
import { ValidationError } from "@core/shared/errors/domain-error";
import { err, type Result } from "@core/shared/result";
import type { UseCase } from "@application/shared/use-case";
import type { ISettingsRepository } from "../ports/settings-repository";

export interface UpdateSettingInput {
  key: string;
  value: unknown;
}

export class UpdateSetting implements UseCase<UpdateSettingInput, void> {
  private readonly settings: ISettingsRepository;

  constructor(settings: ISettingsRepository) {
    this.settings = settings;
  }

  async execute(input: UpdateSettingInput): Promise<Result<void, DomainError>> {
    if (input.key.trim().length === 0) {
      return err(new ValidationError("مفتاح الإعداد مطلوب", { key: "required" }));
    }
    if (input.value === undefined) {
      return err(new ValidationError("قيمة الإعداد مطلوبة", { value: "required" }));
    }

    return this.settings.update(input.key, input.value);
  }
}
