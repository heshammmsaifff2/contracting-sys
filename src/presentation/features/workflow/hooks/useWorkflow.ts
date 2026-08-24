/**
 * Hooks محرّك سير العمل.
 * صندوق الوارد يُحدَّث دوريًا لأن العدّاد يمضي مع الوقت الفعلي.
 */
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useUseCases } from "@presentation/app/providers/di-context";
import { unwrap } from "@presentation/shared/lib/query";
import type {
  CompleteStepDto,
  InboxFilter,
  SaveEvaluationScoreDto,
  SaveHolidayDto,
  SaveWorkflowDefinitionDto,
  SaveWorkflowStepDto,
  SaveWorkScheduleDto,
  SetStepDurationDto,
  StartTransactionDto,
  TransactionDto,
} from "@application/modules/workflow/dtos";

export const INBOX_KEY = ["inbox"] as const;
export const WORKFLOW_DEFINITIONS_KEY = ["workflow-definitions"] as const;
export const WORK_SCHEDULES_KEY = ["work-schedules"] as const;
export const HOLIDAYS_KEY = ["holidays"] as const;
export const EVALUATION_KEY = ["evaluation-summary"] as const;
export const DURATION_CHANGES_KEY = ["duration-changes"] as const;

export const transactionKey = (id: string) => ["transaction", id] as const;

/** يُعاد الجلب كل دقيقة فيبقى العدّاد واللون صادقين. */
const COUNTDOWN_REFRESH_MS = 60_000;

export function useInbox(filter: InboxFilter) {
  const { listInbox } = useUseCases();

  return useQuery({
    queryKey: [...INBOX_KEY, filter.mineOnly ?? false, filter.openOnly ?? false],
    queryFn: async () => unwrap(await listInbox.execute(filter)),
    refetchInterval: COUNTDOWN_REFRESH_MS,
    placeholderData: (previous) => previous,
  });
}

export function useTransaction(id: string | null) {
  const { getTransaction } = useUseCases();

  return useQuery({
    queryKey: transactionKey(id ?? ""),
    queryFn: async () => unwrap(await getTransaction.execute({ id: id ?? "" })),
    enabled: id !== null,
    refetchInterval: COUNTDOWN_REFRESH_MS,
  });
}

export function useTransactionSearch(query: string) {
  const { searchTransactions } = useUseCases();

  return useQuery({
    queryKey: ["transaction-search", query],
    queryFn: async () => unwrap(await searchTransactions.execute({ query })),
    enabled: query.trim() !== "",
    placeholderData: (previous) => previous,
  });
}

export function useStartTransaction() {
  const { startTransaction } = useUseCases();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: StartTransactionDto) =>
      unwrap(await startTransaction.execute(input)),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: INBOX_KEY }),
  });
}

export function useCompleteStep() {
  const { completeStep } = useUseCases();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: CompleteStepDto) =>
      unwrap(await completeStep.execute(input)),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: INBOX_KEY });
      await queryClient.invalidateQueries({ queryKey: ["transaction"] });
      // الدرجة الآلية تغيّر تقارير التقييم
      await queryClient.invalidateQueries({ queryKey: EVALUATION_KEY });
    },
  });
}

export function useSetStepDuration() {
  const { setStepDuration } = useUseCases();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: SetStepDurationDto) =>
      unwrap(await setStepDuration.execute(input)),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: INBOX_KEY });
      await queryClient.invalidateQueries({ queryKey: ["transaction"] });
      await queryClient.invalidateQueries({ queryKey: DURATION_CHANGES_KEY });
      await queryClient.invalidateQueries({ queryKey: EVALUATION_KEY });
    },
  });
}

export function useCloseTransaction() {
  const { closeTransaction } = useUseCases();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: {
      transactionId: string;
      status: TransactionDto["status"];
    }) => unwrap(await closeTransaction.execute(input)),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: INBOX_KEY });
      await queryClient.invalidateQueries({ queryKey: ["transaction"] });
    },
  });
}

export function useCancelTransaction() {
  const { cancelTransaction } = useUseCases();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (transactionId: string) =>
      unwrap(await cancelTransaction.execute({ transactionId })),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: INBOX_KEY });
      await queryClient.invalidateQueries({ queryKey: ["transaction"] });
    },
  });
}

