import type { DomainError } from "@core/shared/errors/domain-error";
import type { Result } from "@core/shared/result";
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

export interface IEquipmentRepository {
  list(query: string): Promise<Result<readonly EquipmentDto[], DomainError>>;
  findById(id: string): Promise<Result<EquipmentDto | null, DomainError>>;
  save(input: SaveEquipmentDto): Promise<Result<EquipmentDto, DomainError>>;

  listMaintenance(
    equipmentId: string,
  ): Promise<Result<readonly MaintenanceDto[], DomainError>>;
  addMaintenance(
    input: AddMaintenanceDto,
  ): Promise<Result<MaintenanceDto, DomainError>>;

  listMovements(
    equipmentId: string | null,
  ): Promise<Result<readonly EquipmentMovementDto[], DomainError>>;
  /** النقل عبر دالة الخادم: تُغلق الحركة السابقة وتُفتح الجديدة ذرّيًا. */
  move(input: MoveEquipmentDto): Promise<Result<{ movementId: string }, DomainError>>;
  release(input: ReleaseEquipmentDto): Promise<Result<{ idleId: string }, DomainError>>;

  listIdle(): Promise<Result<readonly IdleEquipmentDto[], DomainError>>;
}
