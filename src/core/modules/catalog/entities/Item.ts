/**
 * Item — الصنف. تجسيد القاعدة الذهبية: يُدخَل مرة واحدة ويُكوَّد،
 * ثم يُستدعى بالكود في كل مستند لاحق بلا إعادة كتابة.
 */
import {
  AuditableEntity,
  type AuditableEntityProps,
  type EntityId,
} from "../../../shared/entities/base-entity";
import { ValidationError } from "../../../shared/errors/domain-error";
import { err, ok, type Result } from "../../../shared/result";
import { Code } from "../../../shared/value-objects/code";

export interface ItemProps extends AuditableEntityProps {
  code: Code;
  name: string;
  unit: string;
  category: string | null;
  description: string | null;
  isActive: boolean;
}

export interface CreateItemInput {
  id: EntityId;
  code: string;
  name: string;
  unit: string;
  category?: string | null;
  description?: string | null;
  isActive?: boolean;
  createdAt?: Date;
  updatedAt?: Date;
  createdBy?: EntityId | null;
}

export class Item extends AuditableEntity {
  readonly code: Code;
  readonly name: string;
  readonly unit: string;
  readonly category: string | null;
  readonly description: string | null;
  readonly isActive: boolean;

  private constructor(props: ItemProps) {
    super(props);
    this.code = props.code;
    this.name = props.name;
    this.unit = props.unit;
    this.category = props.category;
    this.description = props.description;
    this.isActive = props.isActive;
  }

  static create(input: CreateItemInput): Result<Item, ValidationError> {
    const code = Code.create(input.code);
    if (!code.ok) return code;

    const name = input.name.trim();
    if (name.length < 2) {
      return err(new ValidationError("اسم الصنف مطلوب", { name: "required" }));
    }

    const unit = input.unit.trim();
    if (unit.length === 0) {
      return err(new ValidationError("وحدة القياس مطلوبة", { unit: "required" }));
    }

    const now = new Date();
    return ok(
      new Item({
        id: input.id,
        code: code.value,
        name,
        unit,
        category: input.category?.trim() || null,
        description: input.description?.trim() || null,
        isActive: input.isActive ?? true,
        createdAt: input.createdAt ?? now,
        updatedAt: input.updatedAt ?? now,
        createdBy: input.createdBy ?? null,
      }),
    );
  }

  static restore(props: ItemProps): Item {
    return new Item(props);
  }

  /** الصنف المعطَّل لا يُستدعى في مستندات جديدة. */
  get isSelectable(): boolean {
    return this.isActive;
  }
}
