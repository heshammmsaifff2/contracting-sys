/**
 * يقرأ جدول settings ويحوّله إلى كائن مُفسَّر يستهلكه التطبيق.
 * كل قيمة رقمية في النظام يجب أن تمرّ من هنا لا أن تُكتب في الكود.
 */
import type { DomainError } from "@core/shared/errors/domain-error";
import { ok, type Result } from "@core/shared/result";
import type { UseCase } from "@application/shared/use-case";
import type { AppSettings } from "../dtos";
import type { ISettingsRepository } from "../ports/settings-repository";

/** يُستخدم فقط إن غاب المفتاح من قاعدة البيانات. */
export interface GetAppSettingsInput {
  fallback: AppSettings;
}

function readString(value: unknown, fallback: string): string {
  return typeof value === "string" ? value : fallback;
}

function readNumber(value: unknown, fallback: number): number {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

export class GetAppSettings implements UseCase<GetAppSettingsInput, AppSettings> {
  private readonly settings: ISettingsRepository;

  constructor(settings: ISettingsRepository) {
    this.settings = settings;
  }

  async execute(input: GetAppSettingsInput): Promise<Result<AppSettings, DomainError>> {
    const rows = await this.settings.list();
    if (!rows.ok) return rows;

    const byKey = new Map(rows.value.map((row) => [row.key, row.value]));

    return ok({
      companyName: readString(byKey.get("company_name"), input.fallback.companyName),
      defaultCurrency: readString(
        byKey.get("default_currency"),
        input.fallback.defaultCurrency,
      ),
      vatRate: readNumber(byKey.get("vat_rate"), input.fallback.vatRate),
      fiscalYearStartMonth: readNumber(
        byKey.get("fiscal_year_start_month"),
        input.fallback.fiscalYearStartMonth,
      ),
    });
  }
}
