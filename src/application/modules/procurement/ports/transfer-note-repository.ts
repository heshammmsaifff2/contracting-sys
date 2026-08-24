import type { DomainError } from "@core/shared/errors/domain-error";
import type { Result } from "@core/shared/result";
import type { CreateTransferNoteDto, TransferNoteDto } from "../dtos";

export interface ITransferNoteRepository {
  list(): Promise<Result<readonly TransferNoteDto[], DomainError>>;
  findById(id: string): Promise<Result<TransferNoteDto | null, DomainError>>;
  create(input: CreateTransferNoteDto): Promise<Result<TransferNoteDto, DomainError>>;
  approve(id: string): Promise<Result<TransferNoteDto, DomainError>>;
}
