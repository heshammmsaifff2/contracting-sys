export interface SettingDto {
  key: string;
  value: unknown;
  description: string;
  category: string;
}

/**
 * الإعدادات المُفسَّرة التي يعتمد عليها التطبيق.
 * كل قيمة هنا مصدرها جدول settings لا الكود.
 */
export interface AppSettings {
  companyName: string;
  defaultCurrency: string;
  vatRate: number;
  fiscalYearStartMonth: number;
}
