import type { DomainError } from "@core/shared/errors/domain-error";
import type { Result } from "@core/shared/result";
import { Item } from "@core/modules/catalog/entities/Item";
import type { UseCase } from "@application/shared/use-case";
import type { ItemDto, UpdateItemDto } from "../dtos";
import type { IItemRepository } from "../ports/item-repository";

export class UpdateItem implements UseCase<UpdateItemDto, ItemDto> {
  private readonly items: IItemRepository;

  constructor(items: IItemRepository) {
    this.items = items;
  }

  async execute(input: UpdateItemDto): Promise<Result<ItemDto, DomainError>> {
    const validated = Item.create(input);
    if (!validated.ok) return validated;

    return this.items.update({
      id: input.id,
      code: validated.value.code.value,
      name: validated.value.name,
      unit: validated.value.unit,
      category: validated.value.category,
      description: validated.value.description,
      isActive: validated.value.isActive,
    });
  }
}
