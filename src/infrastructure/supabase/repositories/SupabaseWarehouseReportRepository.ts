/**
 * تقارير المخازن — قراءة من عروض ودوال Postgres.
 * لا يُعاد حساب أي نسبة هنا: العتبة والوزن والمتوسط كلها من الخادم،
 * فلا تختلف الأرقام بين شاشة وتقرير.
 */
import type { DomainError } from "@core/shared/errors/domain-error";
import { toDomainError } from "@core/shared/errors/domain-error";
import { err, ok, type Result } from "@core/shared/result";
import type {
  ConsumptionTrendPointDto,
  ConsumptionTrendQuery,
  ProjectConsumptionRowDto,
  SupervisorConsumptionRowDto,
  WarehouseReportFilter,
  WasteReportRowDto,
} from "@application/modules/warehouse/dtos";
import type { IWarehouseReportRepository } from "@application/modules/warehouse/ports/warehouse-report-repository";
import type { AppSupabaseClient } from "../client";
import { toDomainDbError } from "../errors";

function numberOrNull(value: number | string | null): number | null {
  if (value === null) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

export class SupabaseWarehouseReportRepository implements IWarehouseReportRepository {
  private readonly client: AppSupabaseClient;

  constructor(client: AppSupabaseClient) {
    this.client = client;
  }

  async waste(
    filter: WarehouseReportFilter,
  ): Promise<Result<readonly WasteReportRowDto[], DomainError>> {
    try {
      let query = this.client
        .from("facility_waste_report")
        .select("*")
        .order("deviation_ratio", { ascending: false });

      if (filter.projectId != null && filter.projectId !== "") {
        query = query.eq("project_id", filter.projectId);
      }
      if (filter.itemId != null && filter.itemId !== "") {
        query = query.eq("item_id", filter.itemId);
      }

      const { data, error } = await query;
      if (error) return err(toDomainDbError(error, { entity: "تقرير الهدر" }));

      return ok(
        (data ?? []).map((row) => ({
          projectId: row.project_id ?? "",
          projectName: row.project_name ?? "",
          itemId: row.item_id ?? "",
          itemCode: row.item_code ?? "",
          itemName: row.item_name ?? "",
          itemUnit: row.item_unit ?? "",
          facilityId: row.facility_id ?? "",
          facilityName: row.facility_name ?? "",
          groupName: row.group_name ?? "",
          district: row.district ?? "",
          weight: Number(row.weight ?? 0),
          qty: Number(row.qty ?? 0),
          qtyPerWeight: Number(row.qty_per_weight ?? 0),
          avgQtyPerWeight: Number(row.avg_qty_per_weight ?? 0),
          deviationRatio: numberOrNull(row.deviation_ratio),
          isWasteful: row.is_wasteful === true,
          lastConsumedAt: row.last_consumed_at,
        })),
      );
    } catch (e) {
      return err(toDomainError(e, "تعذّر قراءة تقرير الهدر"));
    }
  }

  async byProject(
    filter: WarehouseReportFilter,
  ): Promise<Result<readonly ProjectConsumptionRowDto[], DomainError>> {
    try {
      let query = this.client
        .from("project_consumption_summary")
        .select("*")
        .order("qty", { ascending: false });

      if (filter.projectId != null && filter.projectId !== "") {
        query = query.eq("project_id", filter.projectId);
      }
      if (filter.itemId != null && filter.itemId !== "") {
        query = query.eq("item_id", filter.itemId);
      }

      const { data, error } = await query;
      if (error) return err(toDomainDbError(error, { entity: "مقارنة المشاريع" }));

      return ok(
        (data ?? []).map((row) => ({
          projectId: row.project_id ?? "",
          projectCode: row.project_code ?? "",
          projectName: row.project_name ?? "",
          itemId: row.item_id ?? "",
          itemCode: row.item_code ?? "",
          itemName: row.item_name ?? "",
          itemUnit: row.item_unit ?? "",
          qty: Number(row.qty ?? 0),
          facilitiesCount: Number(row.facilities_count ?? 0),
          downloadsCount: Number(row.downloads_count ?? 0),
          totalWeight: Number(row.total_weight ?? 0),
          qtyPerWeight: numberOrNull(row.qty_per_weight),
          lastConsumedAt: row.last_consumed_at,
        })),
      );
    } catch (e) {
      return err(toDomainError(e, "تعذّر قراءة مقارنة المشاريع"));
    }
  }

  async bySupervisor(
    filter: WarehouseReportFilter,
  ): Promise<Result<readonly SupervisorConsumptionRowDto[], DomainError>> {
    try {
      let query = this.client
        .from("supervisor_consumption_summary")
        .select("*")
        .order("total_qty", { ascending: false });

      if (filter.projectId != null && filter.projectId !== "") {
        query = query.eq("project_id", filter.projectId);
      }

      const { data, error } = await query;
      if (error) return err(toDomainDbError(error, { entity: "مقارنة المشرفين" }));

      return ok(
        (data ?? []).map((row) => ({
          supervisorId: row.supervisor_id,
          supervisorName: row.supervisor_name ?? "",
          projectId: row.project_id ?? "",
          projectName: row.project_name ?? "",
          downloadsCount: Number(row.downloads_count ?? 0),
          facilitiesCount: Number(row.facilities_count ?? 0),
          totalQty: Number(row.total_qty ?? 0),
          withPhotos: Number(row.with_photos ?? 0),
          lastConsumedAt: row.last_consumed_at,
        })),
      );
    } catch (e) {
      return err(toDomainError(e, "تعذّر قراءة مقارنة المشرفين"));
    }
  }

  async trend(
    query: ConsumptionTrendQuery,
  ): Promise<Result<readonly ConsumptionTrendPointDto[], DomainError>> {
    try {
      const { data, error } = await this.client.rpc("consumption_trend", {
        p_months: query.months,
        ...(query.projectId === null ? {} : { p_project_id: query.projectId }),
        ...(query.itemId === null ? {} : { p_item_id: query.itemId }),
      });

      if (error) return err(toDomainDbError(error, { entity: "التقرير التراكمي" }));

      return ok(
        (data ?? []).map((row) => ({
          period: row.period,
          qty: Number(row.qty),
          cumulativeQty: Number(row.cumulative_qty),
          downloadsCount: Number(row.downloads_count),
        })),
      );
    } catch (e) {
      return err(toDomainError(e, "تعذّر قراءة التقرير التراكمي"));
    }
  }
}
