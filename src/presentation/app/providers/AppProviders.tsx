import type { ReactNode } from "react";
import type { Container } from "@infrastructure/di/container";
import { DIProvider } from "./DIProvider";
import { QueryProvider } from "./QueryProvider";
import { AuthProvider } from "./AuthProvider";
import { SettingsProvider } from "./SettingsProvider";

export interface AppProvidersProps {
  children: ReactNode;
  container?: Container;
}

/**
 * ترتيب المزوّدات مقصود:
 * DI أولًا (الكل يعتمد عليه) ← react-query ← المصادقة ← الإعدادات.
 */
export function AppProviders({ children, container }: AppProvidersProps) {
  return (
    <DIProvider {...(container === undefined ? {} : { container })}>
      <QueryProvider>
        <AuthProvider>
          <SettingsProvider>{children}</SettingsProvider>
        </AuthProvider>
      </QueryProvider>
    </DIProvider>
  );
}
