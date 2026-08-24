import type { DomainError } from "@core/shared/errors/domain-error";
import type { Result } from "@core/shared/result";
import type { SettingDto } from "../dtos";

export interface ISettingsRepository {
  list(): Promise<Result<readonly SettingDto[], DomainError>>;
  update(key: string, value: unknown): Promise<Result<void, DomainError>>;
}
