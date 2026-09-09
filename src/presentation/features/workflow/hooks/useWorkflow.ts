/**
 * Hooks محرّك سير العمل.
 * صندوق الوارد يُحدَّث دوريًا لأن العدّاد يمضي مع الوقت الفعلي.
 */
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useUseCases } from "@presentation/app/providers/di-context";
import { unwrap } from "@presentation/shared/lib/query";
import type { PublishCandidateStage } from "@core/modules/workflow/entities/WorkflowGovernance";
import type {
  CompleteAssignmentDto,
  InboxFilter,
  SaveActionRouteDto,
  SaveWorkflowActionDto,
  SaveEvaluationScoreDto,
  SaveHolidayDto,
  SavePipelineWorkflowDto,
  SaveStagePositionsDto,
  SaveStageRequirementDto,
  SaveWorkflowDefinitionDto,
  SaveStageParticipantDto,
  SaveWorkflowStageDto,
  SaveWorkScheduleDto,
  SetAssignmentDurationDto,
  StartTransactionDto,
  TransactionDto,
} from "@application/modules/workflow/dtos";

export const INBOX_KEY = ["inbox"] as const;
export const WORKFLOW_DEFINITIONS_KEY = ["workflow-definitions"] as const;
export const WORK_SCHEDULES_KEY = ["work-schedules"] as const;
export const HOLIDAYS_KEY = ["holidays"] as const;
export const EVALUATION_KEY = ["evaluation-summary"] as const;
export const DURATION_CHANGES_KEY = ["duration-changes"] as const;
export const AVAILABLE_ACTIONS_KEY = ["available-actions"] as const;
export const TIMELINE_KEY = ["transaction-timeline"] as const;

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

/** الأزرار المتاحة الآن — الواجهة تعرضها بدل زرّ «إنجاز» واحد. */
export function useAvailableActions(filter: {
  transactionId?: string;
  mineOnly?: boolean;
}) {
  const { listAvailableActions } = useUseCases();

  return useQuery({
    queryKey: [
      ...AVAILABLE_ACTIONS_KEY,
      filter.transactionId ?? "",
      filter.mineOnly ?? false,
    ],
    queryFn: async () => unwrap(await listAvailableActions.execute(filter)),
    refetchInterval: COUNTDOWN_REFRESH_MS,
    placeholderData: (previous) => previous,
  });
}

export function useTransactionTimeline(transactionId: string | null) {
  const { getTransactionTimeline } = useUseCases();

  return useQuery({
    queryKey: [...TIMELINE_KEY, transactionId ?? ""],
    queryFn: async () =>
      unwrap(
        await getTransactionTimeline.execute({ transactionId: transactionId ?? "" }),
      ),
    enabled: transactionId !== null,
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

/**
 * إنجاز تكليف واحد. لا يعني إغلاق المرحلة بالضرورة: تحت سياسة «الكل»
 * تبقى مفتوحة حتى ينجز بقيّة المشاركين.
 */
export function useCompleteAssignment() {
  const { completeAssignment } = useUseCases();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: CompleteAssignmentDto) =>
      unwrap(await completeAssignment.execute(input)),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: INBOX_KEY });
      await queryClient.invalidateQueries({ queryKey: ["transaction"] });
      await queryClient.invalidateQueries({ queryKey: AVAILABLE_ACTIONS_KEY });
      await queryClient.invalidateQueries({ queryKey: TIMELINE_KEY });
      // الدرجة الآلية تغيّر تقارير التقييم
      await queryClient.invalidateQueries({ queryKey: EVALUATION_KEY });
    },
  });
}

export function useReceiveAssignment() {
  const { receiveAssignment } = useUseCases();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (assignmentId: string) =>
      unwrap(await receiveAssignment.execute({ assignmentId })),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: INBOX_KEY });
      await queryClient.invalidateQueries({ queryKey: ["transaction"] });
    },
  });
}

export function useSetAssignmentDuration() {
  const { setAssignmentDuration } = useUseCases();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: SetAssignmentDurationDto) =>
      unwrap(await setAssignmentDuration.execute(input)),
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

export function useSavePipelineWorkflow() {
  const { savePipelineWorkflow } = useUseCases();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: SavePipelineWorkflowDto) =>
      unwrap(await savePipelineWorkflow.execute(input)),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: WORKFLOW_DEFINITIONS_KEY }),
  });
}

export function useSaveWorkflowStage() {
  const { saveWorkflowStage } = useUseCases();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: SaveWorkflowStageDto) =>
      unwrap(await saveWorkflowStage.execute(input)),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: WORKFLOW_DEFINITIONS_KEY }),
  });
}

