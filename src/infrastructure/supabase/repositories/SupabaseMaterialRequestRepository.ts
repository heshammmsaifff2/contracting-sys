import type { DomainError } from "@core/shared/errors/domain-error";
import { toDomainError } from "@core/shared/errors/domain-error";
import { err, ok, okVoid, type Result } from "@core/shared/result";
import type { MaterialRequestStatus } from "@core/modules/procurement/entities/MaterialRequest";
import { MATERIAL_REQUEST_STATUSES } from "@core/modules/procurement/entities/MaterialRequest";
import type {
  CreateMaterialRequestDto,
  MaterialRequestDto,
  ProjectItemLimitDto,
  SaveProjectItemLimitDto,
} from "@application/modules/procurement/dtos";
import type { IMaterialRequestRepository } from "@application/modules/procurement/ports/material-request-repository";
import type { AppSupabaseClient } from "../client";
import { toDomainDbError } from "../errors";

const SELECT_WITH_LINES = `
  id, no, project_id, status, notes,
  projects(name),
  material_request_lines(
    id, item_id, requested_qty, max_qty, prev_requested_qty, remaining_balance,
    items(code, name, unit)
  )
`;

interface LineRow {
  id: string;
  item_id: string;
  requested_qty: number;
  max_qty: number | null;
  prev_requested_qty: number;
  remaining_balance: number | null;
  items: { code: string; name: string; unit: string } | null;
}

interface RequestRow {
  id: string;
  no: number;
  project_id: string;
  status: string;
  notes: string;
  projects: { name: string } | null;
  material_request_lines: LineRow[] | null;
}

function toStatus(raw: string): MaterialRequestStatus {
  return MATERIAL_REQUEST_STATUSES.includes(raw as MaterialRequestStatus)
    ? (raw as MaterialRequestStatus)
    : "draft";
}

function toDto(row: RequestRow): MaterialRequestDto {
  return {
    id: row.id,
    no: row.no,
    projectId: row.project_id,
    projectName: row.projects?.name ?? "",
    status: toStatus(row.status),
    notes: row.notes,
    lines: (row.material_request_lines ?? []).map((line) => ({
      id: line.id,
      itemId: line.item_id,
      itemCode: line.items?.code ?? "",
      itemName: line.items?.name ?? "",
      itemUnit: line.items?.unit ?? "",
      requestedQty: Number(line.requested_qty),
      maxQty: line.max_qty === null ? null : Number(line.max_qty),
      prevRequestedQty: Number(line.prev_requested_qty),
      remainingBalance:
        line.remaining_balance === null ? null : Number(line.remaining_balance),
    })),
  };
}

export class SupabaseMaterialRequestRepository implements IMaterialRequestRepository {
  private readonly client: AppSupabaseClient;

  constructor(client: AppSupabaseClient) {
    this.client = client;
  }

  /** لا فلترة مشاريع هنا: RLS تحصر الطلبات في المشاريع المعتمدة. */
  async list(): Promise<Result<readonly MaterialRequestDto[], DomainError>> {
    try {
      const { data, error } = await this.client
        .from("material_requests")
        .select(SELECT_WITH_LINES)
        .order("no", { ascending: false })
        .overrideTypes<RequestRow[]>();

      if (error) return err(toDomainDbError(error, { entity: "طلبات الاحتياج" }));
      return ok((data ?? []).map(toDto));
    } catch (e) {
      return err(toDomainError(e, "تعذّر قراءة طلبات الاحتياج"));
    }
  }

  async findById(id: string): Promise<Result<MaterialRequestDto | null, DomainError>> {
    try {
      const { data, error } = await this.client
        .from("material_requests")
        .select(SELECT_WITH_LINES)
        .eq("id", id)
        .maybeSingle()
        .overrideTypes<RequestRow>();

      if (error) return err(toDomainDbError(error, { entity: "طلب الاحتياج", id }));
      if (data === null) return ok(null);
      return ok(toDto(data));
    } catch (e) {
      return err(toDomainError(e, "تعذّر قراءة طلب الاحتياج"));
    }
  }

