import type { StockDirection } from "@core/modules/warehouse/entities/MandoubCustody";
import type {
  EquipmentStatus,
  MaintenanceKind,
} from "@core/modules/warehouse/entities/Equipment";
import type { StoredFile } from "@application/shared/ports/file-storage";

// ── المنشآت ─────────────────────────────────────────────────────────────
export interface FacilityDto {
  id: string;
  projectId: string;
  projectName: string;
  code: string;
  groupName: string;
  district: string;
  name: string;
  weight: number;
  isActive: boolean;
}

export interface SaveFacilityDto {
  id: string | null;
  projectId: string;
  code: string;
  groupName: string;
  district: string;
  name: string;
  weight: number;
  isActive: boolean;
}

// ── عهدة المندوب وحركة المخزون ──────────────────────────────────────────
export interface MandoubStockDto {
  projectId: string;
  projectName: string;
  mandoubId: string;
  mandoubName: string;
  itemId: string;
  itemCode: string;
  itemName: string;
  itemUnit: string;
  quantity: number;
  updatedAt: string;
}

export interface StockLineDto {
  itemId: string;
  qty: number;
}

export interface IssueStockDto {
  projectId: string;
  mandoubId: string;
  lines: readonly StockLineDto[];
  note: string;
}

export interface StockMovementDto {
  id: string;
  batchId: string;
  projectId: string;
  itemId: string;
  itemCode: string;
  itemName: string;
  itemUnit: string;
  qty: number;
  direction: StockDirection;
  mandoubId: string | null;
  mandoubName: string;
  facilityId: string | null;
  facilityName: string;
  note: string;
  createdAt: string;
}

export interface StockMovementFilter {
  projectId?: string | null;
  mandoubId?: string | null;
}

// ── استهلاك المنشآت ─────────────────────────────────────────────────────
export interface ConsumptionDto {
  id: string;
  batchId: string;
  facilityId: string;
  facilityCode: string;
  facilityName: string;
  groupName: string;
  district: string;
  facilityWeight: number;
  projectId: string;
  projectName: string;
  itemId: string;
  itemCode: string;
  itemName: string;
  itemUnit: string;
  qty: number;
  mandoubId: string | null;
  mandoubName: string;
  supervisorId: string | null;
  supervisorName: string;
  consumedAt: string;
  note: string;
  photos: readonly StoredFile[];
}

export interface RecordConsumptionDto {
  facilityId: string;
  mandoubId: string;
  lines: readonly StockLineDto[];
  photos: readonly StoredFile[];
  note: string;
  consumedAt: string | null;
}

export interface ConsumptionFilter {
  projectId?: string | null;
  facilityId?: string | null;
  supervisorId?: string | null;
}

// ── المواد الزائدة ──────────────────────────────────────────────────────
export type SurplusStatus = "available" | "reserved" | "transferred";

export interface SurplusMaterialDto {
  id: string;
  projectId: string;
  projectName: string;
  itemId: string;
  itemCode: string;
  itemName: string;
  itemUnit: string;
  qty: number;
  status: SurplusStatus;
  note: string;
}

export interface SaveSurplusDto {
  id: string | null;
  projectId: string;
  itemId: string;
  qty: number;
  status: SurplusStatus;
  note: string;
}

// ── المعدّات ────────────────────────────────────────────────────────────
export interface EquipmentDto {
  id: string;
  code: string;
  name: string;
  category: string;
  currentProjectId: string | null;
  currentProjectName: string;
  status: EquipmentStatus;
  spec: Readonly<Record<string, unknown>>;
  photo: StoredFile | null;
  acquiredAt: string | null;
  isActive: boolean;
  maintenanceCount: number;
  maintenanceCost: number;
}

export interface SaveEquipmentDto {
  id: string | null;
  code: string;
  name: string;
  category: string;
  status: EquipmentStatus;
  spec: Record<string, unknown>;
  photo: StoredFile | null;
  acquiredAt: string | null;
  isActive: boolean;
}

export interface MaintenanceDto {
  id: string;
  equipmentId: string;
  kind: MaintenanceKind;
  part: string;
  notes: string;
  cost: number;
  performedAt: string;
  nextDueAt: string | null;
}

export interface AddMaintenanceDto {
  equipmentId: string;
  kind: MaintenanceKind;
  part: string;
  notes: string;
  cost: number;
  performedAt: string;
  nextDueAt: string | null;
}

export interface EquipmentMovementDto {
  id: string;
  equipmentId: string;
  equipmentCode: string;
  equipmentName: string;
  projectId: string;
  projectName: string;
  fromDate: string;
  toDate: string | null;
  supervisorId: string | null;
  supervisorName: string;
  note: string;
}

export interface MoveEquipmentDto {
  equipmentId: string;
  projectId: string;
  fromDate: string;
  supervisorId: string | null;
  note: string;
}

export interface ReleaseEquipmentDto {
  equipmentId: string;
  toDate: string;
  availableTo: string | null;
  note: string;
}

export interface IdleEquipmentDto {
  id: string;
  equipmentId: string;
  equipmentCode: string;
  equipmentName: string;
  category: string;
  availableFrom: string;
  availableTo: string | null;
  note: string;
}

// ── التقارير ────────────────────────────────────────────────────────────
export interface WasteReportRowDto {
  projectId: string;
  projectName: string;
  itemId: string;
  itemCode: string;
  itemName: string;
  itemUnit: string;
  facilityId: string;
  facilityName: string;
  groupName: string;
  district: string;
  weight: number;
  qty: number;
  qtyPerWeight: number;
  avgQtyPerWeight: number;
  deviationRatio: number | null;
  isWasteful: boolean;
  lastConsumedAt: string | null;
}

export interface ProjectConsumptionRowDto {
  projectId: string;
  projectCode: string;
  projectName: string;
  itemId: string;
  itemCode: string;
  itemName: string;
  itemUnit: string;
  qty: number;
  facilitiesCount: number;
  downloadsCount: number;
  totalWeight: number;
  qtyPerWeight: number | null;
  lastConsumedAt: string | null;
}

export interface SupervisorConsumptionRowDto {
  supervisorId: string | null;
  supervisorName: string;
  projectId: string;
  projectName: string;
  downloadsCount: number;
  facilitiesCount: number;
  totalQty: number;
  withPhotos: number;
  lastConsumedAt: string | null;
}

export interface ConsumptionTrendPointDto {
  period: string;
  qty: number;
  cumulativeQty: number;
  downloadsCount: number;
}

export interface ConsumptionTrendQuery {
  months: number;
  projectId: string | null;
  itemId: string | null;
}

export interface WarehouseReportFilter {
  projectId?: string | null;
  itemId?: string | null;
}
