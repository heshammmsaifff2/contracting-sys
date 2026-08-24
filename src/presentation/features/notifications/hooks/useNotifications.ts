/**
 * الإشعارات — تُقرأ دوريًا ليصل «الإشعار الفوري» عند تنزيل الكميات
 * دون أن يحتاج المستخدم لتحديث الصفحة [المخازن 18، 19].
 */
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useUseCases } from "@presentation/app/providers/di-context";
import { unwrap } from "@presentation/shared/lib/query";

export const NOTIFICATIONS_KEY = ["notifications"] as const;

/** فترة التحديث بالمللي ثانية — قصيرة بما يكفي ليبدو الإشعار فوريًا. */
const REFETCH_MS = 30_000;

export function useNotifications(limit = 20) {
  const { listNotifications } = useUseCases();
  return useQuery({
    queryKey: [...NOTIFICATIONS_KEY, limit],
    queryFn: async () =>
      unwrap(await listNotifications.execute({ unreadOnly: false, limit })),
    refetchInterval: REFETCH_MS,
  });
}

export function useMarkNotificationsRead() {
  const { markNotificationsRead } = useUseCases();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (ids: readonly string[]) =>
      unwrap(await markNotificationsRead.execute({ ids })),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: NOTIFICATIONS_KEY }),
  });
}
