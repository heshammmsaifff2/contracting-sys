/**
 * Hooks مرفقات المعاملات.
 * الرفع نفسه يقع في <FileUpload> عبر منفذ التخزين؛ هذه الطبقة تحفظ المرجع.
 */
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useUseCases } from "@presentation/app/providers/di-context";
import { unwrap } from "@presentation/shared/lib/query";
import type { AddAttachmentDto } from "@application/modules/workflow/dtos";
import { AVAILABLE_ACTIONS_KEY } from "./useWorkflow";

export const ATTACHMENTS_KEY = ["transaction-attachments"] as const;

export function useTransactionAttachments(transactionId: string | null) {
  const { listTransactionAttachments } = useUseCases();

  return useQuery({
    queryKey: [...ATTACHMENTS_KEY, transactionId ?? ""],
    queryFn: async () =>
      unwrap(
        await listTransactionAttachments.execute({
          transactionId: transactionId ?? "",
        }),
      ),
    enabled: transactionId !== null,
  });
}

export function useAddAttachment() {
  const { addTransactionAttachment } = useUseCases();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: AddAttachmentDto) =>
      unwrap(await addTransactionAttachment.execute(input)),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ATTACHMENTS_KEY });
      // عدّاد المرفقات يفتح الأزرار التي تشترط مرفقًا
      await queryClient.invalidateQueries({ queryKey: AVAILABLE_ACTIONS_KEY });
    },
  });
}

export function useRemoveAttachment() {
  const { removeTransactionAttachment } = useUseCases();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) =>
      unwrap(await removeTransactionAttachment.execute({ id })),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ATTACHMENTS_KEY });
      await queryClient.invalidateQueries({ queryKey: AVAILABLE_ACTIONS_KEY });
    },
  });
}
