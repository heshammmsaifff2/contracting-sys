import type { DomainError } from "@core/shared/errors/domain-error";
import { ValidationError } from "@core/shared/errors/domain-error";
import { err, type Result } from "@core/shared/result";
import type { UseCase } from "@application/shared/use-case";
import type { SupplierBankAccountDto } from "../dtos";
import type { ISupplierRepository } from "../ports/supplier-repository";

export class ListSupplierBankAccounts implements UseCase<
  { supplierId: string },
  readonly SupplierBankAccountDto[]
> {
  private readonly suppliers: ISupplierRepository;

  constructor(suppliers: ISupplierRepository) {
    this.suppliers = suppliers;
  }

  async execute(input: {
    supplierId: string;
  }): Promise<Result<readonly SupplierBankAccountDto[], DomainError>> {
    return this.suppliers.listBankAccounts(input.supplierId);
  }
}

export type AddSupplierBankAccountInput = Omit<SupplierBankAccountDto, "id">;

export class AddSupplierBankAccount implements UseCase<
  AddSupplierBankAccountInput,
  SupplierBankAccountDto
> {
  private readonly suppliers: ISupplierRepository;

  constructor(suppliers: ISupplierRepository) {
    this.suppliers = suppliers;
  }

  async execute(
    input: AddSupplierBankAccountInput,
  ): Promise<Result<SupplierBankAccountDto, DomainError>> {
    if (input.bankName.trim().length < 2) {
      return err(new ValidationError("اسم البنك مطلوب", { bankName: "required" }));
    }
    // الحوالة تحتاج رقم حساب أو IBAN — أحدهما على الأقل
    if ((input.accountNo ?? "").trim() === "" && (input.iban ?? "").trim() === "") {
      return err(
        new ValidationError("مطلوب رقم حساب أو IBAN لإتمام الحوالة", {
          accountNo: "required",
        }),
      );
    }
    return this.suppliers.addBankAccount(input);
  }
}

export class RemoveSupplierBankAccount implements UseCase<{ id: string }, void> {
  private readonly suppliers: ISupplierRepository;

  constructor(suppliers: ISupplierRepository) {
    this.suppliers = suppliers;
  }

  async execute(input: { id: string }): Promise<Result<void, DomainError>> {
    return this.suppliers.removeBankAccount(input.id);
  }
}
