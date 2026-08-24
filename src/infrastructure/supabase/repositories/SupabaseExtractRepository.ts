/**
 * المستخلصات. التوليد والاعتماد دالّتا خادم؛ ما يُكتب من الواجهة هو
 * كمية السطر والملاحظات وعلامة الختامي فقط، والباقي مستدعى أو محسوب.
 */
import type { DomainError } from "@core/shared/errors/domain-error";
import { toDomainError } from "@core/shared/errors/domain-error";
import { err, ok, okVoid, type Result } from "@core/shared/result";
import type { ExtractStatus } from "@core/modules/accounting/entities/Extract";
import { remainingQty } from "@core/modules/accounting/entities/Extract";
import type {
  ExtractDto,
  ExtractFilter,
  GenerateExtractDto,
  SetExtractLineQtyDto,
} from "@application/modules/accounting/dtos/documents";
import type { IExtractRepository } from "@application/modules/accounting/ports/document-repositories";
import type { AppSupabaseClient } from "../client";
import { toDomainDbError } from "../errors";

const SELECT = `
  id, no, seq, project_id, contractor_id, extract_date, status, is_final,
  gross_amount, deductions_amount, retention_released, net_amount, notes, approved_at,
  projects(name),
  contractors(code, name),
  extract_lines(id, boq_item_id, unit_price, max_qty, prev_qty, current_qty,
                boq_items(code, name, unit)),
  extract_deductions(id, key, name, rate, account_code, amount)
`;

interface ExtractRow {
  id: string;
  no: number;
  seq: number;
  project_id: string;
  contractor_id: string;
  extract_date: string;
  status: string;
  is_final: boolean;
  gross_amount: number;
  deductions_amount: number;
  retention_released: number;
  net_amount: number;
  notes: string;
  approved_at: string | null;
  projects: { name: string } | null;
  contractors: { code: string; name: string } | null;
  extract_lines:
    | {
        id: string;
        boq_item_id: string;
        unit_price: number;
        max_qty: number;
        prev_qty: number;
        current_qty: number;
        boq_items: { code: string; name: string; unit: string } | null;
      }[]
    | null;
  extract_deductions:
    | {
        id: string;
        key: string;
        name: string;
        rate: number;
        account_code: string;
        amount: number;
      }[]
    | null;
}

const STATUSES: readonly ExtractStatus[] = [
  "draft",
  "submitted",
  "approved",
  "paid",
  "cancelled",
];

function toStatus(raw: string): ExtractStatus {
  return STATUSES.find((s) => s === raw) ?? "draft";
}

function toDto(row: ExtractRow): ExtractDto {
  const lines = (row.extract_lines ?? [])
    .map((line) => {
      const unitPrice = Number(line.unit_price);
      const maxQty = Number(line.max_qty);
      const prevQty = Number(line.prev_qty);
      const currentQty = Number(line.current_qty);
      return {
        id: line.id,
        boqItemId: line.boq_item_id,
        boqCode: line.boq_items?.code ?? "",
        boqName: line.boq_items?.name ?? "",
        boqUnit: line.boq_items?.unit ?? "",
        unitPrice,
        maxQty,
        prevQty,
        currentQty,
        remainingQty: remainingQty(maxQty, prevQty, currentQty),
        amount: Math.round(currentQty * unitPrice * 100) / 100,
      };
    })
    .sort((a, b) => a.boqCode.localeCompare(b.boqCode, "ar"));

  return {
    id: row.id,
    no: row.no,
    seq: row.seq,
    projectId: row.project_id,
    projectName: row.projects?.name ?? "",
    contractorId: row.contractor_id,
    contractorCode: row.contractors?.code ?? "",
    contractorName: row.contractors?.name ?? "",
    extractDate: row.extract_date,
    status: toStatus(row.status),
    isFinal: row.is_final,
    grossAmount: Number(row.gross_amount),
    deductionsAmount: Number(row.deductions_amount),
    retentionReleased: Number(row.retention_released),
    netAmount: Number(row.net_amount),
    notes: row.notes,
    approvedAt: row.approved_at,
    lines,
    deductions: (row.extract_deductions ?? []).map((d) => ({
      id: d.id,
      key: d.key,
      name: d.name,
      rate: Number(d.rate),
      accountCode: d.account_code,
      amount: Number(d.amount),
    })),
  };
}

