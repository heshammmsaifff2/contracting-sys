import type { DomainError } from "@core/shared/errors/domain-error";
import type { Result } from "@core/shared/result";
import type { ModuleStatusDto } from "../dtos/system-info";

export interface ISystemInfoRepository {
  listModules(): Promise<Result<readonly ModuleStatusDto[], DomainError>>;
}
