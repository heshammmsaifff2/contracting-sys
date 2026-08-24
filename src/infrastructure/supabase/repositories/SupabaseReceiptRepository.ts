import type { DomainError } from "@core/shared/errors/domain-error";
import { toDomainError } from "@core/shared/errors/domain-error";
import { err, ok, type Result } from "@core/shared/result";
import type { ReceiptRequestDto } from "@application/modules/procurement/dtos";
import type { IReceiptRepository } from "@application/modules/procurement/ports/receipt-repository";
import type { AppSupabaseClient } from "../client";
import { toDomainDbError } from "../errors";

const SELECT = `
  id, no, supply_order_id, project_id, status, received_at,
  projects(name),
  supply_orders(no, suppliers(name)),
  receipt_request_lines(id, item_id, qty, unit_price, items(code, name, unit))
`;

interface ReceiptRow {
  id: string;
  no: number;
  supply_order_id: string;
  project_id: string;
  status: string;
  received_at: string | null;
  projects: { name: string } | null;
  supply_orders: { no: number; suppliers: { name: string } | null } | null;
  receipt_request_lines:
    | {
        id: string;
        item_id: string;
        qty: number;
        unit_price: number;
        items: { code: string; name: string; unit: string } | null;
      }[]
    | null;
}

function toDto(row: ReceiptRow): ReceiptRequestDto {
  const lines = (row.receipt_request_lines ?? []).map((line) => ({
    id: line.id,
    itemId: line.item_id,
    itemCode: line.items?.code ?? "",
    itemName: line.items?.name ?? "",
    itemUnit: line.items?.unit ?? "",
    qty: Number(line.qty),
    unitPrice: Number(line.unit_price),
  }));

  return {
    id: row.id,
    no: row.no,
    supplyOrderId: row.supply_order_id,
    supplyOrderNo: row.supply_orders?.no ?? 0,
    supplierName: row.supply_orders?.suppliers?.name ?? "",
    projectId: row.project_id,
    projectName: row.projects?.name ?? "",
    status:
      row.status === "received"
        ? "received"
        : row.status === "cancelled"
          ? "cancelled"
          : "draft",
    receivedAt: row.received_at,
    lines,
    total: lines.reduce((sum, line) => sum + line.qty * line.unitPrice, 0),
  };
}

export class SupabaseReceiptRepository implements IReceiptRepository {
  private readonly client: AppSupabaseClient;

  constructor(client: AppSupabaseClient) {
    this.client = client;
  }

  /** RLS تحصر طلبات الاستلام في مشاريع المستخدم المعتمدة. */
  async list(): Promise<Result<readonly ReceiptRequestDto[], DomainError>> {
    try {
      const { data, error } = await this.client
        .from("receipt_requests")
        .select(SELECT)
        .order("no", { ascending: false })
        .overrideTypes<ReceiptRow[]>();

      if (error) return err(toDomainDbError(error, { entity: "طلبات الاستلام" }));
      return ok((data ?? []).map(toDto));
    } catch (e) {
      return err(toDomainError(e, "تعذّر قراءة طلبات الاستلام"));
    }
  }

  async findById(id: string): Promise<Result<ReceiptRequestDto | null, DomainError>> {
    try {
      const { data, error } = await this.client
        .from("receipt_requests")
        .select(SELECT)
        .eq("id", id)
        .maybeSingle()
        .overrideTypes<ReceiptRow>();

      if (error) return err(toDomainDbError(error, { entity: "طلب الاستلام", id }));
      if (data === null) return ok(null);
      return ok(toDto(data));
    } catch (e) {
      return err(toDomainError(e, "تعذّر قراءة طلب الاستلام"));
    }
  }
}
