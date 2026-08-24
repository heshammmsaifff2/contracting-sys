import type { DomainError } from "@core/shared/errors/domain-error";
import { toDomainError } from "@core/shared/errors/domain-error";
import { err, ok, type Result } from "@core/shared/result";
import type {
  CreateTransferNoteDto,
  TransferNoteDto,
} from "@application/modules/procurement/dtos";
import type { ITransferNoteRepository } from "@application/modules/procurement/ports/transfer-note-repository";
import type { AppSupabaseClient } from "../client";
import { toDomainDbError } from "../errors";

const SELECT = `
  id, no, from_project_id, to_project_id, status, notes,
  from_project:projects!transfer_notes_from_project_id_fkey(name),
  to_project:projects!transfer_notes_to_project_id_fkey(name),
  transfer_note_lines(id, item_id, qty, unit_cost, items(code, name, unit))
`;

interface TransferNoteRow {
  id: string;
  no: number;
  from_project_id: string;
  to_project_id: string;
  status: string;
  notes: string;
  from_project: { name: string } | null;
  to_project: { name: string } | null;
  transfer_note_lines:
    | {
        id: string;
        item_id: string;
        qty: number;
        unit_cost: number;
        items: { code: string; name: string; unit: string } | null;
      }[]
    | null;
}

function toDto(row: TransferNoteRow): TransferNoteDto {
  const lines = (row.transfer_note_lines ?? []).map((line) => ({
    id: line.id,
    itemId: line.item_id,
    itemCode: line.items?.code ?? "",
    itemName: line.items?.name ?? "",
    itemUnit: line.items?.unit ?? "",
    qty: Number(line.qty),
    unitCost: Number(line.unit_cost),
  }));

  return {
    id: row.id,
    no: row.no,
    fromProjectId: row.from_project_id,
    fromProjectName: row.from_project?.name ?? "",
    toProjectId: row.to_project_id,
    toProjectName: row.to_project?.name ?? "",
    status:
      row.status === "approved"
        ? "approved"
        : row.status === "cancelled"
          ? "cancelled"
          : "draft",
    notes: row.notes,
    lines,
    total: lines.reduce((sum, line) => sum + line.qty * line.unitCost, 0),
  };
}

export class SupabaseTransferNoteRepository implements ITransferNoteRepository {
  private readonly client: AppSupabaseClient;

  constructor(client: AppSupabaseClient) {
    this.client = client;
  }

  async list(): Promise<Result<readonly TransferNoteDto[], DomainError>> {
    try {
      const { data, error } = await this.client
        .from("transfer_notes")
        .select(SELECT)
        .order("no", { ascending: false })
        .overrideTypes<TransferNoteRow[]>();

      if (error) return err(toDomainDbError(error, { entity: "سندات النقل" }));
      return ok((data ?? []).map(toDto));
    } catch (e) {
      return err(toDomainError(e, "تعذّر قراءة سندات النقل"));
    }
  }

  async findById(id: string): Promise<Result<TransferNoteDto | null, DomainError>> {
    try {
      const { data, error } = await this.client
        .from("transfer_notes")
        .select(SELECT)
        .eq("id", id)
        .maybeSingle()
        .overrideTypes<TransferNoteRow>();

      if (error) return err(toDomainDbError(error, { entity: "سند النقل", id }));
      if (data === null) return ok(null);
      return ok(toDto(data));
    } catch (e) {
      return err(toDomainError(e, "تعذّر قراءة سند النقل"));
    }
  }

  async create(
    input: CreateTransferNoteDto,
  ): Promise<Result<TransferNoteDto, DomainError>> {
    try {
      const { data: header, error: headerError } = await this.client
        .from("transfer_notes")
        .insert({
          from_project_id: input.fromProjectId,
          to_project_id: input.toProjectId,
          notes: input.notes,
          status: "draft",
        })
        .select("id")
        .single();

      if (headerError)
        return err(toDomainDbError(headerError, { entity: "سند النقل" }));

      const { error: linesError } = await this.client
        .from("transfer_note_lines")
        .insert(
          input.lines.map((line) => ({
            note_id: header.id,
            item_id: line.itemId,
            qty: line.qty,
            unit_cost: line.unitCost,
          })),
        );

      if (linesError) {
        await this.client.from("transfer_notes").delete().eq("id", header.id);
        return err(toDomainDbError(linesError, { entity: "أسطر سند النقل" }));
      }

      const created = await this.findById(header.id);
      if (!created.ok) return created;
      if (created.value === null) {
        return err(toDomainError(null, "تعذّر قراءة السند بعد إنشائه"));
      }
      return ok(created.value);
    } catch (e) {
      return err(toDomainError(e, "تعذّر إنشاء سند النقل"));
    }
  }

  /** `.eq("status","draft")` يمنع الاعتماد المزدوج والترحيل المكرّر. */
  async approve(id: string): Promise<Result<TransferNoteDto, DomainError>> {
    try {
      const { data, error } = await this.client
        .from("transfer_notes")
        .update({ status: "approved" })
        .eq("id", id)
        .eq("status", "draft")
        .select(SELECT)
        .single()
        .overrideTypes<TransferNoteRow>();

      if (error) return err(toDomainDbError(error, { entity: "سند النقل", id }));
      return ok(toDto(data));
    } catch (e) {
      return err(toDomainError(e, "تعذّر اعتماد سند النقل"));
    }
  }
}
