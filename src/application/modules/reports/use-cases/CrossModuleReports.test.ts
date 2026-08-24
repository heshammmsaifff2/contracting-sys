import { describe, expect, it, vi } from "vitest";
import { ok } from "@core/shared/result";
import { ValidationError } from "@core/shared/errors/domain-error";
import type { IReportRepository } from "../ports/report-repository";
import {
  GetDepartmentFrequencyReport,
  GetDurationChangeReport,
  GetManualEntriesReport,
  GetPartyBalances,
  GetProjectCostReport,
} from "./CrossModuleReports";

function makeRepo(overrides: Partial<IReportRepository> = {}) {
  const repo: IReportRepository = {
    projectCosts: vi.fn(async () => ok([])),
    partyBalances: vi.fn(async () => ok([])),
    manualEntries: vi.fn(async () => ok([])),
    archivePending: vi.fn(async () => ok([])),
    durationChanges: vi.fn(async () => ok([])),
    overdueTransactions: vi.fn(async () => ok([])),
    departmentFrequency: vi.fn(async () => ok([])),
    ...overrides,
  };
  return repo;
}

describe("التقارير الشاملة — تمرير المرشّح كما هو", () => {
  it("يمرّر المشروع دون تعديل، فالتصفية تقع في الخادم", async () => {
    const repo = makeRepo();
    const filter = { projectId: "p1", from: null, to: null };

    await new GetProjectCostReport(repo).execute(filter);

    expect(repo.projectCosts).toHaveBeenCalledWith(filter);
  });

  it("يمرّر نوع الطرف مع المرشّح", async () => {
    const repo = makeRepo();

    await new GetPartyBalances(repo).execute({
      projectId: null,
      from: null,
      to: null,
      partyType: "supplier",
    });

    expect(repo.partyBalances).toHaveBeenCalledWith(
      expect.objectContaining({ partyType: "supplier" }),
    );
  });

  it("تقرير الأقسام بلا مرشّح — التردّد يُقاس على مستوى الشركة", async () => {
    const repo = makeRepo();

    await new GetDepartmentFrequencyReport(repo).execute();

    expect(repo.departmentFrequency).toHaveBeenCalledWith();
  });
});

describe("التقارير المؤرَّخة — المدى المقلوب خطأ لا نتيجة فارغة", () => {
  it("يردّ مدى القيود اليدوية المقلوب قبل أن يمسّ قاعدة البيانات", async () => {
    const repo = makeRepo();

    const result = await new GetManualEntriesReport(repo).execute({
      projectId: null,
      from: "2026-09-01",
      to: "2026-08-01",
    });

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error).toBeInstanceOf(ValidationError);
    expect(repo.manualEntries).not.toHaveBeenCalled();
  });

  it("يردّ مدى المدد المعدّلة المقلوب كذلك", async () => {
    const repo = makeRepo();

    const result = await new GetDurationChangeReport(repo).execute({
      projectId: null,
      from: "2026-12-31",
      to: "2026-01-01",
    });

    expect(result.ok).toBe(false);
    expect(repo.durationChanges).not.toHaveBeenCalled();
  });

  it("المدى المفتوح من طرف واحد مقبول", async () => {
    const repo = makeRepo();

    const result = await new GetManualEntriesReport(repo).execute({
      projectId: null,
      from: "2026-08-01",
      to: null,
    });

    expect(result.ok).toBe(true);
    expect(repo.manualEntries).toHaveBeenCalled();
  });

  it("المدى المتساوي الطرفين مقبول — يوم واحد", async () => {
    const repo = makeRepo();

    const result = await new GetManualEntriesReport(repo).execute({
      projectId: null,
      from: "2026-08-24",
      to: "2026-08-24",
    });

    expect(result.ok).toBe(true);
    expect(repo.manualEntries).toHaveBeenCalled();
  });
});
