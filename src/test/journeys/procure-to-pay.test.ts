/**
 * رحلة المشتريات الكاملة: احتياج ← شراء ← تسعير ← مقارنة ← توريد ←
 * استلام (قيد آلي) ← تحويل (قيد آلي).
 *
 * الاختبارات الوحدوية تفحص كل حلقة على حدة. هذا الملف يفحص ما لا تفحصه:
 * أن الحلقات تتّصل فعلًا — أن معرّف المستند الخارج من حلقة هو الداخل إلى
 * التي تليها، وأن الترحيل يقع بنوع الحدث الصحيح وفي موضعه من التسلسل،
 * وأن المستخدم لم يُطالَب بإعادة إدخال بيان أُدخل مرّة.
 *
 * المنافذ مُزيَّفة هنا بذاكرة بسيطة: الغرض فحص التسلسل والعقود، لا فحص SQL.
 */
import { describe, expect, it, vi } from "vitest";
import { ok, okVoid } from "@core/shared/result";
import type { IAccountingPoster } from "@application/modules/accounting/ports/accounting-poster";
import type {
  PaymentRequestDto,
  PriceComparisonRowDto,
  SupplyOrderDto,
} from "@application/modules/procurement/dtos";
import type { IPaymentRepository } from "@application/modules/procurement/ports/payment-repository";
import type { IProcurementWorkflow } from "@application/modules/procurement/ports/procurement-workflow";
import type { IPurchaseRepository } from "@application/modules/procurement/ports/purchase-repository";
import {
  ApproveSupplyOrder,
  ComparePrices,
  ConfirmReceipt,
  GeneratePaymentRequest,
  GeneratePurchaseRequest,
  GenerateReceiptRequests,
  GenerateSupplyOrder,
  RECEIPT_SOURCE_TYPE,
  SaveSupplierQuote,
} from "@application/modules/procurement/use-cases/ProcurementChain";
import {
  PAYMENT_SOURCE_TYPE,
  TransferPayment,
} from "@application/modules/procurement/use-cases/ManagePayments";

const MR_A = "11111111-1111-1111-1111-111111111111";
const MR_B = "11111111-1111-1111-1111-111111111112";
const PR = "22222222-2222-2222-2222-222222222222";
const SO = "33333333-3333-3333-3333-333333333333";
const RR = "44444444-4444-4444-4444-444444444444";
const PAY = "55555555-5555-5555-5555-555555555555";
const SUPPLIER_CHEAP = "66666666-6666-6666-6666-666666666661";
const SUPPLIER_PRICEY = "66666666-6666-6666-6666-666666666662";
const ITEM = "77777777-7777-7777-7777-777777777777";

function makeWorkflow() {
  const calls: string[] = [];

  const workflow: IProcurementWorkflow = {
    generatePurchaseRequest: vi.fn(async (ids) => {
      calls.push(`purchase:${[...ids].sort().join(",")}`);
      return ok({ purchaseRequestId: PR });
    }),
    generateSupplyOrder: vi.fn(async (prId, supplierId) => {
      calls.push(`supply:${prId}:${supplierId}`);
      return ok({ supplyOrderId: SO });
    }),
    generateReceiptRequests: vi.fn(async (soId) => {
      calls.push(`receipts:${soId}`);
      return ok({ created: 2 });
    }),
    confirmReceipt: vi.fn(async (rrId) => {
      calls.push(`confirm:${rrId}`);
      return okVoid();
    }),
    generatePaymentRequest: vi.fn(async (soId) => {
      calls.push(`payment:${soId}`);
      return ok({ paymentRequestId: PAY });
    }),
  };

  return { workflow, calls };
}

