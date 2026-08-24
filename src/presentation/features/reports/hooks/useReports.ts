/**
 * Hooks التقارير الشاملة.
 * كلها قراءة: لا mutation هنا ولا إبطال cache — التقرير لا يُكتب.
 * `staleTime` أطول من المعتاد لأن هذه استعلامات تجميعية ثقيلة والأرقام
 * لا تتغيّر من ثانية لأخرى؛ التحديث الفوري ليس مطلوبًا ولا مجّانيًا.
 */
import { useQuery } from "@tanstack/react-query";
import { useUseCases } from "@presentation/app/providers/di-context";
import { unwrap } from "@presentation/shared/lib/query";
import type { ReportFilter } from "@application/modules/reports/dtos";

export const REPORTS_KEY = ["reports"] as const;

/** دقيقتان: تقارير التجميع ليست شاشة تشغيل لحظية. */
const REPORT_STALE_MS = 2 * 60 * 1000;

function scope(filter: ReportFilter): string {
  return `${filter.projectId ?? "all"}|${filter.from ?? ""}|${filter.to ?? ""}`;
}

export function useProjectCostReport(filter: ReportFilter, enabled = true) {
  const { getProjectCostReport } = useUseCases();

  return useQuery({
    queryKey: [...REPORTS_KEY, "project-costs", scope(filter)],
    queryFn: async () => unwrap(await getProjectCostReport.execute(filter)),
    staleTime: REPORT_STALE_MS,
    enabled,
  });
}

export function usePartyBalances(
  filter: ReportFilter & { partyType?: string | null },
  enabled = true,
) {
  const { getPartyBalances } = useUseCases();

  return useQuery({
    queryKey: [
      ...REPORTS_KEY,
      "party-balances",
      scope(filter),
      filter.partyType ?? "all",
    ],
    queryFn: async () => unwrap(await getPartyBalances.execute(filter)),
    staleTime: REPORT_STALE_MS,
    enabled,
  });
}

export function useManualEntriesReport(filter: ReportFilter, enabled = true) {
  const { getManualEntriesReport } = useUseCases();

  return useQuery({
    queryKey: [...REPORTS_KEY, "manual-entries", scope(filter)],
    queryFn: async () => unwrap(await getManualEntriesReport.execute(filter)),
    staleTime: REPORT_STALE_MS,
    enabled,
  });
}

export function useArchivePendingReport(filter: ReportFilter, enabled = true) {
  const { getArchivePendingReport } = useUseCases();

  return useQuery({
    queryKey: [...REPORTS_KEY, "archive-pending", scope(filter)],
    queryFn: async () => unwrap(await getArchivePendingReport.execute(filter)),
    staleTime: REPORT_STALE_MS,
    enabled,
  });
}

export function useDurationChangeReport(filter: ReportFilter, enabled = true) {
  const { getDurationChangeReport } = useUseCases();

  return useQuery({
    queryKey: [...REPORTS_KEY, "duration-changes", scope(filter)],
    queryFn: async () => unwrap(await getDurationChangeReport.execute(filter)),
    staleTime: REPORT_STALE_MS,
    enabled,
  });
}

export function useOverdueTransactionsReport(filter: ReportFilter, enabled = true) {
  const { getOverdueTransactionsReport } = useUseCases();

  return useQuery({
    queryKey: [...REPORTS_KEY, "overdue", scope(filter)],
    queryFn: async () => unwrap(await getOverdueTransactionsReport.execute(filter)),
    staleTime: REPORT_STALE_MS,
    enabled,
  });
}

export function useDepartmentFrequencyReport(enabled = true) {
  const { getDepartmentFrequencyReport } = useUseCases();

  return useQuery({
    queryKey: [...REPORTS_KEY, "department-frequency"],
    queryFn: async () => unwrap(await getDepartmentFrequencyReport.execute()),
    staleTime: REPORT_STALE_MS,
    enabled,
  });
}
