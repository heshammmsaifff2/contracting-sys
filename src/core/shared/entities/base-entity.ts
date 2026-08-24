/**
 * الكيانات الأساسية. كل كيان عملياتي في النظام يمتد AuditableEntity
 * ليطابق أعمدة created_at / updated_at / created_by الموجودة في كل جدول.
 */
export type EntityId = string; // uuid

export interface BaseEntityProps {
  readonly id: EntityId;
}

export abstract class BaseEntity {
  readonly id: EntityId;

  protected constructor(props: BaseEntityProps) {
    this.id = props.id;
  }

  /** المقارنة بالهوية لا بالقيمة. */
  equals(other: BaseEntity | null | undefined): boolean {
    if (!other) return false;
    return this.constructor === other.constructor && this.id === other.id;
  }
}

export interface AuditableEntityProps extends BaseEntityProps {
  readonly createdAt: Date;
  readonly updatedAt: Date;
  readonly createdBy: EntityId | null;
}

export abstract class AuditableEntity extends BaseEntity {
  readonly createdAt: Date;
  readonly updatedAt: Date;
  readonly createdBy: EntityId | null;

  protected constructor(props: AuditableEntityProps) {
    super(props);
    this.createdAt = props.createdAt;
    this.updatedAt = props.updatedAt;
    this.createdBy = props.createdBy;
  }
}
