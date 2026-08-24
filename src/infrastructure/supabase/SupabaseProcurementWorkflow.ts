/**
 * تحقيق منفذ الأتمتة: كل عملية توليد تنادي دالة Postgres واحدة،
 * فتقع كل خطواتها في معاملة واحدة ذرّية على الخادم.
 * الدوال تفحص الصلاحية بنفسها، فلا يوجد مسار جانبي يتجاوز RLS.
 */
import type { DomainError } from "@core/shared/errors/domain-error";
import { toDomainError } from "@core/shared/errors/domain-error";
import { err, ok, okVoid, type Result } from "@core/shared/result";
import type { IProcurementWorkflow } from "@application/modules/procurement/ports/procurement-workflow";
import type { AppSupabaseClient } from "./client";
import { toDomainDbError } from "./errors";

export class SupabaseProcurementWorkflow implements IProcurementWorkflow {
  private readonly client: AppSupabaseClient;

  constructor(client: AppSupabaseClient) {
    this.client = client;
  }

  async generatePurchaseRequest(
    materialRequestIds: readonly string[],
  ): Promise<Result<{ purchaseRequestId: string }, DomainError>> {
    try {
      const { data, error } = await this.client.rpc("generate_purchase_request", {
        p_material_request_ids: [...materialRequestIds],
      });

      if (error) return err(toDomainDbError(error, { entity: "طلب الشراء" }));
      return ok({ purchaseRequestId: data });
    } catch (e) {
      return err(toDomainError(e, "تعذّر توليد طلب الشراء"));
    }
  }

  async generateSupplyOrder(
    purchaseRequestId: string,
    supplierId: string,
  ): Promise<Result<{ supplyOrderId: string }, DomainError>> {
    try {
      const { data, error } = await this.client.rpc("generate_supply_order", {
        p_pr_id: purchaseRequestId,
        p_supplier_id: supplierId,
      });

      if (error) return err(toDomainDbError(error, { entity: "أمر التوريد" }));
      return ok({ supplyOrderId: data });
    } catch (e) {
      return err(toDomainError(e, "تعذّر توليد أمر التوريد"));
    }
  }

  async generateReceiptRequests(
    supplyOrderId: string,
  ): Promise<Result<{ created: number }, DomainError>> {
    try {
      const { data, error } = await this.client.rpc("generate_receipt_requests", {
        p_so_id: supplyOrderId,
      });

      if (error) return err(toDomainDbError(error, { entity: "طلبات الاستلام" }));
      return ok({ created: data ?? 0 });
    } catch (e) {
      return err(toDomainError(e, "تعذّر توليد طلبات الاستلام"));
    }
  }

  async confirmReceipt(receiptRequestId: string): Promise<Result<void, DomainError>> {
    try {
      const { error } = await this.client.rpc("confirm_receipt", {
        p_rr_id: receiptRequestId,
      });

      if (error)
        return err(
          toDomainDbError(error, { entity: "طلب الاستلام", id: receiptRequestId }),
        );
      return okVoid();
    } catch (e) {
      return err(toDomainError(e, "تعذّر تأكيد الاستلام"));
    }
  }

  async generatePaymentRequest(
    supplyOrderId: string,
  ): Promise<Result<{ paymentRequestId: string }, DomainError>> {
    try {
      const { data, error } = await this.client.rpc("generate_payment_request", {
        p_so_id: supplyOrderId,
      });

      if (error) return err(toDomainDbError(error, { entity: "طلب الدفع" }));
      return ok({ paymentRequestId: data ?? "" });
    } catch (e) {
      return err(toDomainError(e, "تعذّر توليد طلب الدفع"));
    }
  }
}
