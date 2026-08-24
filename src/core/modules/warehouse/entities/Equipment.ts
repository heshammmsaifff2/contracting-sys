/**
 * Equipment — المعدّة: أصل من أصول الشركة يتنقّل بين المشاريع.
 * حالتها تتبع حركتها لا العكس: ما دامت في مشروع فهي «تعمل»،
 * وإخلاؤها يجعلها «شاغرة» متاحة لبقية المشاريع بدل استئجار جديد.
 */
import {
  AuditableEntity,
  type AuditableEntityProps,
  type EntityId,
} from "../../../shared/entities/base-entity";
import { ValidationError } from "../../../shared/errors/domain-error";
import { err, ok, type Result } from "../../../shared/result";
import { Code } from "../../../shared/value-objects/code";

export type EquipmentStatus = "working" | "idle" | "maintenance" | "out_of_service";
export type MaintenanceKind = "periodic" | "repair";

export interface EquipmentProps extends AuditableEntityProps {
  code: Code;
  name: string;
  category: string;
  currentProjectId: EntityId | null;
  status: EquipmentStatus;
  spec: Readonly<Record<string, unknown>>;
  isActive: boolean;
}

export interface CreateEquipmentInput {
  id: EntityId;
  code: string;
  name: string;
  category?: string;
  currentProjectId?: EntityId | null;
  status?: EquipmentStatus;
  spec?: Record<string, unknown>;
  isActive?: boolean;
}

export class Equipment extends AuditableEntity {
  readonly code: Code;
  readonly name: string;
  readonly category: string;
  readonly currentProjectId: EntityId | null;
  readonly status: EquipmentStatus;
  readonly spec: Readonly<Record<string, unknown>>;
  readonly isActive: boolean;

  private constructor(props: EquipmentProps) {
    super(props);
    this.code = props.code;
    this.name = props.name;
    this.category = props.category;
    this.currentProjectId = props.currentProjectId;
    this.status = props.status;
    this.spec = props.spec;
    this.isActive = props.isActive;
  }

  static create(input: CreateEquipmentInput): Result<Equipment, ValidationError> {
    const code = Code.create(input.code);
    if (!code.ok) return code;

    const name = input.name.trim();
    if (name.length < 2) {
      return err(new ValidationError("اسم المعدّة مطلوب", { name: "required" }));
    }

    const now = new Date();
    return ok(
      new Equipment({
        id: input.id,
        code: code.value,
        name,
        category: (input.category ?? "").trim(),
        currentProjectId: input.currentProjectId ?? null,
        status: input.status ?? "idle",
        spec: input.spec ?? {},
        isActive: input.isActive ?? true,
        createdAt: now,
        updatedAt: now,
        createdBy: null,
      }),
    );
  }

  static restore(props: EquipmentProps): Equipment {
    return new Equipment(props);
  }

  /** الشاغرة: نشطة، بلا مشروع، وليست تحت الصيانة أو خارج الخدمة. */
  get isAvailable(): boolean {
    return this.isActive && this.currentProjectId === null && this.status === "idle";
  }

  /** المعدّة الخارجة من الخدمة أو المعطَّلة لا تُنقل. */
  canMoveTo(projectId: EntityId): Result<void, ValidationError> {
    if (!this.isActive || this.status === "out_of_service") {
      return err(new ValidationError("المعدّة خارج الخدمة", { status: this.status }));
    }
    if (this.currentProjectId === projectId) {
      return err(
        new ValidationError("المعدّة في هذا المشروع بالفعل", {
          projectId: "same_project",
        }),
      );
    }
    return ok(undefined);
  }
}
