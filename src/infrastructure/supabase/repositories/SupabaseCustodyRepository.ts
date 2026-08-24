/**
 * العهد وفواتيرها. الفحص والاعتماد دالّتا خادم؛ الواجهة تكتب بيانات
 * الفاتورة فقط، ولا تكتب أبدًا علامة التكرار — تلك يضعها المُشغِّل.
 */
import type { DomainError } from "@core/shared/errors/domain-error";
import { toDomainError } from "@core/shared/errors/domain-error";
import { err, ok, okVoid, type Result } from "@core/shared/result";
import type { CustodyStatus } from "@core/modules/accounting/entities/Custody";
import type {
  CustodyDto,
  CustodyFilter,
  SaveCustodyDto,
  SaveInvoiceDto,
} from "@application/modules/accounting/dtos/documents";
import type { ICustodyRepository } from "@application/modules/accounting/ports/document-repositories";
import type { AppSupabaseClient } from "../client";
import { toDomainDbError } from "../errors";

const SELECT = `
  id, serial, holder_id, project_id, status, is_returned_box, opened_at, closed_at,
  total_amount, notes,
  profiles!custodies_holder_id_fkey(full_name),
  projects(name),
  custody_invoices(
    id, custody_id, seq, supplier_id, supplier_seq_no, invoice_no, invoice_date,
    amount, item_id, image_public_id, image_url, ocr_text, is_duplicate,
    duplicate_of, duplicate_reviewed, is_returned, return_reason, note,
    suppliers(name), items(name)
  )
`;

interface InvoiceRow {
  id: string;
  custody_id: string;
  seq: number;
  supplier_id: string | null;
  supplier_seq_no: string;
  invoice_no: string;
  invoice_date: string;
  amount: number;
  item_id: string | null;
  image_public_id: string | null;
  image_url: string | null;
  ocr_text: string;
  is_duplicate: boolean;
  duplicate_of: string | null;
  duplicate_reviewed: boolean;
  is_returned: boolean;
  return_reason: string;
  note: string;
  suppliers: { name: string } | null;
  items: { name: string } | null;
}

interface CustodyRow {
  id: string;
  serial: number;
  holder_id: string;
  project_id: string;
  status: string;
  is_returned_box: boolean;
  opened_at: string;
  closed_at: string | null;
  total_amount: number;
  notes: string;
  profiles: { full_name: string } | null;
  projects: { name: string } | null;
  custody_invoices: InvoiceRow[] | null;
}

const STATUSES: readonly CustodyStatus[] = [
  "open",
  "submitted",
  "approved",
  "closed",
  "cancelled",
];

function toStatus(raw: string): CustodyStatus {
  return STATUSES.find((s) => s === raw) ?? "open";
}

function toDto(row: CustodyRow): CustodyDto {
  return {
    id: row.id,
    serial: row.serial,
    holderId: row.holder_id,
    holderName: row.profiles?.full_name ?? "",
    projectId: row.project_id,
    projectName: row.projects?.name ?? "",
    status: toStatus(row.status),
    isReturnedBox: row.is_returned_box,
    openedAt: row.opened_at,
    closedAt: row.closed_at,
    totalAmount: Number(row.total_amount),
    notes: row.notes,
    invoices: (row.custody_invoices ?? [])
      .map((invoice) => ({
        id: invoice.id,
        custodyId: invoice.custody_id,
        seq: invoice.seq,
        supplierId: invoice.supplier_id,
        supplierName: invoice.suppliers?.name ?? "",
        supplierSeqNo: invoice.supplier_seq_no,
        invoiceNo: invoice.invoice_no,
        invoiceDate: invoice.invoice_date,
        amount: Number(invoice.amount),
        itemId: invoice.item_id,
        itemName: invoice.items?.name ?? "",
        imagePublicId: invoice.image_public_id,
        imageUrl: invoice.image_url,
        ocrText: invoice.ocr_text,
        isDuplicate: invoice.is_duplicate,
        duplicateOf: invoice.duplicate_of,
        duplicateReviewed: invoice.duplicate_reviewed,
        isReturned: invoice.is_returned,
        returnReason: invoice.return_reason,
        note: invoice.note,
      }))
      .sort((a, b) => a.seq - b.seq),
  };
}

export class SupabaseCustodyRepository implements ICustodyRepository {
  private readonly client: AppSupabaseClient;

  constructor(client: AppSupabaseClient) {
    this.client = client;
  }

  async list(
    filter: CustodyFilter,
  ): Promise<Result<readonly CustodyDto[], DomainError>> {
    try {
      let query = this.client
        .from("custodies")
        .select(SELECT)
        .order("serial", { ascending: false })
        .limit(200);

      if (filter.projectId != null && filter.projectId !== "") {
        query = query.eq("project_id", filter.projectId);
      }
      if (filter.holderId != null && filter.holderId !== "") {
        query = query.eq("holder_id", filter.holderId);
      }
      if (filter.includeReturnedBoxes !== true) {
        query = query.eq("is_returned_box", false);
      }

      const { data, error } = await query.overrideTypes<CustodyRow[]>();
      if (error) return err(toDomainDbError(error, { entity: "العهد" }));
      return ok((data ?? []).map(toDto));
    } catch (e) {
      return err(toDomainError(e, "تعذّر قراءة العهد"));
    }
  }

