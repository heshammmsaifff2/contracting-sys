import type { ReactNode } from "react";
import { useMemo } from "react";
import { createContainer, type Container } from "@infrastructure/di/container";
import { DIContext } from "./di-context";

export interface DIProviderProps {
  children: ReactNode;
  /** الاختبارات تمرّر container مزيّفًا بالكامل. */
  container?: Container;
}

export function DIProvider({ children, container }: DIProviderProps) {
  const value = useMemo(() => container ?? createContainer(), [container]);
  return <DIContext.Provider value={value}>{children}</DIContext.Provider>;
}