  /**
   * الأسطر تُدرَج بالكمية المطلوبة فقط؛ الحد الأقصى والسابق والمتبقّي
   * يملؤها مُشغِّل Postgres، فلا تُرسل من المتصفّح إطلاقًا.
   */
  async create(
    input: CreateMaterialRequestDto,
  ): Promise<Result<MaterialRequestDto, DomainError>> {
    try {
      const { data: header, error: headerError } = await this.client
        .from("material_requests")
        .insert({
          project_id: input.projectId,
          notes: input.notes,
          status: "draft",
        })
        .select("id")
        .single();

      if (headerError)
        return err(toDomainDbError(headerError, { entity: "طلب الاحتياج" }));

      const { error: linesError } = await this.client
        .from("material_request_lines")
        .insert(
          input.lines.map((line) => ({
            request_id: header.id,
            item_id: line.itemId,
            requested_qty: line.requestedQty,
          })),
        );

      if (linesError) {
        // تراجع: لا نترك طلبًا بلا أسطر
        await this.client.from("material_requests").delete().eq("id", header.id);
        return err(toDomainDbError(linesError, { entity: "أسطر الاحتياج" }));
      }

      const created = await this.findById(header.id);
      if (!created.ok) return created;
      if (created.value === null) {
        return err(toDomainError(null, "تعذّر قراءة الطلب بعد إنشائه"));
      }
      return ok(created.value);
    } catch (e) {
      return err(toDomainError(e, "تعذّر إنشاء طلب الاحتياج"));
    }
  }

  async setStatus(id: string, status: string): Promise<Result<void, DomainError>> {
    try {
      const { error } = await this.client
        .from("material_requests")
        .update({ status })
        .eq("id", id);

      if (error) return err(toDomainDbError(error, { entity: "طلب الاحتياج", id }));
      return okVoid();
    } catch (e) {
      return err(toDomainError(e, "تعذّر تغيير حالة الطلب"));
    }
  }

  /** حدود المكتب الفني مدموجة مع المتوفّر بالموقع لنفس الصنف. */
  async listLimits(
    projectId: string,
  ): Promise<Result<readonly ProjectItemLimitDto[], DomainError>> {
    try {
      const { data, error } = await this.client
        .from("project_item_limits")
        .select("project_id, item_id, max_qty, items(code, name, unit)")
        .eq("project_id", projectId)
        .overrideTypes<
          {
            project_id: string;
            item_id: string;
            max_qty: number;
            items: { code: string; name: string; unit: string } | null;
          }[]
        >();

      if (error)
        return err(toDomainDbError(error, { entity: "حدود الأصناف", id: projectId }));

      const { data: stock, error: stockError } = await this.client
        .from("site_stock")
        .select("item_id, quantity")
        .eq("project_id", projectId);

      if (stockError)
        return err(
          toDomainDbError(stockError, { entity: "المتوفّر بالموقع", id: projectId }),
        );

      const stockByItem = new Map(
        (stock ?? []).map((row) => [row.item_id, Number(row.quantity)]),
      );

      return ok(
        (data ?? []).map((row) => ({
          projectId: row.project_id,
          itemId: row.item_id,
          itemCode: row.items?.code ?? "",
          itemName: row.items?.name ?? "",
          itemUnit: row.items?.unit ?? "",
          maxQty: Number(row.max_qty),
          siteQty: stockByItem.get(row.item_id) ?? 0,
        })),
      );
    } catch (e) {
      return err(toDomainError(e, "تعذّر قراءة حدود الأصناف"));
    }
  }

  async saveLimit(input: SaveProjectItemLimitDto): Promise<Result<void, DomainError>> {
    try {
      const { error } = await this.client.from("project_item_limits").upsert(
        {
          project_id: input.projectId,
          item_id: input.itemId,
          max_qty: input.maxQty,
        },
        { onConflict: "project_id,item_id" },
      );

      if (error) return err(toDomainDbError(error, { entity: "حد الصنف" }));
      return okVoid();
    } catch (e) {
      return err(toDomainError(e, "تعذّر حفظ حد الصنف"));
    }
  }

  async saveSiteStock(
    projectId: string,
    itemId: string,
    quantity: number,
  ): Promise<Result<void, DomainError>> {
    try {
      const { error } = await this.client
        .from("site_stock")
        .upsert(
          { project_id: projectId, item_id: itemId, quantity },
          { onConflict: "project_id,item_id" },
        );

      if (error) return err(toDomainDbError(error, { entity: "المتوفّر بالموقع" }));
      return okVoid();
    } catch (e) {
      return err(toDomainError(e, "تعذّر حفظ المتوفّر بالموقع"));
    }
  }
}
