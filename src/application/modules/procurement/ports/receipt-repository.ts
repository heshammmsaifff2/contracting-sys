import type { DomainError } from "@core/shared/errors/domain-error";
import type { Result } from "@core/shared/result";
import type { ReceiptRequestDto } from "../dtos";

export interface IReceiptRepository {
  list(): Promise<Result<readonly ReceiptRequestDto[], DomainError>>;
  findById(id: string): Promise<Result<ReceiptRequestDto | null, DomainError>>;
}
