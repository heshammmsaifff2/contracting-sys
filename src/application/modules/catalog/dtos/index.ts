export interface ItemDto {
  id: string;
  code: string;
  name: string;
  unit: string;
  category: string | null;
  description: string | null;
  isActive: boolean;
}

export interface CreateItemDto {
  code: string;
  name: string;
  unit: string;
  category: string | null;
  description: string | null;
  isActive: boolean;
}

export interface UpdateItemDto extends CreateItemDto {
  id: string;
}

export interface BoqComponentDto {
  itemId: string;
  itemCode: string;
  itemName: string;
  itemUnit: string;
  quantityPerUnit: number;
}

export interface BoqItemDto {
  id: string;
  code: string;
  name: string;
  unit: string;
  description: string | null;
  isActive: boolean;
  componentCount: number;
}

export interface CreateBoqItemDto {
  code: string;
  name: string;
  unit: string;
  description: string | null;
  isActive: boolean;
}

export interface UpdateBoqItemDto extends CreateBoqItemDto {
  id: string;
}

export interface SetBoqComponentsDto {
  boqItemId: string;
  components: readonly { itemId: string; quantityPerUnit: number }[];
}
