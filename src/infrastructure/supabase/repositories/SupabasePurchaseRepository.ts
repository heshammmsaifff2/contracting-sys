import type { DomainError } from "@core/shared/errors/domain-error";
import { toDomainError } from "@core/shared/errors/domain-error";
import { err, ok, okVoid, type Result } from "@core/shared/result";
import type { SupplyOrderStatus } from "@core/modules/procurement/entities/SupplyOrder";
import type {
  PriceComparisonRowDto,
  PurchaseRequestDto,
  SaveQuoteDto,
  SupplyOrderDto,
} from "@application/modules/procurement/dtos";
import type { IPurchaseRepository } from "@application/modules/procurement/ports/purchase-repository";
import type { AppSupabaseClient } from "../client";
import { toDomainDbError } from "../errors";

interface PurchaseRequestRow {
  id: string;
  no: number;
  status: string;
  notes: string;
  purchase_request_lines:
    | {
        id: string;
        item_id: string;
        project_id: string;
        qty: number;
        items: { code: string; name: string; unit: string } | null;
        projects: { name: string } | null;
      }[]
    | null;
  supplier_quotes: { supplier_id: string }[] | null;
}

interface SupplyOrderRow {
  id: string;
  no: number;
  pr_id: string;
  supplier_id: string;
  subtotal: number;
  vat_rate: number;
  vat_amount: number;
  total: number;
  status: string;
  notes: string;
  suppliers: { code: string; name: string } | null;
  supply_order_lines:
    | {
        id: string;
        item_id: string;
        project_id: string;
        qty: number;
        unit_price: number;
        items: { code: string; name: string; unit: string } | null;
        projects: { name: string } | null;
      }[]
    | null;
}

const PR_SELECT = `
  id, no, status, notes,
  purchase_request_lines(id, item_id, project_id, qty, items(code, name, unit), projects(name)),
  supplier_quotes(supplier_id)
`;

const SO_SELECT = `
  id, no, pr_id, supplier_id, subtotal, vat_rate, vat_amount, total, status, notes,
  suppliers(code, name),
  supply_order_lines(id, item_id, project_id, qty, unit_price, items(code, name, unit), projects(name))
`;

const SUPPLY_ORDER_STATUSES: readonly SupplyOrderStatus[] = [
  "draft",
  "approved",
  "received",
  "cancelled",
];

export class SupabasePurchaseRepository implements IPurchaseRepository {
  private readonly client: AppSupabaseClient;

  constructor(client: AppSupabaseClient) {
    this.client = client;
  }

  async listPurchaseRequests(): Promise<
    Result<readonly PurchaseRequestDto[], DomainError>
  > {
    try {
      const { data, error } = await this.client
        .from("purchase_requests")
        .select(PR_SELECT)
        .order("no", { ascending: false })
        .overrideTypes<PurchaseRequestRow[]>();

      if (error) return err(toDomainDbError(error, { entity: "طلبات الشراء" }));

      return ok(
        (data ?? []).map((row) => ({
          id: row.id,
          no: row.no,
          status: row.status,
          notes: row.notes,
          lines: (row.purchase_request_lines ?? []).map((line) => ({
            id: line.id,
            itemId: line.item_id,
            itemCode: line.items?.code ?? "",
            itemName: line.items?.name ?? "",
            itemUnit: line.items?.unit ?? "",
            projectId: line.project_id,
            projectName: line.projects?.name ?? "",
            qty: Number(line.qty),
          })),
          quotedSupplierIds: [
            ...new Set((row.supplier_quotes ?? []).map((q) => q.supplier_id)),
          ],
        })),
      );
    } catch (e) {
      return err(toDomainError(e, "تعذّر قراءة طلبات الشراء"));
    }
  }

