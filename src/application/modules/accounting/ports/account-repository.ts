import type { DomainError } from "@core/shared/errors/domain-error";
import type { Result } from "@core/shared/result";
import type { AccountDto, PostingRuleDto } from "../dtos";

export interface IAccountRepository {
  /** شجرة الحسابات مرتّبة هرميًا مع عمق كل حساب. */
  listTree(): Promise<Result<readonly AccountDto[], DomainError>>;
  listPostable(): Promise<Result<readonly AccountDto[], DomainError>>;
  listPostingRules(): Promise<Result<readonly PostingRuleDto[], DomainError>>;
}
