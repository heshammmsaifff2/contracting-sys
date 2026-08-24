/**
 * تقارير المخازن: الهدر بالوزن، مقارنة المشاريع، مقارنة المشرفين،
 * والتراكمي 3/6/12 شهرًا. كلها محسوبة في Postgres والواجهة تعرض فقط.
 */
import type { DomainError } from "@core/shared/errors/domain-error";
import { ValidationError } from "@core/shared/errors/domain-error";
import { err, type Result } from "@core/shared/result";
import type { UseCase } from "@application/shared/use-case";
import type {
  ConsumptionTrendPointDto,
  ConsumptionTrendQuery,
  ProjectConsumptionRowDto,
  SupervisorConsumptionRowDto,
  WarehouseReportFilter,
  WasteReportRowDto,
} from "../dtos";
import type { IWarehouseReportRepository } from "../ports/warehouse-report-repository";

export class GetWasteReport implements UseCase<
  WarehouseReportFilter,
  readonly WasteReportRowDto[]
> {
  private readonly repo: IWarehouseReportRepository;

  constructor(repo: IWarehouseReportRepository) {
    this.repo = repo;
  }

  async execute(
    input: WarehouseReportFilter,
  ): Promise<Result<readonly WasteReportRowDto[], DomainError>> {
    return this.repo.waste(input);
  }
}

export class GetProjectConsumption implements UseCase<
  WarehouseReportFilter,
  readonly ProjectConsumptionRowDto[]
> {
  private readonly repo: IWarehouseReportRepository;

  constructor(repo: IWarehouseReportRepository) {
    this.repo = repo;
  }

  async execute(
    input: WarehouseReportFilter,
  ): Promise<Result<readonly ProjectConsumptionRowDto[], DomainError>> {
    return this.repo.byProject(input);
  }
}

export class GetSupervisorConsumption implements UseCase<
  WarehouseReportFilter,
  readonly SupervisorConsumptionRowDto[]
> {
  private readonly repo: IWarehouseReportRepository;

  constructor(repo: IWarehouseReportRepository) {
    this.repo = repo;
  }

  async execute(
    input: WarehouseReportFilter,
  ): Promise<Result<readonly SupervisorConsumptionRowDto[], DomainError>> {
    return this.repo.bySupervisor(input);
  }
}

export class GetConsumptionTrend implements UseCase<
  ConsumptionTrendQuery,
  readonly ConsumptionTrendPointDto[]
> {
  private readonly repo: IWarehouseReportRepository;

  constructor(repo: IWarehouseReportRepository) {
    this.repo = repo;
  }

  async execute(
    input: ConsumptionTrendQuery,
  ): Promise<Result<readonly ConsumptionTrendPointDto[], DomainError>> {
    if (!Number.isInteger(input.months) || input.months <= 0) {
      return err(
        new ValidationError("عدد الأشهر يجب أن يكون رقمًا موجبًا", {
          months: "invalid",
        }),
      );
    }
    return this.repo.trend(input);
  }
}
