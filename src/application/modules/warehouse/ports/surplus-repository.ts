import type { DomainError } from "@core/shared/errors/domain-error";
import type { Result } from "@core/shared/result";
import type { SaveSurplusDto, SurplusMaterialDto } from "../dtos";

export interface ISurplusRepository {
  list(
    projectId: string | null,
  ): Promise<Result<readonly SurplusMaterialDto[], DomainError>>;
  save(input: SaveSurplusDto): Promise<Result<SurplusMaterialDto, DomainError>>;
  remove(id: string): Promise<Result<void, DomainError>>;
}
