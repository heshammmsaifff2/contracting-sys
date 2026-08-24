import type { DomainError } from "@core/shared/errors/domain-error";
import { toDomainError } from "@core/shared/errors/domain-error";
import { err, ok, okVoid, type Result } from "@core/shared/result";
import type {
  SaveSurplusDto,
  SurplusMaterialDto,
  SurplusStatus,
} from "@application/modules/warehouse/dtos";
import type { ISurplusRepository } from "@application/modules/warehouse/ports/surplus-repository";
import type { AppSupabaseClient } from "../client";
import { toDomainDbError } from "../errors";

const SELECT = `
  id, project_id, item_id, qty, status, note,
  projects(name), items(code, name, unit)
`;

interface SurplusRow {
  id: string;
  project_id: string;
  item_id: string;
  qty: number;
  status: string;
  note: string;
  projects: { name: string } | null;
  items: { code: string; name: string; unit: string } | null;
}

const STATUSES: readonly SurplusStatus[] = ["available", "reserved", "transferred"];

function toStatus(raw: string): SurplusStatus {
  return STATUSES.find((s) => s === raw) ?? "available";
}

function toDto(row: SurplusRow): SurplusMaterialDto {
  return {
    id: row.id,
    projectId: row.project_id,
    projectName: row.projects?.name ?? "",
    itemId: row.item_id,
    itemCode: row.items?.code ?? "",
    itemName: row.items?.name ?? "",
    itemUnit: row.items?.unit ?? "",
    qty: Number(row.qty),
    status: toStatus(row.status),
    note: row.note,
  };
}

export class SupabaseSurplusRepository implements ISurplusRepository {
  private readonly client: AppSupabaseClient;

  constructor(client: AppSupabaseClient) {
    this.client = client;
  }

  async list(
    projectId: string | null,
  ): Promise<Result<readonly SurplusMaterialDto[], DomainError>> {
    try {
      let query = this.client
        .from("surplus_materials")
        .select(SELECT)
        .order("created_at", { ascending: false });

      if (projectId !== null && projectId !== "") {
        query = query.eq("project_id", projectId);
      }

      const { data, error } = await query.overrideTypes<SurplusRow[]>();
      if (error) return err(toDomainDbError(error, { entity: "المواد الزائدة" }));
      return ok((data ?? []).map(toDto));
    } catch (e) {
      return err(toDomainError(e, "تعذّر قراءة المواد الزائدة"));
    }
  }

  /** الصنف الواحد في المشروع سطر واحد — الإدخال المكرّر يُحدِّث لا يُضاعف. */
  async save(input: SaveSurplusDto): Promise<Result<SurplusMaterialDto, DomainError>> {
    try {
      const payload = {
        project_id: input.projectId,
        item_id: input.itemId,
        qty: input.qty,
        status: input.status,
        note: input.note,
      };

      const request =
        input.id === null
          ? this.client
              .from("surplus_materials")
              .upsert(payload, { onConflict: "project_id,item_id" })
          : this.client.from("surplus_materials").update(payload).eq("id", input.id);

      const { data, error } = await request
        .select(SELECT)
        .single()
        .overrideTypes<SurplusRow>();

      if (error)
        return err(
          toDomainDbError(error, { entity: "المواد الزائدة", id: input.id ?? "" }),
        );
      return ok(toDto(data));
    } catch (e) {
      return err(toDomainError(e, "تعذّر حفظ المواد الزائدة"));
    }
  }

  async remove(id: string): Promise<Result<void, DomainError>> {
    try {
      const { error } = await this.client
        .from("surplus_materials")
        .delete()
        .eq("id", id);
      if (error) return err(toDomainDbError(error, { entity: "المواد الزائدة", id }));
      return okVoid();
    } catch (e) {
      return err(toDomainError(e, "تعذّر حذف المواد الزائدة"));
    }
  }
}
