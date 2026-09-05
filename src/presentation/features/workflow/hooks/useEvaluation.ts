/**
 * Hooks التقييم الموسَّع [المرحلة ٠٨].
 *
 * المُختبِر التجريبي `useQuery` لا `useMutation`: هو قراءة محضة تُعاد بتغيّر
 * الفترة أو القاعدة، ولا يصحّ أن يبدو فعلًا يكتب.
 */
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useUseCases } from "@presentation/app/providers/di-context";
import { unwrap } from "@presentation/shared/lib/query";
import type { SaveEvaluationRuleDto } from "@application/modules/workflow/dtos";
import { EVALUATION_KEY } from "./useWorkflow";

export const EVAL_CATEGORIES_KEY = ["evaluation-categories"] as const;
export const EVAL_RULES_KEY = ["evaluation-rules"] as const;
export const EVAL_PREVIEW_KEY = ["evaluation-rule-preview"] as const;
export const EVAL_PERIOD_KEY = ["evaluation-period-report"] as const;
export const EVAL_AUDIT_KEY = ["evaluation-audit"] as const;

export function useEvaluationCategories() {
  const { listEvaluationCategories } = useUseCases();

  return useQuery({
    queryKey: EVAL_CATEGORIES_KEY,
    queryFn: async () => unwrap(await listEvaluationCategories.execute()),
  });
}

export function useCategoryScores(period: string) {
  const { listCategoryScores } = useUseCases();

  return useQuery({
    queryKey: [...EVAL_CATEGORIES_KEY, "scores", period],
    queryFn: async () => unwrap(await listCategoryScores.execute({ period })),
    enabled: period !== "",
  });
}

export function useEvaluationRules() {
  const { listEvaluationRules } = useUseCases();

  return useQuery({
    queryKey: EVAL_RULES_KEY,
    queryFn: async () => unwrap(await listEvaluationRules.execute()),
  });
}

export function useSaveEvaluationRule() {
  const { saveEvaluationRule } = useUseCases();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: SaveEvaluationRuleDto) =>
      unwrap(await saveEvaluationRule.execute(input)),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: EVAL_RULES_KEY });
      // القاعدة تغيّرت، فما يعرضه المُختبِر لم يعد صادقًا
      await queryClient.invalidateQueries({ queryKey: EVAL_PREVIEW_KEY });
    },
  });
}

export function useRemoveEvaluationRule() {
  const { removeEvaluationRule } = useUseCases();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) =>
      unwrap(await removeEvaluationRule.execute({ id })),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: EVAL_RULES_KEY });
      await queryClient.invalidateQueries({ queryKey: EVAL_PREVIEW_KEY });
    },
  });
}

/** المُختبِر التجريبي — قراءة محضة، لا تكتب حرفًا. */
export function useRulePreview(period: string, ruleId: string | null) {
  const { previewEvaluationRules } = useUseCases();

  return useQuery({
    queryKey: [...EVAL_PREVIEW_KEY, period, ruleId ?? "all"],
    queryFn: async () =>
      unwrap(await previewEvaluationRules.execute({ period, ruleId })),
    enabled: period !== "",
  });
}

/** التطبيق يغيّر الدرجة، فيُبطل التقرير والملخّص والسجلّ معًا. */
function useEvaluationWrite<TInput, TOut>(run: (input: TInput) => Promise<TOut>) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: run,
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: EVAL_PREVIEW_KEY });
      await queryClient.invalidateQueries({ queryKey: EVAL_PERIOD_KEY });
      await queryClient.invalidateQueries({ queryKey: EVALUATION_KEY });
      await queryClient.invalidateQueries({ queryKey: EVAL_AUDIT_KEY });
    },
  });
}

export function useApplyEvaluationRules() {
  const { applyEvaluationRules } = useUseCases();

  return useEvaluationWrite(async (input: { period: string; ruleId: string | null }) =>
    unwrap(await applyEvaluationRules.execute(input)),
  );
}

export function useRevokeEvaluationRule() {
  const { revokeEvaluationRule } = useUseCases();

  return useEvaluationWrite(async (input: { period: string; ruleId: string }) =>
    unwrap(await revokeEvaluationRule.execute(input)),
  );
}

export function useEvaluationPeriodReport(period: string) {
  const { listEvaluationPeriodReport } = useUseCases();

  return useQuery({
    queryKey: [...EVAL_PERIOD_KEY, period],
    queryFn: async () => unwrap(await listEvaluationPeriodReport.execute({ period })),
    enabled: period !== "",
  });
}

export function useTakeSnapshot() {
  const { takeEvaluationSnapshot } = useUseCases();

  return useEvaluationWrite(async (input: { period: string; currentPeriod: string }) =>
    unwrap(await takeEvaluationSnapshot.execute(input)),
  );
}

export function useClearSnapshot() {
  const { clearEvaluationSnapshot } = useUseCases();

  return useEvaluationWrite(async (input: { period: string; reason: string }) =>
    unwrap(await clearEvaluationSnapshot.execute(input)),
  );
}

export function useEvaluationAudit(period: string | null) {
  const { listEvaluationAudit } = useUseCases();

  return useQuery({
    queryKey: [...EVAL_AUDIT_KEY, period ?? "all"],
    queryFn: async () => unwrap(await listEvaluationAudit.execute({ period })),
  });
}
