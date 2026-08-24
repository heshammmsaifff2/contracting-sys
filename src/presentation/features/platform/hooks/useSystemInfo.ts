import { useQuery } from "@tanstack/react-query";
import { useUseCases } from "@presentation/app/providers/di-context";
import { unwrap } from "@presentation/shared/lib/query";
import { APP_NAME, CURRENT_PHASE } from "@config/app";
import { mode } from "@config/env";

/**
 * يسحب الـ use-case من الـ container ولا ينشئه — إثبات عملي لعمل الـ DI.
 */
export function useSystemInfo() {
  const { getSystemInfo } = useUseCases();

  return useQuery({
    queryKey: ["system-info", mode],
    queryFn: async () =>
      unwrap(
        await getSystemInfo.execute({
          appName: APP_NAME,
          environment: mode,
          currentPhase: CURRENT_PHASE,
        }),
      ),
  });
}
