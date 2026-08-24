import type { DomainError } from "@core/shared/errors/domain-error";
import type { Result } from "@core/shared/result";
import { Item } from "@core/modules/catalog/entities/Item";
import type { IIdGenerator } from "@application/shared/ports/id-generator";
import type { UseCase } from "@application/shared/use-case";
import type { CreateItemDto, ItemDto } from "../dtos";
import type { IItemRepository } from "../ports/item-repository";

export class CreateItem implements UseCase<CreateItemDto, ItemDto> {
  private readonly items: IItemRepository;
  private readonly ids: IIdGenerator;

  constructor(items: IItemRepository, ids: IIdGenerator) {
    this.items = items;
    this.ids = ids;
  }

  async execute(input: CreateItemDto): Promise<Result<ItemDto, DomainError>> {
    const validated = Item.create({ id: this.ids.generate(), ...input });
    if (!validated.ok) return validated;

    return this.items.create({
      code: validated.value.code.value,
      name: validated.value.name,
      unit: validated.value.unit,
      category: validated.value.category,
      description: validated.value.description,
      isActive: validated.value.isActive,
    });
  }
}
