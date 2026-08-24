/**
 * Profile — ملف الموظف. مرتبط 1:1 بمستخدم المصادقة.
 * الراتب ليس جزءًا من هذا الكيان لأنه حقل حسّاس يُقرأ بصلاحية منفصلة.
 */
import {
  AuditableEntity,
  type AuditableEntityProps,
  type EntityId,
} from "../../../shared/entities/base-entity";
import { ValidationError } from "../../../shared/errors/domain-error";
import { err, ok, type Result } from "../../../shared/result";
import { Code } from "../../../shared/value-objects/code";

/** تصنيف الموظف: إداري / مهندس / مشرف — يحكم من يراسل من في وحدة المراسلات. */
export type EmployeeType = "admin" | "engineer" | "supervisor";

export const EMPLOYEE_TYPES: readonly EmployeeType[] = [
  "admin",
  "engineer",
  "supervisor",
];

export interface ProfileProps extends AuditableEntityProps {
  code: Code | null;
  email: string | null;
  fullName: string;
  employeeType: EmployeeType;
  isActive: boolean;
}

export interface CreateProfileInput {
  id: EntityId;
  code?: string | null;
  email?: string | null;
  fullName: string;
  employeeType: EmployeeType;
  isActive?: boolean;
  createdAt?: Date;
  updatedAt?: Date;
  createdBy?: EntityId | null;
}

export class Profile extends AuditableEntity {
  readonly code: Code | null;
  readonly email: string | null;
  readonly fullName: string;
  readonly employeeType: EmployeeType;
  readonly isActive: boolean;

  private constructor(props: ProfileProps) {
    super(props);
    this.code = props.code;
    this.email = props.email;
    this.fullName = props.fullName;
    this.employeeType = props.employeeType;
    this.isActive = props.isActive;
  }

  /** Validate and build a profile from raw input. */
  static create(input: CreateProfileInput): Result<Profile, ValidationError> {
    const fullName = input.fullName.trim();
    if (fullName.length < 2) {
      return err(new ValidationError("اسم الموظف مطلوب", { fullName: "required" }));
    }

    if (!EMPLOYEE_TYPES.includes(input.employeeType)) {
      return err(
        new ValidationError("تصنيف الموظف غير صالح", {
          employeeType: "invalid",
        }),
      );
    }

    let code: Code | null = null;
    if (input.code !== undefined && input.code !== null && input.code !== "") {
      const parsed = Code.create(input.code);
      if (!parsed.ok) return parsed;
      code = parsed.value;
    }

    const now = new Date();
    return ok(
      new Profile({
        id: input.id,
        code,
        email: input.email ?? null,
        fullName,
        employeeType: input.employeeType,
        isActive: input.isActive ?? true,
        createdAt: input.createdAt ?? now,
        updatedAt: input.updatedAt ?? now,
        createdBy: input.createdBy ?? null,
      }),
    );
  }

  /** إعادة بناء الكيان من قاعدة البيانات — القيم موثوقة فلا تُتحقّق ثانية. */
  static restore(props: ProfileProps): Profile {
    return new Profile(props);
  }

  /** الموظف المعطَّل يفقد كل صلاحياته — نسخة الدومين من قاعدة RLS نفسها. */
  get canOperate(): boolean {
    return this.isActive;
  }

  get displayName(): string {
    return this.code === null ? this.fullName : `${this.fullName} (${this.code.value})`;
  }
}
