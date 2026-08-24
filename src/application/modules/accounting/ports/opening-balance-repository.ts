import type { DomainError } from "@core/shared/errors/domain-error";
import type { Result } from "@core/shared/result";
import type { CreateOpeningBalanceDto, OpeningBalanceDto } from "../dtos";

export interface IOpeningBalanceRepository {
  list(): Promise<Result<readonly OpeningBalanceDto[], DomainError>>;
  findById(id: string): Promise<Result<OpeningBalanceDto | null, DomainError>>;
  create(
    input: CreateOpeningBalanceDto,
  ): Promise<Result<OpeningBalanceDto, DomainError>>;
  approve(id: string): Promise<Result<OpeningBalanceDto, DomainError>>;
  remove(id: string): Promise<Result<void, DomainError>>;
}
