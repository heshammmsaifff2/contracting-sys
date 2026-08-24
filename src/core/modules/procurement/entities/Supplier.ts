/**
 * Supplier — المورّد. يُكوَّد مرة واحدة، ثم لا تُدخل المشتريات عنه
 * إلا كوده وسعره في المقارنة [المشتريات 3].
 */
import {
  AuditableEntity,
  type AuditableEntityProps,
  type EntityId,
} from "../../../shared/entities/base-entity";
import { ValidationError } from "../../../shared/errors/domain-error";
import { err, ok, type Result } from "../../../shared/result";
import { Code } from "../../../shared/value-objects/code";

export interface SupplierContact {
  phone?: string;
  email?: string;
  address?: string;
}

export interface SupplierProps extends AuditableEntityProps {
  code: Code;
  name: string;
  contact: SupplierContact;
  isActive: boolean;
}

export interface CreateSupplierInput {
  id: EntityId;
  code: string;
  name: string;
  contact?: SupplierContact;
  isActive?: boolean;
}

export class Supplier extends AuditableEntity {
  readonly code: Code;
  readonly name: string;
  readonly contact: SupplierContact;
  readonly isActive: boolean;

  private constructor(props: SupplierProps) {
    super(props);
    this.code = props.code;
    this.name = props.name;
    this.contact = props.contact;
    this.isActive = props.isActive;
  }

  static create(input: CreateSupplierInput): Result<Supplier, ValidationError> {
    const code = Code.create(input.code);
    if (!code.ok) return code;

    const name = input.name.trim();
    if (name.length < 2) {
      return err(new ValidationError("اسم المورّد مطلوب", { name: "required" }));
    }

    const email = input.contact?.email?.trim();
    if (
      email !== undefined &&
      email !== "" &&
      !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
    ) {
      return err(new ValidationError("بريد المورّد غير صالح", { email: "invalid" }));
    }

    const now = new Date();
    return ok(
      new Supplier({
        id: input.id,
        code: code.value,
        name,
        contact: input.contact ?? {},
        isActive: input.isActive ?? true,
        createdAt: now,
        updatedAt: now,
        createdBy: null,
      }),
    );
  }

  static restore(props: SupplierProps): Supplier {
    return new Supplier(props);
  }

  /** المورّد المعطَّل لا يُسعّر ولا يُصدَر له أمر توريد. */
  get canQuote(): boolean {
    return this.isActive;
  }
}