/**
 * حفظ مواضع العُقَد بعد السحب.
 *
 * لا `invalidateQueries`: الموضع في يد المحرِّر أصلًا، وإعادة الجلب بعد كل
 * سحبة تُعيد رسم اللوحة فتقفز العقدة تحت المؤشّر.
 */
export function useSaveStagePositions() {
  const { saveStagePositions } = useUseCases();

  return useMutation({
    mutationFn: async (input: SaveStagePositionsDto) =>
      unwrap(await saveStagePositions.execute(input)),
  });
}

/** شرط جاهزية على مرحلة [المرحلة ٠٧] — يُقاس قبل التقدّم لا بعده. */
/** حذف تعريف مسار — يُبطل الوارد أيضًا: أنواع المعاملات المتاحة تغيّرت. */
export function useRemoveWorkflowDefinition() {
  const { removeWorkflowDefinition } = useUseCases();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: { id: string; transactionCount: number }) =>
      unwrap(await removeWorkflowDefinition.execute(input)),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: WORKFLOW_DEFINITIONS_KEY });
      await queryClient.invalidateQueries({ queryKey: INBOX_KEY });
    },
  });
}

export function useSaveStageRequirement() {
  const { saveStageRequirement } = useUseCases();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: SaveStageRequirementDto) =>
      unwrap(await saveStageRequirement.execute(input)),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: WORKFLOW_DEFINITIONS_KEY }),
  });
}

export function useRemoveStageRequirement() {
  const { removeStageRequirement } = useUseCases();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) =>
      unwrap(await removeStageRequirement.execute({ id })),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: WORKFLOW_DEFINITIONS_KEY }),
  });
}

/** نسخة مسودّة — المنشور مجمَّد لأن معاملات تسير عليه. */
export function useCreateWorkflowDraft() {
  const { createWorkflowDraft } = useUseCases();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (definitionId: string) =>
      unwrap(await createWorkflowDraft.execute({ definitionId })),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: WORKFLOW_DEFINITIONS_KEY }),
  });
}

/**
 * النشر. يُبطل صندوق الوارد أيضًا: المعاملات الجديدة تبدأ من الإصدار الجديد
 * وقد تغيّرت مراحلها.
 */
export function usePublishWorkflowVersion() {
  const { publishWorkflowVersion } = useUseCases();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: {
      definitionId: string;
      stages: readonly PublishCandidateStage[];
    }) => unwrap(await publishWorkflowVersion.execute(input)),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: WORKFLOW_DEFINITIONS_KEY });
      await queryClient.invalidateQueries({ queryKey: INBOX_KEY });
    },
  });
}

export function useRemoveWorkflowStage() {
  const { removeWorkflowStage } = useUseCases();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => unwrap(await removeWorkflowStage.execute({ id })),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: WORKFLOW_DEFINITIONS_KEY }),
  });
}

/** إضافة مشارك ثانٍ هي ما يجعل المرحلة تقف عند أكثر من موظف. */
export function useSaveStageParticipant() {
  const { saveStageParticipant } = useUseCases();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: SaveStageParticipantDto) =>
      unwrap(await saveStageParticipant.execute(input)),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: WORKFLOW_DEFINITIONS_KEY }),
  });
}

export function useRemoveStageParticipant() {
  const { removeStageParticipant } = useUseCases();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) =>
      unwrap(await removeStageParticipant.execute({ id })),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: WORKFLOW_DEFINITIONS_KEY }),
  });
}

/** أزرار المرحلة في المحرِّر. */
export function useSaveWorkflowAction() {
  const { saveWorkflowAction } = useUseCases();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: SaveWorkflowActionDto) =>
      unwrap(await saveWorkflowAction.execute(input)),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: WORKFLOW_DEFINITIONS_KEY }),
  });
}

export function useRemoveWorkflowAction() {
  const { removeWorkflowAction } = useUseCases();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) =>
      unwrap(await removeWorkflowAction.execute({ id })),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: WORKFLOW_DEFINITIONS_KEY }),
  });
}

/** وجهة مشروطة للزرّ — هنا يقع التفريع. */
export function useSaveActionRoute() {
  const { saveActionRoute } = useUseCases();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: SaveActionRouteDto) =>
      unwrap(await saveActionRoute.execute(input)),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: WORKFLOW_DEFINITIONS_KEY }),
  });
}

export function useRemoveActionRoute() {
  const { removeActionRoute } = useUseCases();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => unwrap(await removeActionRoute.execute({ id })),
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
