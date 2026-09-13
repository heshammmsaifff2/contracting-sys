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

/**
 * تصنيف الموظف: إداري أو تشغيلي — يحكم أوزان التقييم.
 *
 * **يُشتقّ ولا يُكتب.** الموظف يرث تصنيفه من قسم وظيفته، والقاعدة تفرضه
 * بمُشغّل. فتغيير الوظيفة يغيّره، ولا يُعدَّل وحده.
 *
 * كانت أربعة (مدير · مهندس · مشرف · عامل) فطُويت: المدير إداري والباقي تشغيلي.
 */
export type EmployeeType = "administrative" | "operational";

export const EMPLOYEE_TYPES: readonly EmployeeType[] = [
  "administrative",
  "operational",
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

  /**
   * قواعد ما يُكتب باليد: الاسم والكود.
   * التصنيف والقسم يُشتقّان من الوظيفة في القاعدة، فلا يُفحصان هنا.
   */
  static validateEditable(input: {
    fullName: string;
    code?: string | null;
  }): Result<{ fullName: string; code: Code | null }, ValidationError> {
    const fullName = input.fullName.trim();
    if (fullName.length < 2) {
      return err(new ValidationError("اسم الموظف مطلوب", { fullName: "required" }));
    }

    let code: Code | null = null;
    if (input.code !== undefined && input.code !== null && input.code !== "") {
      const parsed = Code.create(input.code);
      if (!parsed.ok) return parsed;
      code = parsed.value;
    }

    return ok({ fullName, code });
  }

  /** Validate and build a profile from raw input. */
  static create(input: CreateProfileInput): Result<Profile, ValidationError> {
    const editable = Profile.validateEditable(input);
    if (!editable.ok) return editable;

    if (!EMPLOYEE_TYPES.includes(input.employeeType)) {
      return err(
        new ValidationError("تصنيف الموظف غير صالح", {
          employeeType: "invalid",
        }),
      );
    }

    const { fullName, code } = editable.value;
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
