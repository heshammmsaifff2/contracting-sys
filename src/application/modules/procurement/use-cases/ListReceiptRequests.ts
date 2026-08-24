import type { DomainError } from "@core/shared/errors/domain-error";
import type { Result } from "@core/shared/result";
import type { UseCase } from "@application/shared/use-case";
import type { ReceiptRequestDto } from "../dtos";
import type { IReceiptRepository } from "../ports/receipt-repository";

export class ListReceiptRequests implements UseCase<
  void,
  readonly ReceiptRequestDto[]
> {
  private readonly repo: IReceiptRepository;

  constructor(repo: IReceiptRepository) {
    this.repo = repo;
  }

  async execute(): Promise<Result<readonly ReceiptRequestDto[], DomainError>> {
    return this.repo.list();
  }
}
