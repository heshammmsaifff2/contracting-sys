/**
 * حركة المخزون. كل تغيير رصيد يمرّ بدالة Postgres واحدة فتقع خطواته
 * في معاملة ذرّية على الخادم مع فحص الصلاحية والمشروع المعتمد،
 * والقراءة من عروض security_invoker فتسري عليها RLS كما هي.
 */
import type { DomainError } from "@core/shared/errors/domain-error";
import { toDomainError } from "@core/shared/errors/domain-error";
import { err, ok, type Result } from "@core/shared/result";
import type { StockDirection } from "@core/modules/warehouse/entities/MandoubCustody";
import type {
  ConsumptionDto,
  ConsumptionFilter,
  IssueStockDto,
  MandoubStockDto,
  RecordConsumptionDto,
  StockMovementDto,
  StockMovementFilter,
} from "@application/modules/warehouse/dtos";
import type { IStockRepository } from "@application/modules/warehouse/ports/stock-repository";
import {
  fromStoredFiles,
  toStoredFiles,
} from "@infrastructure/mappers/stored-file-mapper";
import type { AppSupabaseClient } from "../client";
import { toDomainDbError } from "../errors";

const MOVEMENT_SELECT = `
  id, batch_id, project_id, item_id, qty, direction, mandoub_id, facility_id,
  note, created_at,
  items(code, name, unit),
  profiles!stock_movements_mandoub_id_fkey(full_name),
  facilities(name)
`;

interface MovementRow {
  id: string;
  batch_id: string;
  project_id: string;
  item_id: string;
  qty: number;
  direction: string;
  mandoub_id: string | null;
  facility_id: string | null;
  note: string;
  created_at: string;
  items: { code: string; name: string; unit: string } | null;
  profiles: { full_name: string } | null;
  facilities: { name: string } | null;
}

const DIRECTIONS: readonly StockDirection[] = [
  "site_to_mandoub",
  "mandoub_to_site",
  "mandoub_to_facility",
];

function toDirection(raw: string): StockDirection {
  return DIRECTIONS.find((d) => d === raw) ?? "site_to_mandoub";
}

/** أسطر السند بالشكل الذي تتوقّعه دوال Postgres. */
function linesPayload(
  lines: IssueStockDto["lines"],
): { item_id: string; qty: number }[] {
  return lines.map((line) => ({ item_id: line.itemId, qty: line.qty }));
}

export class SupabaseStockRepository implements IStockRepository {
  private readonly client: AppSupabaseClient;

  constructor(client: AppSupabaseClient) {
    this.client = client;
  }

  async listCustody(filter: {
    projectId?: string | null;
    mandoubId?: string | null;
  }): Promise<Result<readonly MandoubStockDto[], DomainError>> {
    try {
      let query = this.client
        .from("mandoub_stock_view")
        .select("*")
        .gt("quantity", 0)
        .order("mandoub_name")
        .order("item_name");

      if (filter.projectId != null && filter.projectId !== "") {
        query = query.eq("project_id", filter.projectId);
      }
      if (filter.mandoubId != null && filter.mandoubId !== "") {
        query = query.eq("mandoub_id", filter.mandoubId);
      }

      const { data, error } = await query;
      if (error) return err(toDomainDbError(error, { entity: "عهدة المندوب" }));

      return ok(
        (data ?? []).map((row) => ({
          projectId: row.project_id ?? "",
          projectName: row.project_name ?? "",
          mandoubId: row.mandoub_id ?? "",
          mandoubName: row.mandoub_name ?? "",
          itemId: row.item_id ?? "",
          itemCode: row.item_code ?? "",
          itemName: row.item_name ?? "",
          itemUnit: row.item_unit ?? "",
          quantity: Number(row.quantity ?? 0),
          updatedAt: row.updated_at ?? "",
        })),
      );
    } catch (e) {
      return err(toDomainError(e, "تعذّر قراءة عهدة المندوب"));
    }
  }

  async listMovements(
    filter: StockMovementFilter,
  ): Promise<Result<readonly StockMovementDto[], DomainError>> {
    try {
      let query = this.client
        .from("stock_movements")
        .select(MOVEMENT_SELECT)
        .order("created_at", { ascending: false })
        .limit(200);

      if (filter.projectId != null && filter.projectId !== "") {
        query = query.eq("project_id", filter.projectId);
      }
      if (filter.mandoubId != null && filter.mandoubId !== "") {
        query = query.eq("mandoub_id", filter.mandoubId);
      }

      const { data, error } = await query.overrideTypes<MovementRow[]>();
      if (error) return err(toDomainDbError(error, { entity: "حركة المخزون" }));

      return ok(
        (data ?? []).map((row) => ({
          id: row.id,
          batchId: row.batch_id,
          projectId: row.project_id,
          itemId: row.item_id,
          itemCode: row.items?.code ?? "",
          itemName: row.items?.name ?? "",
          itemUnit: row.items?.unit ?? "",
          qty: Number(row.qty),
          direction: toDirection(row.direction),
          mandoubId: row.mandoub_id,
          mandoubName: row.profiles?.full_name ?? "",
          facilityId: row.facility_id,
          facilityName: row.facilities?.name ?? "",
          note: row.note,
          createdAt: row.created_at,
        })),
      );
    } catch (e) {
      return err(toDomainError(e, "تعذّر قراءة حركة المخزون"));
    }
  }

