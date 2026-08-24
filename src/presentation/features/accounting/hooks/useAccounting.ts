import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useUseCases } from "@presentation/app/providers/di-context";
import { useAppSettings } from "@presentation/app/providers/settings-context";
import { unwrap } from "@presentation/shared/lib/query";
import type { CreateOpeningBalanceDto } from "@application/modules/accounting/dtos";

export const ACCOUNTS_KEY = ["accounts"] as const;
export const POSTING_RULES_KEY = ["posting-rules"] as const;
export const JOURNAL_KEY = ["journal-entries"] as const;
export const OPENING_BALANCES_KEY = ["opening-balances"] as const;

export function useAccounts(postableOnly = false) {
  const { listAccounts } = useUseCases();

  return useQuery({
    queryKey: [...ACCOUNTS_KEY, postableOnly],
    queryFn: async () => unwrap(await listAccounts.execute({ postableOnly })),
  });
}

export function usePostingRules() {
  const { listPostingRules } = useUseCases();

  return useQuery({
    queryKey: POSTING_RULES_KEY,
    queryFn: async () => unwrap(await listPostingRules.execute()),
  });
}

export function useJournalEntries() {
  const { listJournalEntries } = useUseCases();

  return useQuery({
    queryKey: JOURNAL_KEY,
    queryFn: async () => unwrap(await listJournalEntries.execute({})),
  });
}

export function useOpeningBalances() {
  const { listOpeningBalances } = useUseCases();

  return useQuery({
    queryKey: OPENING_BALANCES_KEY,
    queryFn: async () => unwrap(await listOpeningBalances.execute()),
  });
}

export function useCreateOpeningBalance() {
  const { createOpeningBalance } = useUseCases();
  const { currency } = useAppSettings();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: CreateOpeningBalanceDto) =>
      unwrap(await createOpeningBalance.execute({ ...input, currency })),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: OPENING_BALANCES_KEY }),
  });
}

/** الاعتماد يُطلق القيد الآلي، فنُحدّث دفتر اليومية أيضًا. */
export function useApproveOpeningBalance() {
  const { approveOpeningBalance } = useUseCases();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) =>
      unwrap(await approveOpeningBalance.execute({ id })),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: OPENING_BALANCES_KEY });
      await queryClient.invalidateQueries({ queryKey: JOURNAL_KEY });
    },
  });
}

export function useDeleteOpeningBalance() {
  const { deleteOpeningBalance } = useUseCases();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) =>
      unwrap(await deleteOpeningBalance.execute({ id })),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: OPENING_BALANCES_KEY }),
  });
}
