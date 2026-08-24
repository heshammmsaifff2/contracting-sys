import type { DomainError } from "@core/shared/errors/domain-error";
import type { Result } from "@core/shared/result";
import type { UseCase } from "@application/shared/use-case";
import type { IItemRepository } from "../ports/item-repository";

export class DeleteItem implements UseCase<{ id: string }, void> {
  private readonly items: IItemRepository;

  constructor(items: IItemRepository) {
    this.items = items;
  }

  async execute(input: { id: string }): Promise<Result<void, DomainError>> {
    return this.items.remove(input.id);
  }
}
