import type { DomainError } from "@core/shared/errors/domain-error";
import type { Result } from "@core/shared/result";
import type { CreateItemDto, ItemDto, UpdateItemDto } from "../dtos";

export interface IItemRepository {
  /**
   * بحث فوري بأي كلمة. التنفيذ يستدعي دالة Postgres التي تطبّع الحروف العربية
   * وتجمع بين tsvector والـ trigram — فلا يُبنى منطق البحث في المتصفّح.
   */
  search(
    query: string,
    limit?: number,
  ): Promise<Result<readonly ItemDto[], DomainError>>;
  create(input: CreateItemDto): Promise<Result<ItemDto, DomainError>>;
  update(input: UpdateItemDto): Promise<Result<ItemDto, DomainError>>;
  remove(id: string): Promise<Result<void, DomainError>>;
}
