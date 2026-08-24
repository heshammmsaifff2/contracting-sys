import type { DomainError } from "@core/shared/errors/domain-error";
import type { Result } from "@core/shared/result";
import type { SaveSupplierDto, SupplierBankAccountDto, SupplierDto } from "../dtos";

export interface ISupplierRepository {
  search(
    query: string,
    limit?: number,
  ): Promise<Result<readonly SupplierDto[], DomainError>>;
  create(input: SaveSupplierDto): Promise<Result<SupplierDto, DomainError>>;
  update(id: string, input: SaveSupplierDto): Promise<Result<SupplierDto, DomainError>>;
  listBankAccounts(
    supplierId: string,
  ): Promise<Result<readonly SupplierBankAccountDto[], DomainError>>;
  addBankAccount(
    input: Omit<SupplierBankAccountDto, "id">,
  ): Promise<Result<SupplierBankAccountDto, DomainError>>;
  removeBankAccount(id: string): Promise<Result<void, DomainError>>;
}
