import type { DomainError } from "@core/shared/errors/domain-error";
import type { Result } from "@core/shared/result";
import type { UseCase } from "@application/shared/use-case";
import type { PostingRuleDto } from "../dtos";
import type { IAccountRepository } from "../ports/account-repository";

/** قواعد الترحيل — جدول القسم 8، معروض للمراجعة والتدقيق. */
export class ListPostingRules implements UseCase<void, readonly PostingRuleDto[]> {
  private readonly accounts: IAccountRepository;

  constructor(accounts: IAccountRepository) {
    this.accounts = accounts;
  }

  async execute(): Promise<Result<readonly PostingRuleDto[], DomainError>> {
    return this.accounts.listPostingRules();
  }
}