export class SupabaseExtractRepository implements IExtractRepository {
  private readonly client: AppSupabaseClient;

  constructor(client: AppSupabaseClient) {
    this.client = client;
  }

  async list(
    filter: ExtractFilter,
  ): Promise<Result<readonly ExtractDto[], DomainError>> {
    try {
      let query = this.client
        .from("extracts")
        .select(SELECT)
        .order("no", { ascending: false })
        .limit(200);

      if (filter.projectId != null && filter.projectId !== "") {
        query = query.eq("project_id", filter.projectId);
      }
      if (filter.contractorId != null && filter.contractorId !== "") {
        query = query.eq("contractor_id", filter.contractorId);
      }
      if (filter.status != null) {
        query = query.eq("status", filter.status);
      }

      const { data, error } = await query.overrideTypes<ExtractRow[]>();
      if (error) return err(toDomainDbError(error, { entity: "المستخلصات" }));
      return ok((data ?? []).map(toDto));
    } catch (e) {
      return err(toDomainError(e, "تعذّر قراءة المستخلصات"));
    }
  }

  async findById(id: string): Promise<Result<ExtractDto | null, DomainError>> {
    try {
      const { data, error } = await this.client
        .from("extracts")
        .select(SELECT)
        .eq("id", id)
        .maybeSingle()
        .overrideTypes<ExtractRow>();

      if (error) return err(toDomainDbError(error, { entity: "المستخلص", id }));
      if (data === null) return ok(null);
      return ok(toDto(data));
    } catch (e) {
      return err(toDomainError(e, "تعذّر قراءة المستخلص"));
    }
  }

  async generate(
    input: GenerateExtractDto,
  ): Promise<Result<{ id: string }, DomainError>> {
    try {
      const { data, error } = await this.client.rpc("generate_extract", {
        p_project_id: input.projectId,
        p_contractor_id: input.contractorId,
        ...(input.extractDate === "" ? {} : { p_extract_date: input.extractDate }),
      });

      if (error) return err(toDomainDbError(error, { entity: "المستخلص" }));
      return ok({ id: data });
    } catch (e) {
      return err(toDomainError(e, "تعذّر توليد المستخلص"));
    }
  }

  async setLineQty(input: SetExtractLineQtyDto): Promise<Result<void, DomainError>> {
    try {
      const { error } = await this.client
        .from("extract_lines")
        .update({ current_qty: input.currentQty })
        .eq("id", input.lineId);

      if (error)
        return err(
          toDomainDbError(error, { entity: "سطر المستخلص", id: input.lineId }),
        );
      return okVoid();
    } catch (e) {
      return err(toDomainError(e, "تعذّر حفظ الكمية"));
    }
  }

  async setFinal(id: string, isFinal: boolean): Promise<Result<void, DomainError>> {
    try {
      const { error } = await this.client
        .from("extracts")
        .update({ is_final: isFinal })
        .eq("id", id);

      if (error) return err(toDomainDbError(error, { entity: "المستخلص", id }));
      return okVoid();
    } catch (e) {
      return err(toDomainError(e, "تعذّر تعديل المستخلص"));
    }
  }

  async setNotes(id: string, notes: string): Promise<Result<void, DomainError>> {
    try {
      const { error } = await this.client
        .from("extracts")
        .update({ notes })
        .eq("id", id);

      if (error) return err(toDomainDbError(error, { entity: "المستخلص", id }));
      return okVoid();
    } catch (e) {
      return err(toDomainError(e, "تعذّر حفظ الملاحظات"));
    }
  }

  /** الاعتماد يحسب الاستقطاعات ويولّد طلب الدفع في معاملة واحدة. */
  async approve(id: string): Promise<Result<void, DomainError>> {
    try {
      const { error } = await this.client.rpc("approve_extract", {
        p_extract_id: id,
      });

      if (error) return err(toDomainDbError(error, { entity: "المستخلص", id }));
      return okVoid();
    } catch (e) {
      return err(toDomainError(e, "تعذّر اعتماد المستخلص"));
    }
  }
}
