/**
 * Project — المشروع. محور قاعدة الأمان المتكرّرة في المواصفات:
 * لا يرى الموظف ولا يوقّع على مشروع غير معتمد عليه.
 */
import {
  AuditableEntity,
  type AuditableEntityProps,
  type EntityId,
} from "../../../shared/entities/base-entity";
import { ValidationError } from "../../../shared/errors/domain-error";
import { err, ok, type Result } from "../../../shared/result";
import { Code } from "../../../shared/value-objects/code";
import { Money, type CurrencyCode } from "../../../shared/value-objects/money";

export type ProjectStatus =
  "draft" | "active" | "suspended" | "completed" | "cancelled";

export const PROJECT_STATUSES: readonly ProjectStatus[] = [
  "draft",
  "active",
  "suspended",
  "completed",
  "cancelled",
];

export interface ProjectProps extends AuditableEntityProps {
  code: Code;
  name: string;
  ownerEntity: string | null;
  contractValue: Money;
  receivedAt: Date | null;
  managerId: EntityId | null;
  extractsOfficerId: EntityId | null;
  status: ProjectStatus;
}

export interface CreateProjectInput {
  id: EntityId;
  code: string;
  name: string;
  ownerEntity?: string | null;
  contractValue: number;
  currency: CurrencyCode;
  receivedAt?: Date | null;
  managerId?: EntityId | null;
  extractsOfficerId?: EntityId | null;
  status?: ProjectStatus;
  createdAt?: Date;
  updatedAt?: Date;
  createdBy?: EntityId | null;
}

export class Project extends AuditableEntity {
  readonly code: Code;
  readonly name: string;
  readonly ownerEntity: string | null;
  readonly contractValue: Money;
  readonly receivedAt: Date | null;
  readonly managerId: EntityId | null;
  readonly extractsOfficerId: EntityId | null;
  readonly status: ProjectStatus;

  private constructor(props: ProjectProps) {
    super(props);
    this.code = props.code;
    this.name = props.name;
    this.ownerEntity = props.ownerEntity;
    this.contractValue = props.contractValue;
    this.receivedAt = props.receivedAt;
    this.managerId = props.managerId;
    this.extractsOfficerId = props.extractsOfficerId;
    this.status = props.status;
  }

  static create(input: CreateProjectInput): Result<Project, ValidationError> {
    const code = Code.create(input.code);
    if (!code.ok) return code;

    const name = input.name.trim();
    if (name.length < 2) {
      return err(new ValidationError("اسم المشروع مطلوب", { name: "required" }));
    }

    if (input.contractValue < 0) {
      return err(
        new ValidationError("قيمة العقد لا يمكن أن تكون سالبة", {
          contractValue: "negative",
        }),
      );
    }

    const contractValue = Money.create(input.contractValue, input.currency);
    if (!contractValue.ok) return contractValue;

    const status = input.status ?? "active";
    if (!PROJECT_STATUSES.includes(status)) {
      return err(new ValidationError("حالة المشروع غير صالحة", { status: "invalid" }));
    }

    const now = new Date();
    return ok(
      new Project({
        id: input.id,
        code: code.value,
        name,
        ownerEntity: input.ownerEntity?.trim() || null,
        contractValue: contractValue.value,
        receivedAt: input.receivedAt ?? null,
        managerId: input.managerId ?? null,
        extractsOfficerId: input.extractsOfficerId ?? null,
        status,
        createdAt: input.createdAt ?? now,
        updatedAt: input.updatedAt ?? now,
        createdBy: input.createdBy ?? null,
      }),
    );
  }

  static restore(props: ProjectProps): Project {
    return new Project(props);
  }

  /** المشروع المغلق لا تُحرَّر عليه مستندات جديدة. */
  get acceptsNewDocuments(): boolean {
    return this.status === "active";
  }
}
