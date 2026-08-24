/**
 * يحمل المستخدم الحالي مرة واحدة ويعيد تحميله عند تغيّر الجلسة.
 * تذكير: هذا للواجهة فقط — الأمان الحقيقي في سياسات RLS على الخادم.
 */
import { useCallback, useEffect, useMemo, type ReactNode } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useContainer } from "./di-context";
import { AuthContext, type AuthContextValue } from "./auth-context";
import { unwrap } from "@presentation/shared/lib/query";

const CURRENT_USER_KEY = ["current-user"] as const;

export function AuthProvider({ children }: { children: ReactNode }) {
  const container = useContainer();
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: CURRENT_USER_KEY,
    queryFn: async () => unwrap(await container.useCases.getCurrentUser.execute()),
    staleTime: 60_000,
    retry: false,
  });

  // أي تغيّر في الجلسة (دخول/خروج/تجديد رمز) يُبطل صورة المستخدم المحمّلة
  useEffect(() => {
    return container.authService.onAuthStateChange(() => {
      void queryClient.invalidateQueries({ queryKey: CURRENT_USER_KEY });
    });
  }, [container, queryClient]);

  const refresh = useCallback(async () => {
    await queryClient.invalidateQueries({ queryKey: CURRENT_USER_KEY });
  }, [queryClient]);

  const value = useMemo<AuthContextValue>(
    () => ({
      user: query.data ?? null,
      isLoading: query.isPending,
      refresh,
    }),
    [query.data, query.isPending, refresh],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
