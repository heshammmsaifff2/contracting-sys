import { describe, expect, it, vi } from "vitest";
import { ok } from "@core/shared/result";
import type { IStockRepository } from "../ports/stock-repository";
import { IssueStockToMandoub, RecordFacilityConsumption } from "./ManageStock";

const PROJECT = "11111111-0000-0000-0000-000000000001";
const MANDOUB = "22222222-0000-0000-0000-000000000001";
const FACILITY = "33333333-0000-0000-0000-000000000001";

function makeRepo() {
  const issueToMandoub = vi.fn(async () => ok({ batchId: "batch-1" }));
  const recordConsumption = vi.fn(async () => ok({ batchId: "batch-2" }));
  const repo: IStockRepository = {
    listCustody: async () => ok([]),
    listMovements: async () => ok([]),
    issueToMandoub,
    returnFromMandoub: async () => ok({ batchId: "batch-3" }),
    listConsumption: async () => ok([]),
    recordConsumption,
  };
  return { repo, issueToMandoub, recordConsumption };
}

describe("IssueStockToMandoub — تسليم العهدة", () => {
  it("يمرّر السند السليم إلى الخادم", async () => {
    const { repo, issueToMandoub } = makeRepo();
    const useCase = new IssueStockToMandoub(repo);

    const result = await useCase.execute({
      projectId: PROJECT,
      mandoubId: MANDOUB,
      lines: [{ itemId: "i1", qty: 5 }],
      note: "",
    });

    expect(result.ok).toBe(true);
    expect(issueToMandoub).toHaveBeenCalledTimes(1);
  });

  it("يرفض السند بلا مندوب ولا يصل الخادم", async () => {
    const { repo, issueToMandoub } = makeRepo();
    const useCase = new IssueStockToMandoub(repo);

    const result = await useCase.execute({
      projectId: PROJECT,
      mandoubId: "",
      lines: [{ itemId: "i1", qty: 5 }],
      note: "",
    });

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe("VALIDATION");
    expect(issueToMandoub).not.toHaveBeenCalled();
  });

  it("يرفض الكمية الصفرية", async () => {
    const { repo, issueToMandoub } = makeRepo();
    const useCase = new IssueStockToMandoub(repo);

    const result = await useCase.execute({
      projectId: PROJECT,
      mandoubId: MANDOUB,
      lines: [{ itemId: "i1", qty: 0 }],
      note: "",
    });

    expect(result.ok).toBe(false);
    expect(issueToMandoub).not.toHaveBeenCalled();
  });
});

describe("RecordFacilityConsumption — تنزيل الكميات", () => {
  const input = {
    facilityId: FACILITY,
    mandoubId: MANDOUB,
    lines: [{ itemId: "i1", qty: 3 }],
    photos: [],
    note: "",
    consumedAt: null,
  };

  it("ينزّل ما تغطّيه العهدة", async () => {
    const { repo, recordConsumption } = makeRepo();
    const useCase = new RecordFacilityConsumption(repo);

    const result = await useCase.execute({
      ...input,
      available: new Map([["i1", 10]]),
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.batchId).toBe("batch-2");
    expect(recordConsumption).toHaveBeenCalledTimes(1);
  });

  it("لا يرسل حقل الرصيد المحلي إلى الخادم", async () => {
    const { repo, recordConsumption } = makeRepo();
    const useCase = new RecordFacilityConsumption(repo);

    await useCase.execute({ ...input, available: new Map([["i1", 10]]) });

    expect(recordConsumption).toHaveBeenCalledWith(input);
  });

  it("يمنع تنزيلًا يتجاوز عهدة المندوب", async () => {
    const { repo, recordConsumption } = makeRepo();
    const useCase = new RecordFacilityConsumption(repo);

    const result = await useCase.execute({
      ...input,
      available: new Map([["i1", 2]]),
    });

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe("VALIDATION");
    expect(recordConsumption).not.toHaveBeenCalled();
  });

  it("يرفض التنزيل بلا منشأة", async () => {
    const { repo, recordConsumption } = makeRepo();
    const useCase = new RecordFacilityConsumption(repo);

    const result = await useCase.execute({ ...input, facilityId: "" });

    expect(result.ok).toBe(false);
    expect(recordConsumption).not.toHaveBeenCalled();
  });
});
