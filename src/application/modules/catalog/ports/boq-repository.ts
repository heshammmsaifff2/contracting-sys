import type { DomainError } from "@core/shared/errors/domain-error";
import type { Result } from "@core/shared/result";
import type {
  BoqComponentDto,
  BoqItemDto,
  CreateBoqItemDto,
  SetBoqComponentsDto,
  UpdateBoqItemDto,
} from "../dtos";

export interface IBoqRepository {
  search(
    query: string,
    limit?: number,
  ): Promise<Result<readonly BoqItemDto[], DomainError>>;
  create(input: CreateBoqItemDto): Promise<Result<BoqItemDto, DomainError>>;
  update(input: UpdateBoqItemDto): Promise<Result<BoqItemDto, DomainError>>;
  remove(id: string): Promise<Result<void, DomainError>>;
  /** تكوين البند من أصناف. */
  listComponents(
    boqItemId: string,
  ): Promise<Result<readonly BoqComponentDto[], DomainError>>;
  setComponents(input: SetBoqComponentsDto): Promise<Result<void, DomainError>>;
}