function comparison(): readonly PriceComparisonRowDto[] {
  // المقارنة تأتي مرتّبة من الخادم و`priceRank = 1` هو الأرخص —
  // الواجهة لا تعيد الترتيب ولا تحسب الفائز بنفسها
  return [
    {
      itemId: ITEM,
      itemCode: "IT-1",
      itemName: "أسمنت",
      itemUnit: "طن",
      requiredQty: 100,
      supplierId: SUPPLIER_CHEAP,
      supplierCode: "SUP-2",
      supplierName: "الأرخص",
      unitPrice: 2050,
      lineTotal: 205000,
      priceRank: 1,
    },
    {
      itemId: ITEM,
      itemCode: "IT-1",
      itemName: "أسمنت",
      itemUnit: "طن",
      requiredQty: 100,
      supplierId: SUPPLIER_PRICEY,
      supplierCode: "SUP-1",
      supplierName: "الأغلى",
      unitPrice: 2100,
      lineTotal: 210000,
      priceRank: 2,
    },
  ];
}

function makePurchaseRepo() {
  const orders: SupplyOrderDto[] = [];
  const statusCalls: { id: string; status: string }[] = [];

  const repo: IPurchaseRepository = {
    listPurchaseRequests: async () => ok([]),
    comparePrices: async () => ok(comparison()),
    saveQuote: vi.fn(async () => okVoid()),
    listSupplyOrders: async () => ok(orders),
    setSupplyOrderStatus: vi.fn(async (id, status) => {
      statusCalls.push({ id, status });
      return okVoid();
    }),
  };

  return { repo, statusCalls };
}

function payment(status: PaymentRequestDto["status"]): PaymentRequestDto {
  return {
    id: PAY,
    no: 1,
    sourceType: "supply_order",
    sourceId: SO,
    partyType: "supplier",
    partyId: SUPPLIER_CHEAP,
    partyName: "الأرخص",
    bankAccountId: "bank-1",
    bankName: "بنك",
    accountNo: "ACC-1",
    projectId: "p1",
    projectName: "مشروع",
    amount: 205000,
    bankFeeCompany: 0,
    bankFeeClient: 0,
    status,
    transferredAt: null,
  };
}

function makePaymentRepo() {
  const repo: IPaymentRepository = {
    list: async () => ok([payment("pending")]),
    findById: async () => ok(payment("pending")),
    markTransferred: vi.fn(async () => ok(payment("transferred"))),
  };
  return repo;
}

function makePoster() {
  const posted: { sourceType: string; sourceId: string }[] = [];
  const poster: IAccountingPoster = {
    post: vi.fn(async (sourceType, sourceId) => {
      posted.push({ sourceType, sourceId });
      return ok({ entryId: `entry-${posted.length}` });
    }),
  };
  return { poster, posted };
}

