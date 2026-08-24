/**
 * حلقات سلسلة المشتريات التي تُولّد مستندًا من سابقه.
 * كل عملية تنفّذها دالة Postgres واحدة ذرّيًا، فلا يعيد المستخدم إدخال شيء.
 */
import type { DomainError } from "@core/shared/errors/domain-error";
import { ConflictError, ValidationError } from "@core/shared/errors/domain-error";
import { err, ok, type Result } from "@core/shared/result";
import type { UseCase } from "@application/shared/use-case";
import type { IAccountingPoster } from "@application/modules/accounting/ports/accounting-poster";
import type {
  PriceComparisonRowDto,
  PurchaseRequestDto,
  SaveQuoteDto,
  SupplyOrderDto,
} from "../dtos";
import type { IPurchaseRepository } from "../ports/purchase-repository";
import type { IProcurementWorkflow } from "../ports/procurement-workflow";

// ── 1) الاحتياج ← الشراء ────────────────────────────────────────────────
export class GeneratePurchaseRequest implements UseCase<
  { materialRequestIds: readonly string[] },
  { purchaseRequestId: string }
> {
  private readonly workflow: IProcurementWorkflow;

  constructor(workflow: IProcurementWorkflow) {
    this.workflow = workflow;
  }

  async execute(input: {
    materialRequestIds: readonly string[];
  }): Promise<Result<{ purchaseRequestId: string }, DomainError>> {
    if (input.materialRequestIds.length === 0) {
      return err(
        new ValidationError("اختر طلب احتياج واحدًا على الأقل", {
          materialRequestIds: "empty",
        }),
      );
    }
    // الدمج يقبل عدّة مشاريع؛ التكلفة تبقى موزّعة عليها في الخادم
    return this.workflow.generatePurchaseRequest([
      ...new Set(input.materialRequestIds),
    ]);
  }
}

export class ListPurchaseRequests implements UseCase<
  void,
  readonly PurchaseRequestDto[]
> {
  private readonly repo: IPurchaseRepository;

  constructor(repo: IPurchaseRepository) {
    this.repo = repo;
  }

  async execute(): Promise<Result<readonly PurchaseRequestDto[], DomainError>> {
    return this.repo.listPurchaseRequests();
  }
}

// ── 2) التسعير والمقارنة ────────────────────────────────────────────────
export class SaveSupplierQuote implements UseCase<SaveQuoteDto, void> {
  private readonly repo: IPurchaseRepository;

  constructor(repo: IPurchaseRepository) {
    this.repo = repo;
  }

  async execute(input: SaveQuoteDto): Promise<Result<void, DomainError>> {
    if (input.lines.length === 0) {
      return err(new ValidationError("العرض بلا أسعار", { lines: "empty" }));
    }
    if (input.lines.some((line) => line.unitPrice < 0)) {
      return err(
        new ValidationError("السعر لا يكون سالبًا", { lines: "negative_price" }),
      );
    }
    return this.repo.saveQuote(input);
  }
}

export class ComparePrices implements UseCase<
  { purchaseRequestId: string },
  readonly PriceComparisonRowDto[]
> {
  private readonly repo: IPurchaseRepository;

  constructor(repo: IPurchaseRepository) {
    this.repo = repo;
  }

  async execute(input: {
    purchaseRequestId: string;
  }): Promise<Result<readonly PriceComparisonRowDto[], DomainError>> {
    return this.repo.comparePrices(input.purchaseRequestId);
  }
}

// ── 3) الشراء ← التوريد ─────────────────────────────────────────────────
export class GenerateSupplyOrder implements UseCase<
  { purchaseRequestId: string; supplierId: string },
  { supplyOrderId: string }
> {
  private readonly workflow: IProcurementWorkflow;

  constructor(workflow: IProcurementWorkflow) {
    this.workflow = workflow;
  }

  async execute(input: {
    purchaseRequestId: string;
    supplierId: string;
  }): Promise<Result<{ supplyOrderId: string }, DomainError>> {
    return this.workflow.generateSupplyOrder(input.purchaseRequestId, input.supplierId);
  }
}

export class ListSupplyOrders implements UseCase<void, readonly SupplyOrderDto[]> {
  private readonly repo: IPurchaseRepository;

  constructor(repo: IPurchaseRepository) {
    this.repo = repo;
  }

  async execute(): Promise<Result<readonly SupplyOrderDto[], DomainError>> {
    return this.repo.listSupplyOrders();
  }
}

export class ApproveSupplyOrder implements UseCase<{ id: string }, void> {
  private readonly repo: IPurchaseRepository;

  constructor(repo: IPurchaseRepository) {
    this.repo = repo;
  }

  async execute(input: { id: string }): Promise<Result<void, DomainError>> {
    return this.repo.setSupplyOrderStatus(input.id, "approved");
  }
}

// ── 4) التوريد ← الاستلام ───────────────────────────────────────────────
export class GenerateReceiptRequests implements UseCase<
  { supplyOrderId: string },
  { created: number }
> {
  private readonly workflow: IProcurementWorkflow;

  constructor(workflow: IProcurementWorkflow) {
    this.workflow = workflow;
  }

  async execute(input: {
    supplyOrderId: string;
  }): Promise<Result<{ created: number }, DomainError>> {
    return this.workflow.generateReceiptRequests(input.supplyOrderId);
  }
}

/**
 * تأكيد الاستلام ثم الترحيل الآلي.
 * التأكيد يزيد مخزون الموقع في الخادم، ثم يُطلق قيد:
 * مخزون المشروع + الضريبة مقابل ذمم المورّد.
 */
export const RECEIPT_SOURCE_TYPE = "receipt_approval";

export class ConfirmReceipt implements UseCase<
  { receiptRequestId: string },
  { entryId: string }
> {
  private readonly workflow: IProcurementWorkflow;
  private readonly poster: IAccountingPoster;

  constructor(workflow: IProcurementWorkflow, poster: IAccountingPoster) {
    this.workflow = workflow;
    this.poster = poster;
  }

  async execute(input: {
    receiptRequestId: string;
  }): Promise<Result<{ entryId: string }, DomainError>> {
    const confirmed = await this.workflow.confirmReceipt(input.receiptRequestId);
    if (!confirmed.ok) return confirmed;

    const posted = await this.poster.post(RECEIPT_SOURCE_TYPE, input.receiptRequestId);
    if (!posted.ok) return posted;

    return ok({ entryId: posted.value.entryId });
  }
}

// ── 5) التوريد ← الدفع ──────────────────────────────────────────────────
export class GeneratePaymentRequest implements UseCase<
  { supplyOrderId: string },
  { paymentRequestId: string }
> {
  private readonly workflow: IProcurementWorkflow;

  constructor(workflow: IProcurementWorkflow) {
    this.workflow = workflow;
  }

  async execute(input: {
    supplyOrderId: string;
  }): Promise<Result<{ paymentRequestId: string }, DomainError>> {
    const result = await this.workflow.generatePaymentRequest(input.supplyOrderId);
    if (!result.ok) return result;
    if (result.value.paymentRequestId === "") {
      return err(new ConflictError("تعذّر إنشاء طلب الدفع"));
    }
    return result;
  }
}
