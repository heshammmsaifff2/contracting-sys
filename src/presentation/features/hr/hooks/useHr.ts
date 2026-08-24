/**
 * Hooks شؤون الموظفين.
 * إعدادات اليوميات (الموعد وقيمة اليوم) تُقرأ من الخادم لا من ثوابت،
 * فيتغيّر سلوك الشاشة بتغيير الإعداد بلا نشر جديد.
 */
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useUseCases } from "@presentation/app/providers/di-context";
import { unwrap } from "@presentation/shared/lib/query";
import { JOURNAL_KEY } from "@presentation/features/accounting/hooks/useAccounting";
import type {
  AttendanceFilter,
  ChangeSalaryDto,
  DecideLoanDto,
  ImportStatementDto,
  RateProductionDto,
  RegisterAttendanceDto,
  RequestLoanDto,
  SaveRecommendationDto,
  SaveWorkerDto,
  SetWorkerStatusDto,
  WorkerPoolFilter,
} from "@application/modules/hr/dtos";

export const WORKERS_KEY = ["workers"] as const;
export const WORKER_POOL_KEY = ["worker-pool"] as const;
export const ATTENDANCE_KEY = ["attendance"] as const;
export const ATTENDANCE_SETTINGS_KEY = ["attendance-settings"] as const;
export const LABOR_DAYS_KEY = ["labor-days"] as const;
export const LABOR_COST_KEY = ["labor-cost"] as const;
export const LOANS_KEY = ["loans"] as const;
export const SALARY_HISTORY_KEY = ["salary-history"] as const;
export const RATINGS_KEY = ["production-ratings"] as const;
export const RECOMMENDATIONS_KEY = ["worker-recommendations"] as const;

// ── العمالة ─────────────────────────────────────────────────────────────
export function useWorkerSearch(query: string) {
  const { searchWorkers } = useUseCases();
  return useQuery({
    queryKey: [...WORKERS_KEY, query],
    queryFn: async () => unwrap(await searchWorkers.execute({ query })),
    placeholderData: (previous) => previous,
  });
}

export function useWorkerPool(filter: WorkerPoolFilter) {
  const { listWorkerPool } = useUseCases();
  return useQuery({
    queryKey: [...WORKER_POOL_KEY, filter.status ?? "all"],
    queryFn: async () => unwrap(await listWorkerPool.execute(filter)),
  });
}

export function useSaveWorker() {
  const { saveWorker } = useUseCases();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: SaveWorkerDto) => unwrap(await saveWorker.execute(input)),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: WORKERS_KEY });
      await queryClient.invalidateQueries({ queryKey: WORKER_POOL_KEY });
    },
  });
}

export function useSetWorkerStatus() {
  const { setWorkerStatus } = useUseCases();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: SetWorkerStatusDto) =>
      unwrap(await setWorkerStatus.execute(input)),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: WORKER_POOL_KEY });
      await queryClient.invalidateQueries({ queryKey: WORKERS_KEY });
    },
  });
}

// ── اليوميات ────────────────────────────────────────────────────────────
export function useAttendanceSettings() {
  const { getAttendanceSettings } = useUseCases();
  return useQuery({
    queryKey: ATTENDANCE_SETTINGS_KEY,
    queryFn: async () => unwrap(await getAttendanceSettings.execute()),
    staleTime: 5 * 60_000,
  });
}

export function useAttendanceSuggestions(projectId: string, workDate: string) {
  const { suggestAttendance } = useUseCases();
  return useQuery({
    queryKey: ["attendance-suggestions", projectId, workDate],
    queryFn: async () =>
      unwrap(await suggestAttendance.execute({ projectId, workDate })),
    enabled: projectId !== "",
  });
}

export function useAttendance(filter: AttendanceFilter) {
  const { listAttendance } = useUseCases();
  return useQuery({
    queryKey: [
      ...ATTENDANCE_KEY,
      filter.projectId ?? "all",
      filter.workDate ?? "all",
      filter.workerId ?? "all",
    ],
    queryFn: async () => unwrap(await listAttendance.execute(filter)),
  });
}