describe("رحلة المشتريات الكاملة [قبول المرحلة 3]", () => {
  it("تمرّ الحلقات بالترتيب ويحمل كل مستند معرّف سابقه", async () => {
    const { workflow, calls } = makeWorkflow();
    const { repo: purchaseRepo, statusCalls } = makePurchaseRepo();
    const { poster, posted } = makePoster();
    const paymentRepo = makePaymentRepo();

    // 1) دمج احتياجَي مشروعين في طلب شراء واحد [المشتريات 7]
    const pr = await new GeneratePurchaseRequest(workflow).execute({
      materialRequestIds: [MR_A, MR_B],
    });
    expect(pr.ok).toBe(true);
    if (!pr.ok) return;
    expect(pr.value.purchaseRequestId).toBe(PR);

    // 2) تسعير من مورّدين
    const quote = await new SaveSupplierQuote(purchaseRepo).execute({
      purchaseRequestId: pr.value.purchaseRequestId,
      supplierId: SUPPLIER_CHEAP,
      lines: [{ itemId: ITEM, unitPrice: 2050 }],
    });
    expect(quote.ok).toBe(true);

    // 3) المقارنة تُعلّم الأرخص — لا يحسبها المتصفّح
    const compared = await new ComparePrices(purchaseRepo).execute({
      purchaseRequestId: pr.value.purchaseRequestId,
    });
    expect(compared.ok).toBe(true);
    if (!compared.ok) return;
    const cheapest = compared.value.find((row) => row.priceRank === 1);
    expect(cheapest?.supplierId).toBe(SUPPLIER_CHEAP);

    // 4) أمر توريد للمورّد الفائز — بمعرّف طلب الشراء نفسه
    const so = await new GenerateSupplyOrder(workflow).execute({
      purchaseRequestId: pr.value.purchaseRequestId,
      supplierId: cheapest?.supplierId ?? "",
    });
    expect(so.ok).toBe(true);
    if (!so.ok) return;

    await new ApproveSupplyOrder(purchaseRepo).execute({ id: so.value.supplyOrderId });
    expect(statusCalls).toEqual([{ id: SO, status: "approved" }]);

    // 5) طلبات الاستلام: واحد لكل مشروع في الأمر
    const receipts = await new GenerateReceiptRequests(workflow).execute({
      supplyOrderId: so.value.supplyOrderId,
    });
    expect(receipts.ok).toBe(true);
    if (!receipts.ok) return;
    expect(receipts.value.created).toBe(2);

    // 6) تأكيد الاستلام ⇒ قيد آلي
    const confirmed = await new ConfirmReceipt(workflow, poster).execute({
      receiptRequestId: RR,
    });
    expect(confirmed.ok).toBe(true);

    // 7) طلب الدفع من أمر التوريد ⇒ تحويل ⇒ قيد آلي
    const payReq = await new GeneratePaymentRequest(workflow).execute({
      supplyOrderId: so.value.supplyOrderId,
    });
    expect(payReq.ok).toBe(true);
    if (!payReq.ok) return;

    const transferred = await new TransferPayment(paymentRepo, poster).execute({
      id: payReq.value.paymentRequestId,
      bankFeeCompany: 0,
      bankFeeClient: 0,
    });
    expect(transferred.ok).toBe(true);

    // التسلسل كما تفرضه المواصفات، ومعرّف كل مستند مشتقّ من سابقه
    expect(calls).toEqual([
      `purchase:${[MR_A, MR_B].sort().join(",")}`,
      `supply:${PR}:${SUPPLIER_CHEAP}`,
      `receipts:${SO}`,
      `confirm:${RR}`,
      `payment:${SO}`,
    ]);

    // قيدان آليان لا أكثر، كلٌّ بنوع حدثه ومرجعه
    expect(posted).toEqual([
      { sourceType: RECEIPT_SOURCE_TYPE, sourceId: RR },
      { sourceType: PAYMENT_SOURCE_TYPE, sourceId: PAY },
    ]);
  });

  it("الاحتياج المكرّر لا يُنتج طلب شراء مكرّرًا", async () => {
    const { workflow } = makeWorkflow();

    const result = await new GeneratePurchaseRequest(workflow).execute({
      materialRequestIds: [MR_A, MR_A, MR_B],
    });

    expect(result.ok).toBe(true);
    expect(workflow.generatePurchaseRequest).toHaveBeenCalledWith(
      expect.arrayContaining([MR_A, MR_B]),
    );
    const passed = vi.mocked(workflow.generatePurchaseRequest).mock.calls[0]?.[0] ?? [];
    expect(passed).toHaveLength(2);
  });

  it("لا قيد صرف قبل نجاح تسجيل التحويل", async () => {
    const { poster, posted } = makePoster();
    const repo: IPaymentRepository = {
      list: async () => ok([]),
      // الطلب محوَّل سلفًا: يجب أن يتوقّف قبل الترحيل لا بعده
      findById: async () => ok(payment("transferred")),
      markTransferred: vi.fn(async () => ok(payment("transferred"))),
    };

    const result = await new TransferPayment(repo, poster).execute({
      id: PAY,
      bankFeeCompany: 0,
      bankFeeClient: 0,
    });

    expect(result.ok).toBe(false);
    expect(repo.markTransferred).not.toHaveBeenCalled();
    expect(posted).toEqual([]);
  });
});
