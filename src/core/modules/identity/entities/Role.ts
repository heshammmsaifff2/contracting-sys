/**
 * Role — دور يجمع مجموعة صلاحيات. أدوار النظام (is_system) لا تُحذف
 * لأن سياسات RLS والبذور تعتمد على مفاتيحها.
 */
import {
  AuditableEntity,
  type AuditableEntityProps,
} from "../../../shared/entities/base-entity";
import { ValidationError } from "../../../shared/errors/domain-error";
import { err, ok, type Result } from "../../../shared/result";

const KEY_PATTERN = /^[a-z][a-z0-9_]{1,31}$/;

export interface RoleProps extends AuditableEntityProps {
  key: string;
  name: string;
  description: string | null;
  isSystem: boolean;
  /** مفاتيح الصلاحيات المرتبطة — تُحمَّل عند الحاجة فقط. */
  permissionKeys: readonly string[];
}

export class Role extends AuditableEntity {
  readonly key: string;
  readonly name: string;
  readonly description: string | null;
  readonly isSystem: boolean;
  readonly permissionKeys: readonly string[];

  private constructor(props: RoleProps) {
    super(props);
    this.key = props.key;
    this.name = props.name;
    this.description = props.description;
    this.isSystem = props.isSystem;
    this.permissionKeys = props.permissionKeys;
  }

  static create(props: RoleProps): Result<Role, ValidationError> {
    if (!KEY_PATTERN.test(props.key)) {
      return err(
        new ValidationError(
          "مفتاح الدور يقبل الحروف الإنجليزية الصغيرة والأرقام و _ فقط",
          { key: "pattern" },
        ),
      );
    }
    if (props.name.trim().length < 2) {
      return err(new ValidationError("اسم الدور مطلوب", { name: "required" }));
    }
    return ok(new Role({ ...props, name: props.name.trim() }));
  }

  static restore(props: RoleProps): Role {
    return new Role(props);
  }

  /** أدوار النظام محميّة من الحذف. */
  get isDeletable(): boolean {
    return !this.isSystem;
  }

  has(permissionKey: string): boolean {
    return this.permissionKeys.includes(permissionKey);
  }
}
