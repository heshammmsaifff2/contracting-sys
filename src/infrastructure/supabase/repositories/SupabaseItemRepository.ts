import type { DomainError } from "@core/shared/errors/domain-error";
import { toDomainError } from "@core/shared/errors/domain-error";
import { err, ok, okVoid, type Result } from "@core/shared/result";
import type {
  CreateItemDto,
  ItemDto,
  UpdateItemDto,
} from "@application/modules/catalog/dtos";
import type { IItemRepository } from "@application/modules/catalog/ports/item-repository";
import { itemRowToDto } from "@infrastructure/mappers/item-mapper";
import type { AppSupabaseClient } from "../client";
import { toDomainDbError } from "../errors";

const COLUMNS = "id, code, name, unit, category, description, is_active";

export class SupabaseItemRepository implements IItemRepository {
  private readonly client: AppSupabaseClient;

  constructor(client: AppSupabaseClient) {
    this.client = client;
  }

  /**
   * البحث كلّه في Postgres عبر search_items: تطبيع الحروف العربية
   * ثم tsvector للكلمات الكاملة و trigram للأجزاء. لا منطق بحث في المتصفّح.
   */
  async search(
    query: string,
    limit = 50,
  ): Promise<Result<readonly ItemDto[], DomainError>> {
    try {
      const { data, error } = await this.client.rpc("search_items", {
        p_query: query,
        p_limit: limit,
      });

      if (error) return err(toDomainDbError(error, { entity: "الأصناف" }));
      return ok((data ?? []).map(itemRowToDto));
    } catch (e) {
      return err(toDomainError(e, "تعذّر البحث في الأصناف"));
    }
  }

  async create(input: CreateItemDto): Promise<Result<ItemDto, DomainError>> {
    try {
      const { data, error } = await this.client
        .from("items")
        .insert({
          code: input.code,
          name: input.name,
          unit: input.unit,
          category: input.category,
          description: input.description,
          is_active: input.isActive,
        })
        .select(COLUMNS)
        .single();

      if (error) return err(toDomainDbError(error, { entity: "الصنف" }));
      return ok(itemRowToDto(data));
    } catch (e) {
      return err(toDomainError(e, "تعذّر إنشاء الصنف"));
    }
  }

  async update(input: UpdateItemDto): Promise<Result<ItemDto, DomainError>> {
    try {
      const { data, error } = await this.client
        .from("items")
        .update({
          code: input.code,
          name: input.name,
          unit: input.unit,
          category: input.category,
          description: input.description,
          is_active: input.isActive,
        })
        .eq("id", input.id)
        .select(COLUMNS)
        .single();

      if (error) return err(toDomainDbError(error, { entity: "الصنف", id: input.id }));
      return ok(itemRowToDto(data));
    } catch (e) {
      return err(toDomainError(e, "تعذّر تعديل الصنف"));
    }
  }

  async remove(id: string): Promise<Result<void, DomainError>> {
    try {
      const { error } = await this.client.from("items").delete().eq("id", id);
      if (error) return err(toDomainDbError(error, { entity: "الصنف", id }));
      return okVoid();
    } catch (e) {
      return err(toDomainError(e, "تعذّر حذف الصنف"));
    }
  }
}
