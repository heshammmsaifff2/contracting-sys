import { createContext, useContext } from "react";
import type { AppSettings } from "@application/modules/settings/dtos";
import type { CurrencyCode } from "@core/shared/value-objects/money";

export interface SettingsContextValue extends AppSettings {
  /** العملة بعد تضييق النوع — للاستخدام مع كائن Money. */
  currency: CurrencyCode;
  isLoading: boolean;
}

export const SettingsContext = createContext<SettingsContextValue | null>(null);

/**
 * كل رقم أو نسبة في الواجهة يجب أن يأتي من هنا، لا من ثابت في الكود.
 */
export function useAppSettings(): SettingsContextValue {
  const value = useContext(SettingsContext);
  if (value === null) {
    throw new Error("useAppSettings يجب أن يُستخدم داخل <SettingsProvider>");
  }
  return value;
}
