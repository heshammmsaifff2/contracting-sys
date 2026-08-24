import type { DomainError } from "@core/shared/errors/domain-error";
import type { Result } from "@core/shared/result";
import type { UseCase } from "@application/shared/use-case";
import type { IOpeningBalanceRepository } from "../ports/opening-balance-repository";

/** لا يُحذف إلا غير المعتمَد — المعتمَد له قيد لا يجوز تركه يتيمًا. */
export class DeleteOpeningBalance implements UseCase<{ id: string }, void> {
  private readonly balances: IOpeningBalanceRepository;

  constructor(balances: IOpeningBalanceRepository) {
    this.balances = balances;
  }

  async execute(input: { id: string }): Promise<Result<void, DomainError>> {
    return this.balances.remove(input.id);
  }
}
