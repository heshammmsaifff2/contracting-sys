import { describe, expect, it, vi } from "vitest";
import { ok, okVoid, type Result } from "@core/shared/result";
import type { DomainError } from "@core/shared/errors/domain-error";
import { InfrastructureError } from "@core/shared/errors/domain-error";
import { err } from "@core/shared/result";
import type { OpeningBalanceDto } from "../dtos";
import type { IAccountingPoster } from "../ports/accounting-poster";
import type { IOpeningBalanceRepository } from "../ports/opening-balance-repository";
import { ApproveOpeningBalance } from "./ApproveOpeningBalance";

const ID = "bbbbbbbb-0000-0000-0000-000000000001";

function balance(status: "draft" | "approved"): OpeningBalanceDto {
  return {
    id: ID,
    accountId: "a1",
    accountCode: "1101",
    accountName: "البنك",
    projectId: null,
    projectName: null,
    amount: 250000,
    asOf: "2026-01-01",
    status,
    notes: "",
  };
}

function makeRepo(current: OpeningBalanceDto): IOpeningBalanceRepository {
  return {
    list: async () => ok([current]),
    findById: async (): Promise<Result<OpeningBalanceDto | null, DomainError>> =>
      ok(current),
    create: async () => ok(current),
    approve: async () => ok({ ...current, status: "approved" as const }),
    remove: async () => okVoid(),
  };
}

function makePoster() {
  const post = vi.fn(async () => ok({ entryId: "entry-1" }));
  const poster: IAccountingPoster = { post };
  return { poster, post };
}

describe("ApproveOpeningBalance", () => {
  it("يعتمد المسودّة ثم يُطلق الترحيل الآلي", async () => {
    const { poster, post } = makePoster();
    const useCase = new ApproveOpeningBalance(makeRepo(balance("draft")), poster);

    const result = await useCase.execute({ id: ID });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.balance.status).toBe("approved");
    expect(result.value.entryId).toBe("entry-1");
    expect(post).toHaveBeenCalledWith("opening_balance", ID);
  });

  it("يرفض اعتماد رصيد معتمَد ولا يرحّل مرتين", async () => {
    const { poster, post } = makePoster();
    const useCase = new ApproveOpeningBalance(makeRepo(balance("approved")), poster);

    const result = await useCase.execute({ id: ID });

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe("CONFLICT");
    expect(post).not.toHaveBeenCalled();
  });

  it("يعيد الخطأ إن فشل الترحيل بعد الاعتماد", async () => {
    const poster: IAccountingPoster = {
      post: async () => err(new InfrastructureError("تعذّر الترحيل")),
    };
    const useCase = new ApproveOpeningBalance(makeRepo(balance("draft")), poster);

    const result = await useCase.execute({ id: ID });

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe("INFRASTRUCTURE");
  });

  it("يرفض رصيدًا غير موجود", async () => {
    const { poster } = makePoster();
    const repo: IOpeningBalanceRepository = {
      ...makeRepo(balance("draft")),
      findById: async () => ok(null),
    };
    const useCase = new ApproveOpeningBalance(repo, poster);

    const result = await useCase.execute({ id: ID });
    expect(result.ok).toBe(false);
  });
});
