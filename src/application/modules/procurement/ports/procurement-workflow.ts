import type { DomainError } from "@core/shared/errors/domain-error";
import type { Result } from "@core/shared/result";

/**
 * منفذ الأتمتة: كل توليد مستند من سابقه يقع في دالة Postgres واحدة،
 * فتبقى العملية ذرّية ولا يتكرّر أي إدخال في الواجهة.
 */
export interface IProcurementWorkflow {
  /** طلب شراء = الاحتياج − المتوفّر بالموقع، لكل مشروع على حدة. */
  generatePurchaseRequest(
    materialRequestIds: readonly string[],
  ): Promise<Result<{ purchaseRequestId: string }, DomainError>>;

  /** أمر توريد بأسعار عرض المورّد الفائز والضريبة من الإعدادات. */
  generateSupplyOrder(
    purchaseRequestId: string,
    supplierId: string,
  ): Promise<Result<{ supplyOrderId: string }, DomainError>>;

  /** طلب استلام لكل مشروع في أمر التوريد. */
  generateReceiptRequests(
    supplyOrderId: string,
  ): Promise<Result<{ created: number }, DomainError>>;

  /** تأكيد الاستلام — يزيد مخزون الموقع آليًا. */
  confirmReceipt(receiptRequestId: string): Promise<Result<void, DomainError>>;

  /** طلب دفع بالحساب البنكي المستدعى تلقائيًا. */
  generatePaymentRequest(
    supplyOrderId: string,
  ): Promise<Result<{ paymentRequestId: string }, DomainError>>;
}
