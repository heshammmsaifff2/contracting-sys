import type { DomainError } from "@core/shared/errors/domain-error";
import type { Result } from "@core/shared/result";
import type { UseCase } from "@application/shared/use-case";
import type { OpeningBalanceDto } from "../dtos";
import type { IOpeningBalanceRepository } from "../ports/opening-balance-repository";

export class ListOpeningBalances implements UseCase<
  void,
  readonly OpeningBalanceDto[]
> {
  private readonly balances: IOpeningBalanceRepository;

  constructor(balances: IOpeningBalanceRepository) {
    this.balances = balances;
  }

  async execute(): Promise<Result<readonly OpeningBalanceDto[], DomainError>> {
    return this.balances.list();
  }
}
