/**
 * Account — حساب في شجرة الحسابات.
 * الحسابات التجميعية (غير القابلة للترحيل) تُستخدم للتجميع فقط.
 */
import {
  AuditableEntity,
  type AuditableEntityProps,
  type EntityId,
} from "../../../shared/entities/base-entity";
import { ValidationError } from "../../../shared/errors/domain-error";
import { err, ok, type Result } from "../../../shared/result";

export type AccountType = "asset" | "liability" | "equity" | "revenue" | "expense";

export const ACCOUNT_TYPES: readonly AccountType[] = [
  "asset",
  "liability",
  "equity",
  "revenue",
  "expense",
];

/** الطرف الطبيعي لرصيد الحساب — يحدّد اتجاه الزيادة. */
export function naturalSide(type: AccountType): "debit" | "credit" {
  return type === "asset" || type === "expense" ? "debit" : "credit";
}

export interface AccountProps extends AuditableEntityProps {
  code: string;
  name: string;
  type: AccountType;
  parentId: EntityId | null;
  isPostable: boolean;
  isActive: boolean;
}

export class Account extends AuditableEntity {
  readonly code: string;
  readonly name: string;
  readonly type: AccountType;
  readonly parentId: EntityId | null;
  readonly isPostable: boolean;
  readonly isActive: boolean;

  private constructor(props: AccountProps) {
    super(props);
    this.code = props.code;
    this.name = props.name;
    this.type = props.type;
    this.parentId = props.parentId;
    this.isPostable = props.isPostable;
    this.isActive = props.isActive;
  }

  static create(props: AccountProps): Result<Account, ValidationError> {
    if (!/^[0-9]{1,10}$/.test(props.code)) {
      return err(
        new ValidationError("كود الحساب يجب أن يكون أرقامًا فقط", { code: "pattern" }),
      );
    }
    if (props.name.trim().length < 2) {
      return err(new ValidationError("اسم الحساب مطلوب", { name: "required" }));
    }
    if (!ACCOUNT_TYPES.includes(props.type)) {
      return err(new ValidationError("نوع الحساب غير صالح", { type: "invalid" }));
    }
    return ok(new Account({ ...props, name: props.name.trim() }));
  }

  static restore(props: AccountProps): Account {
    return new Account(props);
  }

  get naturalSide(): "debit" | "credit" {
    return naturalSide(this.type);
  }

  /** لا يُسجَّل قيد على حساب تجميعي أو معطَّل. */
  get acceptsPostings(): boolean {
    return this.isPostable && this.isActive;
  }
}