export function useRegisterAttendance() {
  const { registerAttendance } = useUseCases();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: RegisterAttendanceDto) =>
      unwrap(await registerAttendance.execute(input)),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ATTENDANCE_KEY });
      await queryClient.invalidateQueries({ queryKey: LABOR_DAYS_KEY });
      await queryClient.invalidateQueries({ queryKey: LABOR_COST_KEY });
      await queryClient.invalidateQueries({ queryKey: ["attendance-suggestions"] });
    },
  });
}

export function useLaborDays(projectId: string | null) {
  const { getLaborDays } = useUseCases();
  return useQuery({
    queryKey: [...LABOR_DAYS_KEY, projectId ?? "all"],
    queryFn: async () => unwrap(await getLaborDays.execute({ projectId })),
  });
}

export function useLaborCost(projectId: string | null, period: string | null) {
  const { getLaborCost } = useUseCases();
  return useQuery({
    queryKey: [...LABOR_COST_KEY, projectId ?? "all", period ?? "all"],
    queryFn: async () => unwrap(await getLaborCost.execute({ projectId, period })),
  });
}

// ── السلف ───────────────────────────────────────────────────────────────
export function useLoans(workerId: string | null) {
  const { listLoans } = useUseCases();
  return useQuery({
    queryKey: [...LOANS_KEY, workerId ?? "all"],
    queryFn: async () => unwrap(await listLoans.execute({ workerId })),
  });
}

export function useRequestLoan() {
  const { requestLoan } = useUseCases();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: RequestLoanDto) =>
      unwrap(await requestLoan.execute(input)),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: LOANS_KEY }),
  });
}

export function useWithdrawLoan() {
  const { withdrawLoan } = useUseCases();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => unwrap(await withdrawLoan.execute({ id })),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: LOANS_KEY }),
  });
}

export function useDecideLoan() {
  const { decideLoan } = useUseCases();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: DecideLoanDto) => unwrap(await decideLoan.execute(input)),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: LOANS_KEY });
      await queryClient.invalidateQueries({ queryKey: ["payment-requests"] });
    },
  });
}

// ── الأجر والتقييم والتوصيات ────────────────────────────────────────────
export function useSalaryHistory(workerId: string | null) {
  const { getSalaryHistory } = useUseCases();
  return useQuery({
    queryKey: [...SALARY_HISTORY_KEY, workerId ?? ""],
    queryFn: async () =>
      unwrap(await getSalaryHistory.execute({ workerId: workerId ?? "" })),
    enabled: workerId !== null,
  });
}

export function useChangeSalary() {
  const { changeSalary } = useUseCases();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: ChangeSalaryDto) =>
      unwrap(await changeSalary.execute(input)),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: SALARY_HISTORY_KEY });
      await queryClient.invalidateQueries({ queryKey: LABOR_COST_KEY });
    },
  });
}

export function useProductionRatings(workerId: string | null, period: string | null) {
  const { listProductionRatings } = useUseCases();
  return useQuery({
    queryKey: [...RATINGS_KEY, workerId ?? "all", period ?? "all"],
    queryFn: async () =>
      unwrap(await listProductionRatings.execute({ workerId, period })),
  });
}

export function useRateProduction() {
  const { rateProduction } = useUseCases();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: RateProductionDto) =>
      unwrap(await rateProduction.execute(input)),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: RATINGS_KEY }),
  });
}

export function useRecommendations(workerId: string | null) {
  const { listRecommendations } = useUseCases();
  return useQuery({
    queryKey: [...RECOMMENDATIONS_KEY, workerId ?? ""],
    queryFn: async () =>
      unwrap(await listRecommendations.execute({ workerId: workerId ?? "" })),
    enabled: workerId !== null,
  });
}

export function useAddRecommendation() {
  const { addRecommendation } = useUseCases();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: SaveRecommendationDto) =>
      unwrap(await addRecommendation.execute(input)),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: RECOMMENDATIONS_KEY }),
  });
}

// ── ترحيل كشف البنك ─────────────────────────────────────────────────────
export function useImportStatement() {
  const { importBankStatement } = useUseCases();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: ImportStatementDto) =>
      unwrap(await importBankStatement.execute(input)),
    onSuccess: async (_data, variables) => {
      if (variables.dryRun) return;
      await queryClient.invalidateQueries({ queryKey: ["payment-requests"] });
      await queryClient.invalidateQueries({ queryKey: JOURNAL_KEY });
      await queryClient.invalidateQueries({ queryKey: LOANS_KEY });
    },
  });
}