  /** المقارنة من العرض price_comparison — الترتيب يحسبه Postgres. */
  async comparePrices(
    purchaseRequestId: string,
  ): Promise<Result<readonly PriceComparisonRowDto[], DomainError>> {
    try {
      const { data, error } = await this.client
        .from("price_comparison")
        .select("*")
        .eq("pr_id", purchaseRequestId)
        .order("item_code", { ascending: true })
        .order("price_rank", { ascending: true });

      if (error) return err(toDomainDbError(error, { entity: "مقارنة الأسعار" }));

      return ok(
        (data ?? []).map((row) => ({
          itemId: row.item_id ?? "",
          itemCode: row.item_code ?? "",
          itemName: row.item_name ?? "",
          itemUnit: row.item_unit ?? "",
          supplierId: row.supplier_id ?? "",
          supplierCode: row.supplier_code ?? "",
          supplierName: row.supplier_name ?? "",
          unitPrice: Number(row.unit_price ?? 0),
          requiredQty: Number(row.required_qty ?? 0),
          lineTotal: Number(row.line_total ?? 0),
          priceRank: Number(row.price_rank ?? 0),
        })),
      );
    } catch (e) {
      return err(toDomainError(e, "تعذّر قراءة مقارنة الأسعار"));
    }
  }

  /** المشتريات تُدخل كود المورّد وسعره فقط [المشتريات 3]. */
  async saveQuote(input: SaveQuoteDto): Promise<Result<void, DomainError>> {
    try {
      const { data: quote, error: quoteError } = await this.client
        .from("supplier_quotes")
        .upsert(
          { pr_id: input.purchaseRequestId, supplier_id: input.supplierId },
          { onConflict: "pr_id,supplier_id" },
        )
        .select("id")
        .single();

      if (quoteError) return err(toDomainDbError(quoteError, { entity: "عرض السعر" }));

      // استبدال كامل لأسطر العرض
      const { error: deleteError } = await this.client
        .from("supplier_quote_lines")
        .delete()
        .eq("quote_id", quote.id);

      if (deleteError)
        return err(toDomainDbError(deleteError, { entity: "أسطر العرض" }));

      const { error: insertError } = await this.client
        .from("supplier_quote_lines")
        .insert(
          input.lines.map((line) => ({
            quote_id: quote.id,
            item_id: line.itemId,
            unit_price: line.unitPrice,
          })),
        );

      if (insertError)
        return err(toDomainDbError(insertError, { entity: "أسطر العرض" }));

      return okVoid();
    } catch (e) {
      return err(toDomainError(e, "تعذّر حفظ عرض السعر"));
    }
  }

  async listSupplyOrders(): Promise<Result<readonly SupplyOrderDto[], DomainError>> {
    try {
      const { data, error } = await this.client
        .from("supply_orders")
        .select(SO_SELECT)
        .order("no", { ascending: false })
        .overrideTypes<SupplyOrderRow[]>();

      if (error) return err(toDomainDbError(error, { entity: "أوامر التوريد" }));

      return ok(
        (data ?? []).map((row) => ({
          id: row.id,
          no: row.no,
          purchaseRequestId: row.pr_id,
          supplierId: row.supplier_id,
          supplierCode: row.suppliers?.code ?? "",
          supplierName: row.suppliers?.name ?? "",
          subtotal: Number(row.subtotal),
          vatRate: Number(row.vat_rate),
          vatAmount: Number(row.vat_amount),
          total: Number(row.total),
          status: SUPPLY_ORDER_STATUSES.includes(row.status as SupplyOrderStatus)
            ? (row.status as SupplyOrderStatus)
            : "draft",
          notes: row.notes,
          lines: (row.supply_order_lines ?? []).map((line) => ({
            id: line.id,
            itemId: line.item_id,
            itemCode: line.items?.code ?? "",
            itemName: line.items?.name ?? "",
            itemUnit: line.items?.unit ?? "",
            projectId: line.project_id,
            projectName: line.projects?.name ?? "",
            qty: Number(line.qty),
            unitPrice: Number(line.unit_price),
          })),
        })),
      );
    } catch (e) {
      return err(toDomainError(e, "تعذّر قراءة أوامر التوريد"));
    }
  }

  async setSupplyOrderStatus(
    id: string,
    status: string,
  ): Promise<Result<void, DomainError>> {
    try {
      const { error } = await this.client
        .from("supply_orders")
        .update({ status })
        .eq("id", id);

      if (error) return err(toDomainDbError(error, { entity: "أمر التوريد", id }));
      return okVoid();
    } catch (e) {
      return err(toDomainError(e, "تعذّر تغيير حالة أمر التوريد"));
    }
  }
}
