import type { DomainError } from "@core/shared/errors/domain-error";
import type { Result } from "@core/shared/result";
import type { FacilityDto, SaveFacilityDto } from "../dtos";

export interface IFacilityRepository {
  list(projectId: string | null): Promise<Result<readonly FacilityDto[], DomainError>>;
  save(input: SaveFacilityDto): Promise<Result<FacilityDto, DomainError>>;
  remove(id: string): Promise<Result<void, DomainError>>;
}
