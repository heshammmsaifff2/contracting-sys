/**
 * المعدّات: الملف والصيانة والحركة والشاغر.
 * موقع المعدّة يتبع حركتها آليًا على الخادم — لا يُدخل مرتين.
 */
import type { DomainError } from "@core/shared/errors/domain-error";
import { ConflictError, ValidationError } from "@core/shared/errors/domain-error";
import { err, type Result } from "@core/shared/result";
import type { UseCase } from "@application/shared/use-case";
import type {
  AddMaintenanceDto,
  EquipmentDto,
  EquipmentMovementDto,
  IdleEquipmentDto,
  MaintenanceDto,
  MoveEquipmentDto,
  ReleaseEquipmentDto,
  SaveEquipmentDto,
} from "../dtos";
import type { IEquipmentRepository } from "../ports/equipment-repository";

export class ListEquipment implements UseCase<
  { query: string },
  readonly EquipmentDto[]
> {
  private readonly repo: IEquipmentRepository;

  constructor(repo: IEquipmentRepository) {
    this.repo = repo;
  }

  async execute(input: {
    query: string;
  }): Promise<Result<readonly EquipmentDto[], DomainError>> {
    return this.repo.list(input.query);
  }
}

export class SaveEquipment implements UseCase<SaveEquipmentDto, EquipmentDto> {
  private readonly repo: IEquipmentRepository;

  constructor(repo: IEquipmentRepository) {
    this.repo = repo;
  }

  async execute(input: SaveEquipmentDto): Promise<Result<EquipmentDto, DomainError>> {
    if (input.code.trim() === "") {
      return err(new ValidationError("كود المعدّة مطلوب", { code: "required" }));
    }
    if (input.name.trim().length < 2) {
      return err(new ValidationError("اسم المعدّة مطلوب", { name: "required" }));
    }
    return this.repo.save({
      ...input,
      code: input.code.trim().toUpperCase(),
      name: input.name.trim(),
      category: input.category.trim(),
    });
  }
}

export class ListMaintenance implements UseCase<
  { equipmentId: string },
  readonly MaintenanceDto[]
> {
  private readonly repo: IEquipmentRepository;

  constructor(repo: IEquipmentRepository) {
    this.repo = repo;
  }

  async execute(input: {
    equipmentId: string;
  }): Promise<Result<readonly MaintenanceDto[], DomainError>> {
    return this.repo.listMaintenance(input.equipmentId);
  }
}

export class AddMaintenance implements UseCase<AddMaintenanceDto, MaintenanceDto> {
  private readonly repo: IEquipmentRepository;

  constructor(repo: IEquipmentRepository) {
    this.repo = repo;
  }

  async execute(
    input: AddMaintenanceDto,
  ): Promise<Result<MaintenanceDto, DomainError>> {
    if (input.cost < 0) {
      return err(
        new ValidationError("تكلفة الصيانة لا تكون سالبة", { cost: "negative" }),
      );
    }
    if (
      input.nextDueAt !== null &&
      input.nextDueAt !== "" &&
      input.nextDueAt < input.performedAt
    ) {
      return err(
        new ValidationError("موعد الصيانة القادمة قبل تاريخ التنفيذ", {
          nextDueAt: "before_performed",
        }),
      );
    }
    return this.repo.addMaintenance(input);
  }
}

export class ListEquipmentMovements implements UseCase<
  { equipmentId: string | null },
  readonly EquipmentMovementDto[]
> {
  private readonly repo: IEquipmentRepository;

  constructor(repo: IEquipmentRepository) {
    this.repo = repo;
  }

  async execute(input: {
    equipmentId: string | null;
  }): Promise<Result<readonly EquipmentMovementDto[], DomainError>> {
    return this.repo.listMovements(input.equipmentId);
  }
}

export class MoveEquipment implements UseCase<
  MoveEquipmentDto,
  { movementId: string }
> {
  private readonly repo: IEquipmentRepository;

  constructor(repo: IEquipmentRepository) {
    this.repo = repo;
  }

  async execute(
    input: MoveEquipmentDto,
  ): Promise<Result<{ movementId: string }, DomainError>> {
    if (input.projectId === "") {
      return err(new ValidationError("المشروع مطلوب", { projectId: "required" }));
    }

    const existing = await this.repo.findById(input.equipmentId);
    if (!existing.ok) return existing;
    if (existing.value === null) {
      return err(new ConflictError("المعدّة غير موجودة", { id: input.equipmentId }));
    }
    if (!existing.value.isActive || existing.value.status === "out_of_service") {
      return err(
        new ConflictError("المعدّة خارج الخدمة", { status: existing.value.status }),
      );
    }
    if (existing.value.currentProjectId === input.projectId) {
      return err(
        new ConflictError("المعدّة في هذا المشروع بالفعل", {
          projectId: input.projectId,
        }),
      );
    }

    return this.repo.move(input);
  }
}

export class ReleaseEquipment implements UseCase<
  ReleaseEquipmentDto,
  { idleId: string }
> {
  private readonly repo: IEquipmentRepository;

  constructor(repo: IEquipmentRepository) {
    this.repo = repo;
  }

  async execute(
    input: ReleaseEquipmentDto,
  ): Promise<Result<{ idleId: string }, DomainError>> {
    if (
      input.availableTo !== null &&
      input.availableTo !== "" &&
      input.availableTo < input.toDate
    ) {
      return err(
        new ValidationError("تاريخ نهاية الإتاحة قبل تاريخ الإخلاء", {
          availableTo: "before_from",
        }),
      );
    }
    return this.repo.release(input);
  }
}

export class ListIdleEquipment implements UseCase<void, readonly IdleEquipmentDto[]> {
  private readonly repo: IEquipmentRepository;

  constructor(repo: IEquipmentRepository) {
    this.repo = repo;
  }

  async execute(): Promise<Result<readonly IdleEquipmentDto[], DomainError>> {
    return this.repo.listIdle();
  }
}
