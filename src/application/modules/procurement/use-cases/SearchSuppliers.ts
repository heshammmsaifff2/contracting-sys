import type { DomainError } from "@core/shared/errors/domain-error";
import type { Result } from "@core/shared/result";
import type { UseCase } from "@application/shared/use-case";
import type { SupplierDto } from "../dtos";
import type { ISupplierRepository } from "../ports/supplier-repository";

export class SearchSuppliers implements UseCase<
  { query: string },
  readonly SupplierDto[]
> {
  private readonly suppliers: ISupplierRepository;

  constructor(suppliers: ISupplierRepository) {
    this.suppliers = suppliers;
  }

  async execute(input: {
    query: string;
  }): Promise<Result<readonly SupplierDto[], DomainError>> {
    return this.suppliers.search(input.query);
  }
}
