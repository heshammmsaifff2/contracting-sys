/**
 * BoqItem — البند. يتكوّن من أصناف بنِسَب محدَّدة (item_boq_map)،
 * فيُحسب احتياج الأصناف من كمية البند آليًا بلا إدخال يدوي.
 */
import {
  AuditableEntity,
  type AuditableEntityProps,
  type EntityId,
} from "../../../shared/entities/base-entity";
import { ValidationError } from "../../../shared/errors/domain-error";
import { err, ok, type Result } from "../../../shared/result";
import { Code } from "../../../shared/value-objects/code";
import { Quantity } from "../../../shared/value-objects/quantity";

/** سطر في تكوين البند: كمية الصنف لوحدة واحدة من البند. */
export interface BoqComponent {
  itemId: EntityId;
  itemCode: string;
  itemName: string;
  itemUnit: string;
  quantityPerUnit: number;
}

export interface BoqItemProps extends AuditableEntityProps {
  code: Code;
  name: string;
  unit: string;
  description: string | null;
  isActive: boolean;
  components: readonly BoqComponent[];
}

export interface CreateBoqItemInput {
  id: EntityId;
  code: string;
  name: string;
  unit: string;
  description?: string | null;
  isActive?: boolean;
  components?: readonly BoqComponent[];
  createdAt?: Date;
  updatedAt?: Date;
  createdBy?: EntityId | null;
}

export class BoqItem extends AuditableEntity {
  readonly code: Code;
  readonly name: string;
  readonly unit: string;
  readonly description: string | null;
  readonly isActive: boolean;
  readonly components: readonly BoqComponent[];

  private constructor(props: BoqItemProps) {
    super(props);
    this.code = props.code;
    this.name = props.name;
    this.unit = props.unit;
    this.description = props.description;
    this.isActive = props.isActive;
    this.components = props.components;
  }

  static create(input: CreateBoqItemInput): Result<BoqItem, ValidationError> {
    const code = Code.create(input.code);
    if (!code.ok) return code;

    const name = input.name.trim();
    if (name.length < 2) {
      return err(new ValidationError("اسم البند مطلوب", { name: "required" }));
    }

    const unit = input.unit.trim();
    if (unit.length === 0) {
      return err(new ValidationError("وحدة القياس مطلوبة", { unit: "required" }));
    }

    const components = input.components ?? [];
    if (components.some((c) => c.quantityPerUnit <= 0)) {
      return err(
        new ValidationError("كمية الصنف في البند يجب أن تكون أكبر من صفر", {
          components: "invalid_quantity",
        }),
      );
    }

    const uniqueItems = new Set(components.map((c) => c.itemId));
    if (uniqueItems.size !== components.length) {
      return err(
        new ValidationError("لا يجوز تكرار الصنف نفسه في تكوين البند", {
          components: "duplicate",
        }),
      );
    }

    const now = new Date();
    return ok(
      new BoqItem({
        id: input.id,
        code: code.value,
        name,
        unit,
        description: input.description?.trim() || null,
        isActive: input.isActive ?? true,
        components,
        createdAt: input.createdAt ?? now,
        updatedAt: input.updatedAt ?? now,
        createdBy: input.createdBy ?? null,
      }),
    );
  }

  static restore(props: BoqItemProps): BoqItem {
    return new BoqItem(props);
  }

  /**
   * يحسب احتياج الأصناف لكمية معيّنة من البند.
   * هذا ما يمنع إعادة إدخال الكميات يدويًا في طلبات الاحتياج لاحقًا.
   */
  explodeTo(
    boqQuantity: number,
  ): Result<readonly { itemId: EntityId; quantity: Quantity }[], ValidationError> {
    if (!Number.isFinite(boqQuantity) || boqQuantity < 0) {
      return err(new ValidationError("كمية البند غير صالحة", { quantity: "invalid" }));
    }

    const lines: { itemId: EntityId; quantity: Quantity }[] = [];
    for (const component of this.components) {
      const qty = Quantity.create(
        component.quantityPerUnit * boqQuantity,
        component.itemUnit,
      );
      if (!qty.ok) return qty;
      lines.push({ itemId: component.itemId, quantity: qty.value });
    }
    return ok(lines);
  }
}