  async issueToMandoub(
    input: IssueStockDto,
  ): Promise<Result<{ batchId: string }, DomainError>> {
    try {
      const { data, error } = await this.client.rpc("issue_stock_to_mandoub", {
        p_project_id: input.projectId,
        p_mandoub_id: input.mandoubId,
        p_lines: linesPayload(input.lines),
        p_note: input.note,
      });

      if (error) return err(toDomainDbError(error, { entity: "تسليم العهدة" }));
      return ok({ batchId: data });
    } catch (e) {
      return err(toDomainError(e, "تعذّر تسليم العهدة"));
    }
  }

  async returnFromMandoub(
    input: IssueStockDto,
  ): Promise<Result<{ batchId: string }, DomainError>> {
    try {
      const { data, error } = await this.client.rpc("return_mandoub_stock", {
        p_project_id: input.projectId,
        p_mandoub_id: input.mandoubId,
        p_lines: linesPayload(input.lines),
        p_note: input.note,
      });

      if (error) return err(toDomainDbError(error, { entity: "ردّ العهدة" }));
      return ok({ batchId: data });
    } catch (e) {
      return err(toDomainError(e, "تعذّر ردّ العهدة"));
    }
  }

  async listConsumption(
    filter: ConsumptionFilter,
  ): Promise<Result<readonly ConsumptionDto[], DomainError>> {
    try {
      let query = this.client
        .from("facility_consumption_view")
        .select("*")
        .order("consumed_at", { ascending: false })
        .limit(300);

      if (filter.projectId != null && filter.projectId !== "") {
        query = query.eq("project_id", filter.projectId);
      }
      if (filter.facilityId != null && filter.facilityId !== "") {
        query = query.eq("facility_id", filter.facilityId);
      }
      if (filter.supervisorId != null && filter.supervisorId !== "") {
        query = query.eq("supervisor_id", filter.supervisorId);
      }

      const { data, error } = await query;
      if (error) return err(toDomainDbError(error, { entity: "استهلاك المنشآت" }));

      return ok(
        (data ?? []).map((row) => ({
          id: row.id ?? "",
          batchId: row.batch_id ?? "",
          facilityId: row.facility_id ?? "",
          facilityCode: row.facility_code ?? "",
          facilityName: row.facility_name ?? "",
          groupName: row.group_name ?? "",
          district: row.district ?? "",
          facilityWeight: Number(row.facility_weight ?? 0),
          projectId: row.project_id ?? "",
          projectName: row.project_name ?? "",
          itemId: row.item_id ?? "",
          itemCode: row.item_code ?? "",
          itemName: row.item_name ?? "",
          itemUnit: row.item_unit ?? "",
          qty: Number(row.qty ?? 0),
          mandoubId: row.mandoub_id,
          mandoubName: row.mandoub_name ?? "",
          supervisorId: row.supervisor_id,
          supervisorName: row.supervisor_name ?? "",
          consumedAt: row.consumed_at ?? "",
          note: row.note ?? "",
          photos: toStoredFiles(row.photos),
        })),
      );
    } catch (e) {
      return err(toDomainError(e, "تعذّر قراءة استهلاك المنشآت"));
    }
  }

  async recordConsumption(
    input: RecordConsumptionDto,
  ): Promise<Result<{ batchId: string }, DomainError>> {
    try {
      const { data, error } = await this.client.rpc("record_facility_consumption", {
        p_facility_id: input.facilityId,
        p_mandoub_id: input.mandoubId,
        p_lines: linesPayload(input.lines),
        p_photos: fromStoredFiles(input.photos),
        p_note: input.note,
        ...(input.consumedAt !== null && input.consumedAt !== ""
          ? { p_consumed_at: input.consumedAt }
          : {}),
      });

      if (error) return err(toDomainDbError(error, { entity: "تنزيل الكميات" }));
      return ok({ batchId: data });
    } catch (e) {
      return err(toDomainError(e, "تعذّر تسجيل تنزيل الكميات"));
    }
  }
}
