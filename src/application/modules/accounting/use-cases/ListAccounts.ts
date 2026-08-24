import type { DomainError } from "@core/shared/errors/domain-error";
import type { Result } from "@core/shared/result";
import type { UseCase } from "@application/shared/use-case";
import type { AccountDto } from "../dtos";
import type { IAccountRepository } from "../ports/account-repository";

export interface ListAccountsInput {
  /** الحسابات القابلة للترحيل فقط — للقوائم المنسدلة. */
  postableOnly?: boolean;
}

export class ListAccounts implements UseCase<ListAccountsInput, readonly AccountDto[]> {
  private readonly accounts: IAccountRepository;

  constructor(accounts: IAccountRepository) {
    this.accounts = accounts;
  }

  async execute(
    input: ListAccountsInput,
  ): Promise<Result<readonly AccountDto[], DomainError>> {
    return input.postableOnly === true
      ? this.accounts.listPostable()
      : this.accounts.listTree();
  }
}
