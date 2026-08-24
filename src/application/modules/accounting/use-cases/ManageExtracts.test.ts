import { describe, expect, it, vi } from "vitest";
import { ConflictError } from "@core/shared/errors/domain-error";
import { err, ok, okVoid } from "@core/shared/result";
import type { IAccountingPoster } from "../ports/accounting-poster";
import type { ExtractDto } from "../dtos/documents";
import type { IExtractRepository } from "../ports/document-repositories";
import { ApproveExtract, SetExtractLineQty } from "./ManageExtracts";

const ID = "eeeeeeee-0000-0000-0000-000000000001";

function extract(status: ExtractDto["status"]): ExtractDto {
  return {
    id: ID,
    no: 1,
    seq: 1,
    projectId: "p1",
    projectName: "مشروع",
    contractorId: "c1",
    contractorCode: "CON-1",
    contractorName: "مقاول",
    extractDate: "2026-08-01",
    status,
    isFinal: false,
    grossAmount: 40000,
    deductionsAmount: 2400,
    retentionReleased: 0,
    netAmount: 37600,
    notes: "",
    approvedAt: null,
    lines: [],
    deductions: [],
  };
}

function makeRepo(overrides: Partial<IExtractRepository> = {}) {
  const approve = vi.fn(async () => okVoid());
  const repo: IExtractRepository = {
    list: async () => ok([]),
    findById: async () => ok(extract("approved")),
    generate: async () => ok({ id: ID }),
    setLineQty: async () => okVoid(),
    setFinal: async () => okVoid(),
    setNotes: async () => okVoid(),
    approve,
    ...overrides,
  };
  return { repo, approve };
}

function makePoster() {
  const post = vi.fn(async () => ok({ entryId: "entry-9" }));
  const poster: IAccountingPoster = { post };
  return { poster, post };
}

describe("ApproveExtract — الاعتماد ثم القيد الآلي [الحسابات 19]", () => {
  it("يعتمد ثم يرحّل بنوع الحدث الصحيح", async () => {
    const { repo, approve } = makeRepo();
    const { poster, post } = makePoster();

    const result = await new ApproveExtract(repo, poster).execute({ id: ID });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(approve).toHaveBeenCalledWith(ID);
    expect(post).toHaveBeenCalledWith("extract_approval", ID);
    expect(result.value.entryId).toBe("entry-9");
    expect(result.value.extract.netAmount).toBe(37600);
  });

  it("لا يرحّل إذا رفض الخادم الاعتماد", async () => {
    const { repo } = makeRepo({
      approve: async () => err(new ConflictError("المستخلص معتمَد بالفعل")),
    });
    const { poster, post } = makePoster();

    const result = await new ApproveExtract(repo, poster).execute({ id: ID });

    expect(result.ok).toBe(false);
    expect(post).not.toHaveBeenCalled();
  });

  it("يفشل بوضوح إن اختفى المستخلص بعد الترحيل", async () => {
    const { repo } = makeRepo({ findById: async () => ok(null) });
    const { poster } = makePoster();

    const result = await new ApproveExtract(repo, poster).execute({ id: ID });

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe("CONFLICT");
  });
});

describe("SetExtractLineQty — حد العقد قبل إرسال أي شيء", () => {
  it("يمرّر الكمية التي يغطّيها الحد", async () => {
    const { repo } = makeRepo();
    const setLineQty = vi.spyOn(repo, "setLineQty");

    const result = await new SetExtractLineQty(repo).execute({
      lineId: "l1",
      extractId: ID,
      currentQty: 60,
      maxQty: 100,
      prevQty: 40,
    });

    expect(result.ok).toBe(true);
    expect(setLineQty).toHaveBeenCalled();
  });

  it("يرفض ما يتجاوز الحد ولا يصل الخادم", async () => {
    const { repo } = makeRepo();
    const setLineQty = vi.spyOn(repo, "setLineQty");

    const result = await new SetExtractLineQty(repo).execute({
      lineId: "l1",
      extractId: ID,
      currentQty: 61,
      maxQty: 100,
      prevQty: 40,
    });

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe("VALIDATION");
    expect(setLineQty).not.toHaveBeenCalled();
  });
});
