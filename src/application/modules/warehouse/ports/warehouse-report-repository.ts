import type { DomainError } from "@core/shared/errors/domain-error";
import type { Result } from "@core/shared/result";
import type {
  ConsumptionTrendPointDto,
  ConsumptionTrendQuery,
  ProjectConsumptionRowDto,
  SupervisorConsumptionRowDto,
  WarehouseReportFilter,
  WasteReportRowDto,
} from "../dtos";

/**
 * كل التقارير محسوبة في Postgres (views + دوال) — الواجهة تعرض فقط،
 * فلا يتكرّر منطق الوزن النسبي في المتصفّح ولا يختلف بين شاشة وأخرى.
 */
export interface IWarehouseReportRepository {
  waste(
    filter: WarehouseReportFilter,
  ): Promise<Result<readonly WasteReportRowDto[], DomainError>>;

  byProject(
    filter: WarehouseReportFilter,
  ): Promise<Result<readonly ProjectConsumptionRowDto[], DomainError>>;

  bySupervisor(
    filter: WarehouseReportFilter,
  ): Promise<Result<readonly SupervisorConsumptionRowDto[], DomainError>>;

  trend(
    query: ConsumptionTrendQuery,
  ): Promise<Result<readonly ConsumptionTrendPointDto[], DomainError>>;
}