// ── تعريفات سير العمل ───────────────────────────────────────────────────
export function useWorkflowDefinitions() {
  const { listWorkflowDefinitions } = useUseCases();

  return useQuery({
    queryKey: WORKFLOW_DEFINITIONS_KEY,
    queryFn: async () => unwrap(await listWorkflowDefinitions.execute()),
  });
}

export function useSaveWorkflowDefinition() {
  const { saveWorkflowDefinition } = useUseCases();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: SaveWorkflowDefinitionDto) =>
      unwrap(await saveWorkflowDefinition.execute(input)),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: WORKFLOW_DEFINITIONS_KEY }),
  });
}

export function useSaveWorkflowStep() {
  const { saveWorkflowStep } = useUseCases();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: SaveWorkflowStepDto) =>
      unwrap(await saveWorkflowStep.execute(input)),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: WORKFLOW_DEFINITIONS_KEY }),
  });
}

export function useRemoveWorkflowStep() {
  const { removeWorkflowStep } = useUseCases();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => unwrap(await removeWorkflowStep.execute({ id })),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: WORKFLOW_DEFINITIONS_KEY }),
  });
}

export function useDurationChanges() {
  const { listDurationChanges } = useUseCases();

  return useQuery({
    queryKey: DURATION_CHANGES_KEY,
    queryFn: async () => unwrap(await listDurationChanges.execute()),
  });
}

// ── تقويم العمل ─────────────────────────────────────────────────────────
export function useWorkSchedules() {
  const { listWorkSchedules } = useUseCases();

  return useQuery({
    queryKey: WORK_SCHEDULES_KEY,
    queryFn: async () => unwrap(await listWorkSchedules.execute()),
  });
}

export function useSaveWorkSchedule() {
  const { saveWorkSchedule } = useUseCases();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: SaveWorkScheduleDto) =>
      unwrap(await saveWorkSchedule.execute(input)),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: WORK_SCHEDULES_KEY });
      // تغيير الدوام يغيّر كل العدّادات
      await queryClient.invalidateQueries({ queryKey: INBOX_KEY });
    },
  });
}

export function useRemoveWorkSchedule() {
  const { removeWorkSchedule } = useUseCases();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => unwrap(await removeWorkSchedule.execute({ id })),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: WORK_SCHEDULES_KEY });
      await queryClient.invalidateQueries({ queryKey: INBOX_KEY });
    },
  });
}

export function useHolidays() {
  const { listHolidays } = useUseCases();

  return useQuery({
    queryKey: HOLIDAYS_KEY,
    queryFn: async () => unwrap(await listHolidays.execute()),
  });
}

export function useAddHoliday() {
  const { addHoliday } = useUseCases();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: SaveHolidayDto) =>
      unwrap(await addHoliday.execute(input)),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: HOLIDAYS_KEY });
      await queryClient.invalidateQueries({ queryKey: INBOX_KEY });
    },
  });
}

export function useRemoveHoliday() {
  const { removeHoliday } = useUseCases();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => unwrap(await removeHoliday.execute({ id })),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: HOLIDAYS_KEY });
      await queryClient.invalidateQueries({ queryKey: INBOX_KEY });
    },
  });
}

// ── التقييم ─────────────────────────────────────────────────────────────
export function useEvaluationSummary(period: string | null) {
  const { listEvaluationSummary } = useUseCases();

  return useQuery({
    queryKey: [...EVALUATION_KEY, period ?? "all"],
    queryFn: async () => unwrap(await listEvaluationSummary.execute({ period })),
  });
}

export function useEvaluationCriteria() {
  const { listEvaluationCriteria } = useUseCases();

  return useQuery({
    queryKey: ["evaluation-criteria"],
    queryFn: async () => unwrap(await listEvaluationCriteria.execute()),
  });
}

export function useSaveEvaluationScore() {
  const { saveEvaluationScore } = useUseCases();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: SaveEvaluationScoreDto) =>
      unwrap(await saveEvaluationScore.execute(input)),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: EVALUATION_KEY }),
  });
}

export function useSetCriterionWeight() {
  const { setCriterionWeight } = useUseCases();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: {
      criteriaId: string;
      employeeType: string;
      weight: number;
    }) => unwrap(await setCriterionWeight.execute(input)),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["evaluation-criteria"] });
      await queryClient.invalidateQueries({ queryKey: EVALUATION_KEY });
    },
  });
}
