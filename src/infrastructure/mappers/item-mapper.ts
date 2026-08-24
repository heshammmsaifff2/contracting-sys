import type { BoqItemDto, ItemDto } from "@application/modules/catalog/dtos";

/** الأعمدة التي تعني الواجهة — لا نمرّر searchable ولا أعمدة التدقيق. */
export interface ItemRowLike {
  id: string;
  code: string;
  name: string;
  unit: string;
  category?: string | null;
  description: string | null;
  is_active: boolean;
}

export function itemRowToDto(row: ItemRowLike): ItemDto {
  return {
    id: row.id,
    code: row.code,
    name: row.name,
    unit: row.unit,
    category: row.category ?? null,
    description: row.description,
    isActive: row.is_active,
  };
}

export interface BoqRowLike extends ItemRowLike {
  item_boq_map?: { count: number }[] | null;
}

export function boqRowToDto(row: BoqRowLike): BoqItemDto {
  return {
    id: row.id,
    code: row.code,
    name: row.name,
    unit: row.unit,
    description: row.description,
    isActive: row.is_active,
    componentCount: row.item_boq_map?.[0]?.count ?? 0,
  };
}
