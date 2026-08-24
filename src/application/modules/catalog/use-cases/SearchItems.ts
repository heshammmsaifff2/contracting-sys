import type { DomainError } from "@core/shared/errors/domain-error";
import type { Result } from "@core/shared/result";
import type { UseCase } from "@application/shared/use-case";
import type { ItemDto } from "../dtos";
import type { IItemRepository } from "../ports/item-repository";

export interface SearchItemsInput {
  query: string;
  limit?: number;
}

/**
 * البحث الفوري في الأصناف. المنطق كلّه في Postgres (تطبيع عربي + tsvector + trigram)
 * فيبقى متسقًا مع أي عميل ولا يتكرّر في المتصفّح.
 */
export class SearchItems implements UseCase<SearchItemsInput, readonly ItemDto[]> {
  private readonly items: IItemRepository;

  constructor(items: IItemRepository) {
    this.items = items;
  }

  async execute(
    input: SearchItemsInput,
  ): Promise<Result<readonly ItemDto[], DomainError>> {
    return this.items.search(input.query, input.limit);
  }
}
