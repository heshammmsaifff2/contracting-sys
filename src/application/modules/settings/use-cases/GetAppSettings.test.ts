import { describe, expect, it } from "vitest";
import { ok, okVoid } from "@core/shared/result";
import type { ISettingsRepository } from "../ports/settings-repository";
import type { SettingDto } from "../dtos";
import { GetAppSettings } from "./GetAppSettings";

const FALLBACK = {
  companyName: "",
  defaultCurrency: "EGP",
  vatRate: 14,
  fiscalYearStartMonth: 1,
};

function makeRepo(rows: SettingDto[]): ISettingsRepository {
  return {
    list: async () => ok(rows),
    update: async () => okVoid(),
  };
}

function row(key: string, value: unknown): SettingDto {
  return { key, value, description: "", category: "general" };
}

describe("GetAppSettings", () => {
  it("يقرأ القيم من قاعدة البيانات لا من الكود", async () => {
    const useCase = new GetAppSettings(
      makeRepo([
        row("default_currency", "EGP"),
        row("vat_rate", 14),
        row("company_name", "شركة الاختبار"),
      ]),
    );

    const result = await useCase.execute({ fallback: FALLBACK });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.defaultCurrency).toBe("EGP");
    expect(result.value.vatRate).toBe(14);
    expect(result.value.companyName).toBe("شركة الاختبار");
  });

  it("يستخدم القيمة الاحتياطية عند غياب المفتاح أو فساد نوعه", async () => {
    const useCase = new GetAppSettings(makeRepo([row("vat_rate", "ليس رقمًا")]));

    const result = await useCase.execute({ fallback: FALLBACK });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.vatRate).toBe(14);
    expect(result.value.fiscalYearStartMonth).toBe(1);
  });
});
