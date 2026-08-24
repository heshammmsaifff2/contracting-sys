import type { DomainError } from "@core/shared/errors/domain-error";
import { toDomainError } from "@core/shared/errors/domain-error";
import { err, ok, okVoid, type Result } from "@core/shared/result";
import type {
  BoqComponentDto,
  BoqItemDto,
  CreateBoqItemDto,
  SetBoqComponentsDto,
  UpdateBoqItemDto,
} from "@application/modules/catalog/dtos";
import type { IBoqRepository } from "@application/modules/catalog/ports/boq-repository";
import { boqRowToDto } from "@infrastructure/mappers/item-mapper";
import type { AppSupabaseClient } from "../client";
import { toDomainDbError } from "../errors";

const COLUMNS = "id, code, name, unit, description, is_active";

interface ComponentRow {
  item_id: string;
  quantity_per_unit: number;
  items: { code: string; name: string; unit: string } | null;
}

export class SupabaseBoqRepository implements IBoqRepository {
  private readonly client: AppSupabaseClient;

  constructor(client: AppSupabaseClient) {
    this.client = client;
  }

  async search(
    query: string,
    limit = 50,
  ): Promise<Result<readonly BoqItemDto[], DomainError>> {
    try {
      const { data, error } = await this.client.rpc("search_boq_items", {
        p_query: query,
        p_limit: limit,
      });

      if (error) return err(toDomainDbError(error, { entity: "البنود" }));

      const rows = data ?? [];
      if (rows.length === 0) return ok([]);

      // عدد الأصناف المكوِّنة لكل بند — استعلام واحد لا استعلام لكل صف
      const { data: counts, error: countError } = await this.client
        .from("item_boq_map")
        .select("boq_item_id")
        .in(
          "boq_item_id",
          rows.map((row) => row.id),
        );

      if (countError)
        return err(toDomainDbError(countError, { entity: "تكوين البنود" }));

      const countByBoq = new Map<string, number>();
      for (const link of counts ?? []) {
        countByBoq.set(link.boq_item_id, (countByBoq.get(link.boq_item_id) ?? 0) + 1);
      }

      return ok(
        rows.map((row) => ({
          ...boqRowToDto(row),
          componentCount: countByBoq.get(row.id) ?? 0,
        })),
      );
    } catch (e) {
      return err(toDomainError(e, "تعذّر البحث في البنود"));
    }
  }

  async create(input: CreateBoqItemDto): Promise<Result<BoqItemDto, DomainError>> {
    try {
      const { data, error } = await this.client
        .from("boq_items")
        .insert({
          code: input.code,
          name: input.name,
          unit: input.unit,
          description: input.description,
          is_active: input.isActive,
        })
        .select(COLUMNS)
        .single();

      if (error) return err(toDomainDbError(error, { entity: "البند" }));
      return ok(boqRowToDto(data));
    } catch (e) {
      return err(toDomainError(e, "تعذّر إنشاء البند"));
    }
  }

  async update(input: UpdateBoqItemDto): Promise<Result<BoqItemDto, DomainError>> {
    try {
      const { data, error } = await this.client
        .from("boq_items")
        .update({
          code: input.code,
          name: input.name,
          unit: input.unit,
          description: input.description,
          is_active: input.isActive,
        })
        .eq("id", input.id)
        .select(COLUMNS)
        .single();

      if (error) return err(toDomainDbError(error, { entity: "البند", id: input.id }));
      return ok(boqRowToDto(data));
    } catch (e) {
      return err(toDomainError(e, "تعذّر تعديل البند"));
    }
  }

  async remove(id: string): Promise<Result<void, DomainError>> {
    try {
      const { error } = await this.client.from("boq_items").delete().eq("id", id);
      if (error) return err(toDomainDbError(error, { entity: "البند", id }));
      return okVoid();
    } catch (e) {
      return err(toDomainError(e, "تعذّر حذف البند"));
    }
  }

  async listComponents(
    boqItemId: string,
  ): Promise<Result<readonly BoqComponentDto[], DomainError>> {
    try {
      const { data, error } = await this.client
        .from("item_boq_map")
        .select("item_id, quantity_per_unit, items(code, name, unit)")
        .eq("boq_item_id", boqItemId)
        .overrideTypes<ComponentRow[]>();

      if (error)
        return err(toDomainDbError(error, { entity: "تكوين البند", id: boqItemId }));

      return ok(
        (data ?? []).map((row) => ({
          itemId: row.item_id,
          itemCode: row.items?.code ?? "",
          itemName: row.items?.name ?? "",
          itemUnit: row.items?.unit ?? "",
          quantityPerUnit: Number(row.quantity_per_unit),
        })),
      );
    } catch (e) {
      return err(toDomainError(e, "تعذّر قراءة تكوين البند"));
    }
  }

  async setComponents(input: SetBoqComponentsDto): Promise<Result<void, DomainError>> {
    try {
      // استبدال كامل: حذف ثم إدراج.
      // TODO(Phase 3): نقلها إلى دالة Postgres واحدة عبر ITransactionRunner.
      const { error: deleteError } = await this.client
        .from("item_boq_map")
        .delete()
        .eq("boq_item_id", input.boqItemId);

      if (deleteError)
        return err(
          toDomainDbError(deleteError, {
            entity: "تكوين البند",
            id: input.boqItemId,
          }),
        );

      if (input.components.length === 0) return okVoid();

      const { error: insertError } = await this.client.from("item_boq_map").insert(
        input.components.map((component) => ({
          boq_item_id: input.boqItemId,
          item_id: component.itemId,
          quantity_per_unit: component.quantityPerUnit,
        })),
      );

      if (insertError)
        return err(
          toDomainDbError(insertError, {
            entity: "تكوين البند",
            id: input.boqItemId,
          }),
        );

      return okVoid();
    } catch (e) {
      return err(toDomainError(e, "تعذّر حفظ تكوين البند"));
    }
  }
}
