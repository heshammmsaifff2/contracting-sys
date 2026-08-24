import type { DomainError } from "@core/shared/errors/domain-error";
import type { Result } from "@core/shared/result";
import { OpeningBalance } from "@core/modules/accounting/entities/OpeningBalance";
import type { CurrencyCode } from "@core/shared/value-objects/money";
import type { IIdGenerator } from "@application/shared/ports/id-generator";
import type { UseCase } from "@application/shared/use-case";
import type { CreateOpeningBalanceDto, OpeningBalanceDto } from "../dtos";
import type { IOpeningBalanceRepository } from "../ports/opening-balance-repository";

export interface CreateOpeningBalanceInput extends CreateOpeningBalanceDto {
  currency: CurrencyCode;
}

export class CreateOpeningBalance implements UseCase<
  CreateOpeningBalanceInput,
  OpeningBalanceDto
> {
  private readonly balances: IOpeningBalanceRepository;
  private readonly ids: IIdGenerator;

  constructor(balances: IOpeningBalanceRepository, ids: IIdGenerator) {
    this.balances = balances;
    this.ids = ids;
  }

  async execute(
    input: CreateOpeningBalanceInput,
  ): Promise<Result<OpeningBalanceDto, DomainError>> {
    // قواعد الدومين ترفض الصفر والتواريخ غير الصالحة قبل أي اتصال
    const validated = OpeningBalance.create({
      id: this.ids.generate(),
      accountId: input.accountId,
      projectId: input.projectId,
      amount: input.amount,
      currency: input.currency,
      asOf: new Date(input.asOf),
      notes: input.notes,
    });
    if (!validated.ok) return validated;

    return this.balances.create({
      accountId: validated.value.accountId,
      projectId: validated.value.projectId,
      amount: validated.value.amount.toNumeric(),
      asOf: input.asOf,
      notes: validated.value.notes,
    });
  }
}
