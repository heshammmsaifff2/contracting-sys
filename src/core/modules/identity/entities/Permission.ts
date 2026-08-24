/**
 * Permission — صلاحية دقيقة بصيغة entity.action.
 * المفاتيح تُعرَّف في قاعدة البيانات لا في الكود، فالنوع هنا نصّي مُقيَّد بالشكل.
 */
import { ValidationError } from "../../../shared/errors/domain-error";
import { err, ok, type Result } from "../../../shared/result";
import type { EntityId } from "../../../shared/entities/base-entity";

const KEY_PATTERN = /^[a-z][a-z0-9_]*\.[a-z][a-z0-9_]*$/;

export interface PermissionProps {
  id: EntityId;
  key: string;
  description: string;
  module: string;
}

export class Permission {
  readonly id: EntityId;
  readonly key: string;
  readonly description: string;
  readonly module: string;

  private constructor(props: PermissionProps) {
    this.id = props.id;
    this.key = props.key;
    this.description = props.description;
    this.module = props.module;
    Object.freeze(this);
  }

  static create(props: PermissionProps): Result<Permission, ValidationError> {
    if (!KEY_PATTERN.test(props.key)) {
      return err(
        new ValidationError("مفتاح الصلاحية يجب أن يكون بصيغة entity.action", {
          key: "pattern",
        }),
      );
    }
    return ok(new Permission(props));
  }

  static restore(props: PermissionProps): Permission {
    return new Permission(props);
  }
}
