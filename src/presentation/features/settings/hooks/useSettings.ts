import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useUseCases } from "@presentation/app/providers/di-context";
import { unwrap } from "@presentation/shared/lib/query";

export const SETTINGS_KEY = ["settings-list"] as const;

export function useSettingsList() {
  const { listSettings } = useUseCases();
  return useQuery({
    queryKey: SETTINGS_KEY,
    queryFn: async () => unwrap(await listSettings.execute()),
  });
}

export function useUpdateSetting() {
  const { updateSetting } = useUseCases();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: { key: string; value: unknown }) =>
      unwrap(await updateSetting.execute(input)),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: SETTINGS_KEY });
      // الإعدادات المُفسَّرة (العملة، الضريبة) تتغيّر أيضًا
      await queryClient.invalidateQueries({ queryKey: ["app-settings"] });
    },
  });
}

// ── النسخة الاختبارية [الحسابات 1] ──────────────────────────────────────
export const DEMO_DATA_KEY = ["demo-data-status"] as const;

export function useDemoDataStatus(enabled: boolean) {
  const { getDemoDataStatus } = useUseCases();
  return useQuery({
    queryKey: DEMO_DATA_KEY,
    queryFn: async () => unwrap(await getDemoDataStatus.execute()),
    enabled,
  });
}

/**
 * التوليد والحذف يقلبان كل شاشة في النظام تقريبًا (مشاريع، أصناف، عهد،
 * قيود)، فلا يكفي إبطال مفتاح واحد — نُفرغ الذاكرة المؤقّتة كلها.
 */
function useDemoDataMutation(run: () => Promise<unknown>) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: run,
    onSuccess: async () => {
      await queryClient.invalidateQueries();
    },
  });
}

export function useSeedDemoData() {
  const { seedDemoData } = useUseCases();
  return useDemoDataMutation(async () => unwrap(await seedDemoData.execute()));
}

export function useClearDemoData() {
  const { clearDemoData } = useUseCases();
  return useDemoDataMutation(async () => unwrap(await clearDemoData.execute()));
}
