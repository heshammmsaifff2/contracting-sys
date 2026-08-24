/**
 * Hooks المخازن. كل عملية تغيّر رصيدًا تنادي use-case يستدعي دالة Postgres،
 * فلا يُحسب رصيد في المتصفّح ولا يُكتب إشعار من الواجهة.
 */
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useUseCases } from "@presentation/app/providers/di-context";
import { unwrap } from "@presentation/shared/lib/query";
import { NOTIFICATIONS_KEY } from "@presentation/features/notifications/hooks/useNotifications";
import type {
  AddMaintenanceDto,
  ConsumptionFilter,
  ConsumptionTrendQuery,
  IssueStockDto,
  MoveEquipmentDto,
  RecordConsumptionDto,
  ReleaseEquipmentDto,
  SaveEquipmentDto,
  SaveFacilityDto,
  SaveSurplusDto,
  StockMovementFilter,
  WarehouseReportFilter,
} from "@application/modules/warehouse/dtos";

export const FACILITIES_KEY = ["facilities"] as const;
export const CUSTODY_KEY = ["mandoub-stock"] as const;
export const MOVEMENTS_KEY = ["stock-movements"] as const;
export const CONSUMPTION_KEY = ["facility-consumption"] as const;
export const EQUIPMENT_KEY = ["equipment"] as const;
export const IDLE_EQUIPMENT_KEY = ["idle-equipment"] as const;
export const SURPLUS_KEY = ["surplus-materials"] as const;
export const WAREHOUSE_REPORTS_KEY = ["warehouse-reports"] as const;

// ── المنشآت ─────────────────────────────────────────────────────────────
export function useFacilities(projectId: string | null) {
  const { listFacilities } = useUseCases();
  return useQuery({
    queryKey: [...FACILITIES_KEY, projectId ?? "all"],
    queryFn: async () => unwrap(await listFacilities.execute({ projectId })),
  });
}

export function useSaveFacility() {
  const { saveFacility } = useUseCases();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: SaveFacilityDto) =>
      unwrap(await saveFacility.execute(input)),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: FACILITIES_KEY }),
  });
}

export function useRemoveFacility() {
  const { removeFacility } = useUseCases();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => unwrap(await removeFacility.execute({ id })),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: FACILITIES_KEY }),
  });
}

// ── عهدة المندوب ────────────────────────────────────────────────────────
export function useMandoubStock(projectId: string | null, mandoubId: string | null) {
  const { listMandoubStock } = useUseCases();
  return useQuery({
    queryKey: [...CUSTODY_KEY, projectId ?? "all", mandoubId ?? "all"],
    queryFn: async () =>
      unwrap(await listMandoubStock.execute({ projectId, mandoubId })),
  });
}

export function useStockMovements(filter: StockMovementFilter) {
  const { listStockMovements } = useUseCases();
  return useQuery({
    queryKey: [...MOVEMENTS_KEY, filter.projectId ?? "all", filter.mandoubId ?? "all"],
    queryFn: async () => unwrap(await listStockMovements.execute(filter)),
  });
}

/** يُبطل عهدة المندوب ومخزون الموقع معًا لأن الحركة تمسّ الطرفين. */
function useStockMutation<TInput, TOutput>(run: (input: TInput) => Promise<TOutput>) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: run,
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: CUSTODY_KEY });
      await queryClient.invalidateQueries({ queryKey: MOVEMENTS_KEY });
      await queryClient.invalidateQueries({ queryKey: ["project-item-limits"] });
      await queryClient.invalidateQueries({ queryKey: NOTIFICATIONS_KEY });
    },
  });
}

export function useIssueStock() {
  const { issueStockToMandoub } = useUseCases();
  return useStockMutation(async (input: IssueStockDto) =>
    unwrap(await issueStockToMandoub.execute(input)),
  );
}

export function useReturnStock() {
  const { returnMandoubStock } = useUseCases();
  return useStockMutation(async (input: IssueStockDto) =>
    unwrap(await returnMandoubStock.execute(input)),
  );
}

// ── الاستهلاك ───────────────────────────────────────────────────────────
export function useConsumption(filter: ConsumptionFilter) {
  const { listConsumption } = useUseCases();
  return useQuery({
    queryKey: [
      ...CONSUMPTION_KEY,
      filter.projectId ?? "all",
      filter.facilityId ?? "all",
      filter.supervisorId ?? "all",
    ],
    queryFn: async () => unwrap(await listConsumption.execute(filter)),
  });
}

export function useRecordConsumption() {
  const { recordFacilityConsumption } = useUseCases();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (
      input: RecordConsumptionDto & { available?: ReadonlyMap<string, number> },
    ) => unwrap(await recordFacilityConsumption.execute(input)),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: CONSUMPTION_KEY });
      await queryClient.invalidateQueries({ queryKey: CUSTODY_KEY });
      await queryClient.invalidateQueries({ queryKey: MOVEMENTS_KEY });
      await queryClient.invalidateQueries({ queryKey: WAREHOUSE_REPORTS_KEY });
      await queryClient.invalidateQueries({ queryKey: NOTIFICATIONS_KEY });
    },
  });
}