  async findById(id: string): Promise<Result<CustodyDto | null, DomainError>> {
    try {
      const { data, error } = await this.client
        .from("custodies")
        .select(SELECT)
        .eq("id", id)
        .maybeSingle()
        .overrideTypes<CustodyRow>();

      if (error) return err(toDomainDbError(error, { entity: "العهدة", id }));
      if (data === null) return ok(null);
      return ok(toDto(data));
    } catch (e) {
      return err(toDomainError(e, "تعذّر قراءة العهدة"));
    }
  }

  async save(input: SaveCustodyDto): Promise<Result<CustodyDto, DomainError>> {
    try {
      const payload = {
        holder_id: input.holderId,
        project_id: input.projectId,
        opened_at: input.openedAt,
        notes: input.notes,
      };

      const request =
        input.id === null
          ? this.client.from("custodies").insert(payload)
          : this.client.from("custodies").update(payload).eq("id", input.id);

      const { data, error } = await request
        .select(SELECT)
        .single()
        .overrideTypes<CustodyRow>();

      if (error)
        return err(toDomainDbError(error, { entity: "العهدة", id: input.id ?? "" }));
      return ok(toDto(data));
    } catch (e) {
      return err(toDomainError(e, "تعذّر حفظ العهدة"));
    }
  }

  async saveInvoice(input: SaveInvoiceDto): Promise<Result<void, DomainError>> {
    try {
      const payload = {
        custody_id: input.custodyId,
        supplier_id: input.supplierId,
        supplier_seq_no: input.supplierSeqNo,
        invoice_no: input.invoiceNo,
        invoice_date: input.invoiceDate,
        amount: input.amount,
        item_id: input.itemId,
        image_public_id: input.imagePublicId,
        image_url: input.imageUrl,
        ocr_text: input.ocrText,
        note: input.note,
      };

      if (input.id === null) {
        // المسلسل داخل العهدة يتبع آخر فاتورة فيها
        const { count, error: countError } = await this.client
          .from("custody_invoices")
          .select("id", { count: "exact", head: true })
          .eq("custody_id", input.custodyId);

        if (countError)
          return err(toDomainDbError(countError, { entity: "فواتير العهدة" }));

        const { error } = await this.client
          .from("custody_invoices")
          .insert({ ...payload, seq: (count ?? 0) + 1 });

        if (error) return err(toDomainDbError(error, { entity: "فاتورة العهدة" }));
        return okVoid();
      }

      const { error } = await this.client
        .from("custody_invoices")
        .update(payload)
        .eq("id", input.id);

      if (error)
        return err(toDomainDbError(error, { entity: "فاتورة العهدة", id: input.id }));
      return okVoid();
    } catch (e) {
      return err(toDomainError(e, "تعذّر حفظ الفاتورة"));
    }
  }

  async removeInvoice(id: string): Promise<Result<void, DomainError>> {
    try {
      const { error } = await this.client
        .from("custody_invoices")
        .delete()
        .eq("id", id);

      if (error) return err(toDomainDbError(error, { entity: "فاتورة العهدة", id }));
      return okVoid();
    } catch (e) {
      return err(toDomainError(e, "تعذّر حذف الفاتورة"));
    }
  }

  async rescanDuplicates(custodyId: string): Promise<Result<number, DomainError>> {
    try {
      const { data, error } = await this.client.rpc("rescan_custody_duplicates", {
        p_custody_id: custodyId,
      });

      if (error)
        return err(toDomainDbError(error, { entity: "فحص التكرار", id: custodyId }));
      return ok(data ?? 0);
    } catch (e) {
      return err(toDomainError(e, "تعذّر فحص تكرار الفواتير"));
    }
  }

  async markDuplicateReviewed(invoiceId: string): Promise<Result<void, DomainError>> {
    try {
      const { error } = await this.client
        .from("custody_invoices")
        .update({ duplicate_reviewed: true })
        .eq("id", invoiceId);

      if (error)
        return err(
          toDomainDbError(error, { entity: "مراجعة الفاتورة", id: invoiceId }),
        );
      return okVoid();
    } catch (e) {
      return err(toDomainError(e, "تعذّر تعليم الفاتورة كمُراجَعة"));
    }
  }

  async returnInvoice(
    invoiceId: string,
    reason: string,
  ): Promise<Result<void, DomainError>> {
    try {
      const { error } = await this.client.rpc("return_custody_invoice", {
        p_invoice_id: invoiceId,
        p_reason: reason,
      });

      if (error)
        return err(
          toDomainDbError(error, { entity: "ارتجاع الفاتورة", id: invoiceId }),
        );
      return okVoid();
    } catch (e) {
      return err(toDomainError(e, "تعذّر ارتجاع الفاتورة"));
    }
  }

  async approve(id: string): Promise<Result<void, DomainError>> {
    try {
      const { error } = await this.client.rpc("approve_custody", {
        p_custody_id: id,
      });

      if (error) return err(toDomainDbError(error, { entity: "العهدة", id }));
      return okVoid();
    } catch (e) {
      return err(toDomainError(e, "تعذّر اعتماد العهدة"));
    }
  }
}
