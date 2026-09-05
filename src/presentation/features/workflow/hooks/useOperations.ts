/**
 * Hooks أدوات التشغيل.
 * كلّها تُبطل الوارد والمعاملة والخطّ الزمني معًا: الفعل يظهر في الثلاثة.
 */
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useUseCases } from "@presentation/app/providers/di-context";
import { unwrap } from "@presentation/shared/lib/query";
import type {
  ArchiveDecisionDto,
  ExtendDeadlineDto,
  ForceCloseDto,
  MentionDto,
  SendAlertDto,
  TransferAssignmentDto,
} from "@application/modules/workflow/dtos";
import { AVAILABLE_ACTIONS_KEY, INBOX_KEY, TIMELINE_KEY } from "./useWorkflow";

function useRefreshWorkflow() {
  const queryClient = useQueryClient();
  return async () => {
    await queryClient.invalidateQueries({ queryKey: INBOX_KEY });
    await queryClient.invalidateQueries({ queryKey: ["transaction"] });
    await queryClient.invalidateQueries({ queryKey: TIMELINE_KEY });
    await queryClient.invalidateQueries({ queryKey: AVAILABLE_ACTIONS_KEY });
  };
}

export function useTransferTargets(assignmentId: string | null) {
  const { listTransferTargets } = useUseCases();

  return useQuery({
    queryKey: ["transfer-targets", assignmentId ?? ""],
    queryFn: async () =>
      unwrap(await listTransferTargets.execute({ assignmentId: assignmentId ?? "" })),
    enabled: assignmentId !== null,
  });
}

export function useTransferAssignment() {
  const { transferAssignment } = useUseCases();
  const refresh = useRefreshWorkflow();

  return useMutation({
    mutationFn: async (input: TransferAssignmentDto) =>
      unwrap(await transferAssignment.execute(input)),
    onSuccess: refresh,
  });
}

export function useSendAlert() {
  const { sendAssignmentAlert } = useUseCases();
  const refresh = useRefreshWorkflow();

  return useMutation({
    mutationFn: async (input: SendAlertDto) =>
      unwrap(await sendAssignmentAlert.execute(input)),
    onSuccess: refresh,
  });
}

export function useExtendDeadline() {
  const { extendAssignmentDeadline } = useUseCases();
  const queryClient = useQueryClient();
  const refresh = useRefreshWorkflow();

  return useMutation({
    mutationFn: async (input: ExtendDeadlineDto) =>
      unwrap(await extendAssignmentDeadline.execute(input)),
    onSuccess: async () => {
      await refresh();
      // المدّ يظهر في تقرير المدد المعدّلة [المراسلات 5]
      await queryClient.invalidateQueries({ queryKey: ["duration-changes"] });
    },
  });
}

export function useForceClose() {
  const { forceCloseTransaction } = useUseCases();
  const refresh = useRefreshWorkflow();

  return useMutation({
    mutationFn: async (input: ForceCloseDto) =>
      unwrap(await forceCloseTransaction.execute(input)),
    onSuccess: refresh,
  });
}

export function useMention() {
  const { mentionInTransaction } = useUseCases();
  const refresh = useRefreshWorkflow();

  return useMutation({
    mutationFn: async (input: MentionDto) =>
      unwrap(await mentionInTransaction.execute(input)),
    onSuccess: refresh,
  });
}

export const ARCHIVE_QUEUE_KEY = ["archive-queue"] as const;

/**
 * الحجز والإطلاق يغيّران حالة **بقيّة** المكلَّفين لا صاحب الفعل وحده:
 * ما كان مفتوحًا يصير معلَّقًا والعكس. فيُبطَل الوارد كلّه لا صفٌّ منه.
 */
export function useClaimAssignment() {
  const { claimAssignment } = useUseCases();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (assignmentId: string) =>
      unwrap(await claimAssignment.execute({ assignmentId })),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: INBOX_KEY });
      await queryClient.invalidateQueries({ queryKey: ["transaction"] });
      await queryClient.invalidateQueries({ queryKey: AVAILABLE_ACTIONS_KEY });
      await queryClient.invalidateQueries({ queryKey: TIMELINE_KEY });
    },
  });
}

export function useReleaseAssignmentClaim() {
  const { releaseAssignmentClaim } = useUseCases();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: { assignmentId: string; reason: string }) =>
      unwrap(await releaseAssignmentClaim.execute(input)),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: INBOX_KEY });
      await queryClient.invalidateQueries({ queryKey: ["transaction"] });
      await queryClient.invalidateQueries({ queryKey: AVAILABLE_ACTIONS_KEY });
      await queryClient.invalidateQueries({ queryKey: TIMELINE_KEY });
    },
  });
}

// ── الأرشفة على مرحلتين ─────────────────────────────────────────────────
export function useArchiveQueue() {
  const { listArchiveQueue } = useUseCases();

  return useQuery({
    queryKey: ARCHIVE_QUEUE_KEY,
    queryFn: async () => unwrap(await listArchiveQueue.execute()),
  });
}

function useArchiveMutation<TInput>(run: (input: TInput) => Promise<unknown>) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: run,
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ARCHIVE_QUEUE_KEY });
      await queryClient.invalidateQueries({ queryKey: ["transaction"] });
      await queryClient.invalidateQueries({ queryKey: TIMELINE_KEY });
    },
  });
}

export function useSubmitOriginal() {
  const { submitTransactionOriginal } = useUseCases();

  return useArchiveMutation(async (input: { transactionId: string; notes: string }) =>
    unwrap(await submitTransactionOriginal.execute(input)),
  );
}

export function useAcceptArchive() {
  const { acceptTransactionArchive } = useUseCases();

  return useArchiveMutation(async (input: ArchiveDecisionDto) =>
    unwrap(await acceptTransactionArchive.execute(input)),
  );
}

export function useRejectArchive() {
  const { rejectTransactionArchive } = useUseCases();

  return useArchiveMutation(async (input: ArchiveDecisionDto) =>
    unwrap(await rejectTransactionArchive.execute(input)),
  );
}
