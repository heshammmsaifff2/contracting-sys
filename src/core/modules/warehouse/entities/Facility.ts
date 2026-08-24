/**
 * Facility — المنشأة داخل هرم: تجمّع ← حي ← منشأة.
 * الوزن النسبي هو مفتاح العدالة في المقارنة: منشأتان في حي واحد قد تختلفان
 * حجمًا، فالمقارنة الصحيحة على «الاستهلاك لكل وحدة وزن» لا على الكمية [المخازن 9].
 */
import {
  AuditableEntity,
  type AuditableEntityProps,
  type EntityId,
} from "../../../shared/entities/base-entity";
import { ValidationError } from "../../../shared/errors/domain-error";
import { err, ok, type Result } from "../../../shared/result";
import { Code } from "../../../shared/value-objects/code";

export interface FacilityProps extends AuditableEntityProps {
  projectId: EntityId;
  code: Code;
  groupName: string;
  district: string;
  name: string;
  weight: number;
  isActive: boolean;
}

export interface CreateFacilityInput {
  id: EntityId;
  projectId: EntityId;
  code: string;
  groupName?: string;
  district?: string;
  name: string;
  weight: number;
  isActive?: boolean;
}

export class Facility extends AuditableEntity {
  readonly projectId: EntityId;
  readonly code: Code;
  readonly groupName: string;
  readonly district: string;
  readonly name: string;
  readonly weight: number;
  readonly isActive: boolean;

  private constructor(props: FacilityProps) {
    super(props);
    this.projectId = props.projectId;
    this.code = props.code;
    this.groupName = props.groupName;
    this.district = props.district;
    this.name = props.name;
    this.weight = props.weight;
    this.isActive = props.isActive;
  }

  static create(input: CreateFacilityInput): Result<Facility, ValidationError> {
    const code = Code.create(input.code);
    if (!code.ok) return code;

    const name = input.name.trim();
    if (name.length < 2) {
      return err(new ValidationError("اسم المنشأة مطلوب", { name: "required" }));
    }
    if (input.projectId.trim().length === 0) {
      return err(new ValidationError("المشروع مطلوب", { projectId: "required" }));
    }
    if (!Number.isFinite(input.weight) || input.weight <= 0) {
      return err(
        new ValidationError("الوزن النسبي يجب أن يكون أكبر من صفر", {
          weight: "invalid",
        }),
      );
    }

    const now = new Date();
    return ok(
      new Facility({
        id: input.id,
        projectId: input.projectId,
        code: code.value,
        groupName: (input.groupName ?? "").trim(),
        district: (input.district ?? "").trim(),
        name,
        weight: input.weight,
        isActive: input.isActive ?? true,
        createdAt: now,
        updatedAt: now,
        createdBy: null,
      }),
    );
  }

  static restore(props: FacilityProps): Facility {
    return new Facility(props);
  }

  /** المسار الكامل للعرض: تجمّع ← حي ← منشأة. */
  get fullPath(): string {
    return [this.groupName, this.district, this.name]
      .filter((part) => part.length > 0)
      .join(" ← ");
  }

  /** المنشأة غير النشطة لا يُنزَّل عليها. */
  get canReceiveConsumption(): boolean {
    return this.isActive;
  }
}

/**
 * الاستهلاك لكل وحدة وزن — الرقم الذي تُبنى عليه كل مقارنات المخازن.
 */
export function consumptionPerWeight(qty: number, weight: number): number | null {
  if (!Number.isFinite(qty) || !Number.isFinite(weight) || weight <= 0) return null;
  return qty / weight;
}

/**
 * نسبة الانحراف عن متوسط المشروع لنفس الصنف.
 * أكبر من العتبة (من جدول الإعدادات) ⇒ هدر يستحق المراجعة [المخازن 9].
 */
export function wasteDeviationRatio(
  perWeight: number | null,
  projectAveragePerWeight: number | null,
): number | null {
  if (perWeight === null || projectAveragePerWeight === null) return null;
  if (projectAveragePerWeight <= 0) return null;
  return perWeight / projectAveragePerWeight;
}

/** هل يُعدّ هذا الاستهلاك هدرًا حسب العتبة المُعدَّة؟ */
export function isWasteful(ratio: number | null, threshold: number): boolean {
  if (ratio === null || !Number.isFinite(threshold)) return false;
  return ratio > threshold;
}