// ── المعدّات ────────────────────────────────────────────────────────────
export function useEquipment(query: string) {
  const { listEquipment } = useUseCases();
  return useQuery({
    queryKey: [...EQUIPMENT_KEY, query],
    queryFn: async () => unwrap(await listEquipment.execute({ query })),
    placeholderData: (previous) => previous,
  });
}

export function useSaveEquipment() {
  const { saveEquipment } = useUseCases();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: SaveEquipmentDto) =>
      unwrap(await saveEquipment.execute(input)),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: EQUIPMENT_KEY }),
  });
}

export function useMaintenance(equipmentId: string | null) {
  const { listMaintenance } = useUseCases();
  return useQuery({
    queryKey: ["equipment-maintenance", equipmentId ?? ""],
    queryFn: async () =>
      unwrap(await listMaintenance.execute({ equipmentId: equipmentId ?? "" })),
    enabled: equipmentId !== null,
  });
}

export function useAddMaintenance(equipmentId: string) {
  const { addMaintenance } = useUseCases();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: AddMaintenanceDto) =>
      unwrap(await addMaintenance.execute(input)),
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: ["equipment-maintenance", equipmentId],
      });
      await queryClient.invalidateQueries({ queryKey: EQUIPMENT_KEY });
    },
  });
}

export function useEquipmentMovements(equipmentId: string | null) {
  const { listEquipmentMovements } = useUseCases();
  return useQuery({
    queryKey: ["equipment-movements", equipmentId ?? "all"],
    queryFn: async () => unwrap(await listEquipmentMovements.execute({ equipmentId })),
  });
}

function useEquipmentMutation<TInput, TOutput>(
  run: (input: TInput) => Promise<TOutput>,
) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: run,
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: EQUIPMENT_KEY });
      await queryClient.invalidateQueries({ queryKey: IDLE_EQUIPMENT_KEY });
      await queryClient.invalidateQueries({ queryKey: ["equipment-movements"] });
      await queryClient.invalidateQueries({ queryKey: NOTIFICATIONS_KEY });
    },
  });
}

export function useMoveEquipment() {
  const { moveEquipment } = useUseCases();
  return useEquipmentMutation(async (input: MoveEquipmentDto) =>
    unwrap(await moveEquipment.execute(input)),
  );
}

export function useReleaseEquipment() {
  const { releaseEquipment } = useUseCases();
  return useEquipmentMutation(async (input: ReleaseEquipmentDto) =>
    unwrap(await releaseEquipment.execute(input)),
  );
}

export function useIdleEquipment() {
  const { listIdleEquipment } = useUseCases();
  return useQuery({
    queryKey: IDLE_EQUIPMENT_KEY,
    queryFn: async () => unwrap(await listIdleEquipment.execute()),
  });
}

// ── المواد الزائدة ──────────────────────────────────────────────────────
export function useSurplusMaterials(projectId: string | null) {
  const { listSurplusMaterials } = useUseCases();
  return useQuery({
    queryKey: [...SURPLUS_KEY, projectId ?? "all"],
    queryFn: async () => unwrap(await listSurplusMaterials.execute({ projectId })),
  });
}

export function useSaveSurplus() {
  const { saveSurplusMaterial } = useUseCases();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: SaveSurplusDto) =>
      unwrap(await saveSurplusMaterial.execute(input)),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: SURPLUS_KEY }),
  });
}

export function useRemoveSurplus() {
  const { removeSurplusMaterial } = useUseCases();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) =>
      unwrap(await removeSurplusMaterial.execute({ id })),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: SURPLUS_KEY }),
  });
}

// ── التقارير ────────────────────────────────────────────────────────────
export function useWasteReport(filter: WarehouseReportFilter) {
  const { getWasteReport } = useUseCases();
  return useQuery({
    queryKey: [
      ...WAREHOUSE_REPORTS_KEY,
      "waste",
      filter.projectId ?? "all",
      filter.itemId ?? "all",
    ],
    queryFn: async () => unwrap(await getWasteReport.execute(filter)),
  });
}

export function useProjectConsumption(filter: WarehouseReportFilter) {
  const { getProjectConsumption } = useUseCases();
  return useQuery({
    queryKey: [
      ...WAREHOUSE_REPORTS_KEY,
      "projects",
      filter.projectId ?? "all",
      filter.itemId ?? "all",
    ],
    queryFn: async () => unwrap(await getProjectConsumption.execute(filter)),
  });
}

export function useSupervisorConsumption(filter: WarehouseReportFilter) {
  const { getSupervisorConsumption } = useUseCases();
  return useQuery({
    queryKey: [...WAREHOUSE_REPORTS_KEY, "supervisors", filter.projectId ?? "all"],
    queryFn: async () => unwrap(await getSupervisorConsumption.execute(filter)),
  });
}

export function useConsumptionTrend(query: ConsumptionTrendQuery) {
  const { getConsumptionTrend } = useUseCases();
  return useQuery({
    queryKey: [
      ...WAREHOUSE_REPORTS_KEY,
      "trend",
      query.months,
      query.projectId ?? "all",
      query.itemId ?? "all",
    ],
    queryFn: async () => unwrap(await getConsumptionTrend.execute(query)),
  });
}
