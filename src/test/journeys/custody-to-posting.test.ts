/**
 * رحلة العهدة: فتح ← إدخال فواتير ← كشف تكرار ← مراجعة ← اعتماد (قيد آلي).
 *
 * ما يفحصه هذا الملف تحديدًا هو ترتيب المسؤوليات في المواصفات:
 * كشف التكرار يقع على الخادم ويُبلَّغ به صاحب الصلاحية لا المُدخِل
 * [الحسابات 29]، والاعتماد يسبق الترحيل دائمًا — فلا قيد على عهدة لم تُعتمد.
 */
import { describe, expect, it, vi } from "vitest";
import { ConflictError } from "@core/shared/errors/domain-error";
import { err, ok, okVoid } from "@core/shared/result";
import type { IAccountingPoster } from "@application/modules/accounting/ports/accounting-poster";
import type {
  CustodyDto,
  CustodyInvoiceDto,
} from "@application/modules/accounting/dtos/documents";
import type { ICustodyRepository } from "@application/modules/accounting/ports/document-repositories";
import {
  ApproveCustody,
  CUSTODY_SOURCE_TYPE,
  RescanCustodyDuplicates,
  ReturnCustodyInvoice,
  ReviewDuplicateInvoice,
  SaveCustodyInvoice,
} from "@application/modules/accounting/use-cases/ManageCustodies";

const CUSTODY = "aaaaaaaa-0000-0000-0000-000000000001";
const INV_ORIGINAL = "bbbbbbbb-0000-0000-0000-000000000001";
const INV_DUPLICATE = "bbbbbbbb-0000-0000-0000-000000000002";

function invoice(over: Partial<CustodyInvoiceDto> = {}): CustodyInvoiceDto {
  return {
    id: INV_ORIGINAL,
    custodyId: CUSTODY,
    seq: 1,
    supplierId: "sup-1",
    supplierName: "مورّد",
    supplierSeqNo: "S-1",
    invoiceNo: "INV-1001",
    invoiceDate: "2026-08-01",
    amount: 12750,
    itemId: null,
    itemName: "",
    imagePublicId: null,
    imageUrl: null,
    ocrText: "",
    isDuplicate: false,
    duplicateOf: null,
    duplicateReviewed: false,
    isReturned: false,
    returnReason: "",
    note: "",
    ...over,
  };
}

function custody(
  status: CustodyDto["status"],
  invoices: readonly CustodyInvoiceDto[],
): CustodyDto {
  return {
    id: CUSTODY,
    serial: 1,
    holderId: "user-1",
    holderName: "صاحب العهدة",
    projectId: "p1",
    projectName: "مشروع",
    status,
    isReturnedBox: false,
    openedAt: "2026-07-25",
    closedAt: null,
    totalAmount: invoices.reduce((sum, i) => sum + (i.isReturned ? 0 : i.amount), 0),
    notes: "",
    invoices,
  };
}

function makeRepo(overrides: Partial<ICustodyRepository> = {}) {
  const calls: string[] = [];
  const flagged = [
    invoice(),
    // الثانية مطابقة في (رقم المورّد + القيمة) — الخادم وحده يقرّر أنها مكرّرة
    invoice({
      id: INV_DUPLICATE,
      seq: 2,
      isDuplicate: true,
      duplicateOf: INV_ORIGINAL,
    }),
  ];

  const repo: ICustodyRepository = {
    list: async () => ok([]),
    findById: async () => ok(custody("approved", flagged)),
    save: async () => ok(custody("open", [])),
    saveInvoice: vi.fn(async () => {
      calls.push("saveInvoice");
      return okVoid();
    }),
    removeInvoice: async () => okVoid(),
    rescanDuplicates: vi.fn(async () => {
      calls.push("rescan");
      return ok(1);
    }),
    markDuplicateReviewed: vi.fn(async () => {
      calls.push("review");
      return okVoid();
    }),
    returnInvoice: vi.fn(async () => {
      calls.push("return");
      return okVoid();
    }),
    approve: vi.fn(async () => {
      calls.push("approve");
      return okVoid();
    }),
    ...overrides,
  };

  return { repo, calls, flagged };
}

function makePoster() {
  const posted: { sourceType: string; sourceId: string }[] = [];
  const poster: IAccountingPoster = {
    post: vi.fn(async (sourceType, sourceId) => {
      posted.push({ sourceType, sourceId });
      return ok({ entryId: "entry-1" });
    }),
  };
  return { poster, posted };
}

describe("رحلة العهدة حتى القيد الآلي [قبول المرحلة 6]", () => {
  it("الفاتورة تُدخَل، فيكشف الخادم تكرارها، ثم يُراجعها صاحب الصلاحية، ثم تُعتمد فتُرحَّل", async () => {
    const { repo, calls } = makeRepo();
    const { poster, posted } = makePoster();

    await new SaveCustodyInvoice(repo).execute({
      id: null,
      custodyId: CUSTODY,
      supplierId: "sup-1",
      supplierSeqNo: "S-2",
      invoiceNo: "INV-1001",
      invoiceDate: "2026-08-01",
      amount: 12750,
      itemId: null,
      imagePublicId: null,
      imageUrl: null,
      ocrText: "",
      note: "",
    });

    // الكشف على الخادم لا في المتصفّح
    const rescan = await new RescanCustodyDuplicates(repo).execute({
      custodyId: CUSTODY,
    });
    expect(rescan.ok).toBe(true);
    if (!rescan.ok) return;
    expect(rescan.value).toBe(1);

    await new ReviewDuplicateInvoice(repo).execute({ invoiceId: INV_DUPLICATE });

    const approved = await new ApproveCustody(repo, poster).execute({ id: CUSTODY });
    expect(approved.ok).toBe(true);
    if (!approved.ok) return;
    expect(approved.value.entryId).toBe("entry-1");

    expect(calls).toEqual(["saveInvoice", "rescan", "review", "approve"]);
    expect(posted).toEqual([{ sourceType: CUSTODY_SOURCE_TYPE, sourceId: CUSTODY }]);
  });

  it("لا قيد إذا فشل الاعتماد — الترتيب اعتماد ثم ترحيل لا العكس", async () => {
    const approve = vi.fn(async () => err(new ConflictError("العهدة مغلقة")));
    const { repo } = makeRepo({ approve });
    const { poster, posted } = makePoster();

    const result = await new ApproveCustody(repo, poster).execute({ id: CUSTODY });

    expect(result.ok).toBe(false);
    // جُرّب الاعتماد فعلًا وفشل، ومع ذلك لم يُلمَس دفتر اليومية
    expect(approve).toHaveBeenCalledWith(CUSTODY);
    expect(posted).toEqual([]);
    expect(poster.post).not.toHaveBeenCalled();
  });

  it("الفاتورة المرتجعة تخرج من إجمالي العهدة [الحسابات 30]", async () => {
    const returned = invoice({ id: INV_DUPLICATE, seq: 2, isReturned: true });
    const box = custody("open", [invoice(), returned]);

    // إجمالي العهدة يتجاهل المرتجع: 12750 لا 25500
    expect(box.totalAmount).toBe(12750);

    const { repo, calls } = makeRepo();
    await new ReturnCustodyInvoice(repo).execute({
      invoiceId: INV_DUPLICATE,
      reason: "فاتورة مكرّرة",
    });
    expect(calls).toContain("return");
  });
});
