import type { DomainError } from "@core/shared/errors/domain-error";
import type { Result } from "@core/shared/result";
import { Supplier } from "@core/modules/procurement/entities/Supplier";
import type { IIdGenerator } from "@application/shared/ports/id-generator";
import type { UseCase } from "@application/shared/use-case";
import type { SaveSupplierDto, SupplierDto } from "../dtos";
import type { ISupplierRepository } from "../ports/supplier-repository";

export interface SaveSupplierInput extends SaveSupplierDto {
  /** null = مورّد جديد. */
  id: string | null;
}

export class SaveSupplier implements UseCase<SaveSupplierInput, SupplierDto> {
  private readonly suppliers: ISupplierRepository;
  private readonly ids: IIdGenerator;

  constructor(suppliers: ISupplierRepository, ids: IIdGenerator) {
    this.suppliers = suppliers;
    this.ids = ids;
  }

  async execute(input: SaveSupplierInput): Promise<Result<SupplierDto, DomainError>> {
    // قواعد الدومين تتحقّق من الكود والاسم والبريد قبل أي اتصال
    const validated = Supplier.create({
      id: input.id ?? this.ids.generate(),
      code: input.code,
      name: input.name,
      contact: {
        ...(input.phone === null ? {} : { phone: input.phone }),
        ...(input.email === null ? {} : { email: input.email }),
        ...(input.address === null ? {} : { address: input.address }),
      },
      isActive: input.isActive,
    });
    if (!validated.ok) return validated;

    const payload: SaveSupplierDto = {
      code: validated.value.code.value,
      name: validated.value.name,
      phone: input.phone,
      email: input.email,
      address: input.address,
      isActive: input.isActive,
    };

    return input.id === null
      ? this.suppliers.create(payload)
      : this.suppliers.update(input.id, payload);
  }
}
