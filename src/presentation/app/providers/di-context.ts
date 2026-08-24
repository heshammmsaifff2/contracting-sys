/**
 * سياق حقن التبعيات. الـ Hooks تسحب use-case جاهزًا من الـ container
 * ولا تُنشئه بنفسها ولا تعرف تحقيقه.
 */
import { createContext, useContext } from "react";
import type { Container } from "@infrastructure/di/container";

export const DIContext = createContext<Container | null>(null);

export function useContainer(): Container {
  const container = useContext(DIContext);
  if (container === null) {
    throw new Error("useContainer يجب أن يُستخدم داخل <DIProvider>");
  }
  return container;
}

/** اختصار للوصول إلى الـ use-cases مباشرة. */
export function useUseCases(): Container["useCases"] {
  return useContainer().useCases;
}
