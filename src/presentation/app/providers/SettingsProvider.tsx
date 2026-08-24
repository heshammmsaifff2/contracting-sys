/**
 * يحمّل جدول settings مرة واحدة ويوفّره للتطبيق كلّه.
 * القيم الاحتياطية في config تُستخدم فقط قبل اكتمال التحميل أو عند تعذّره.
 */
import { useMemo, type ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import type { CurrencyCode } from "@core/shared/value-objects/money";
import { FALLBACK_CURRENCY, FALLBACK_VAT_RATE } from "@config/app";
import { unwrap } from "@presentation/shared/lib/query";
import { useContainer } from "./di-context";
import { useAuth } from "./auth-context";
import { SettingsContext, type SettingsContextValue } from "./settings-context";

const SUPPORTED_CURRENCIES: readonly CurrencyCode[] = ["EGP", "SAR", "USD", "AED"];

function toCurrency(raw: string): CurrencyCode {
  return SUPPORTED_CURRENCIES.includes(raw as CurrencyCode)
    ? (raw as CurrencyCode)
    : FALLBACK_CURRENCY;
}

const FALLBACK = {
  companyName: "",
  defaultCurrency: FALLBACK_CURRENCY as string,
  vatRate: FALLBACK_VAT_RATE,
  fiscalYearStartMonth: 1,
};

export function SettingsProvider({ children }: { children: ReactNode }) {
  const container = useContainer();
  const { user } = useAuth();

  const query = useQuery({
    queryKey: ["app-settings"],
    queryFn: async () =>
      unwrap(await container.useCases.getAppSettings.execute({ fallback: FALLBACK })),
    // جدول settings محجوب عن الزائر غير المسجّل (revoke from anon)،
    // فلا نطلبه قبل وجود جلسة حتى لا يرتدّ 401 بلا فائدة.
    enabled: user !== null,
    staleTime: 5 * 60_000,
    retry: false,
  });

  const value = useMemo<SettingsContextValue>(() => {
    const settings = query.data ?? FALLBACK;
    return {
      ...settings,
      currency: toCurrency(settings.defaultCurrency),
      // بلا مستخدم لا يوجد تحميل أصلًا — نعمل بالقيم الاحتياطية
      isLoading: user !== null && query.isPending,
    };
  }, [query.data, query.isPending, user]);

  return <SettingsContext.Provider value={value}>{children}</SettingsContext.Provider>;
}
