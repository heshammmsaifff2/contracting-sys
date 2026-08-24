/**
 * حركة المخزون: الموقع ⇄ عهدة المندوب ⇒ المنشأة.
 * القواعد هنا تحمي المستخدم من طلب مرفوض سلفًا؛ الفحص المُلزِم يقع على
 * الخادم تحت قفل الصف، فلا يمكن تجاوزه من الواجهة.
 */
import type { DomainError } from "@core/shared/errors/domain-error";
import { ValidationError } from "@core/shared/errors/domain-error";
import { err, type Result } from "@core/shared/result";
import {
  validateAgainstCustody,
  validateStockLines,
} from "@core/modules/warehouse/entities/MandoubCustody";
import type { UseCase } from "@application/shared/use-case";
import type {
  ConsumptionDto,
  ConsumptionFilter,
  IssueStockDto,
  MandoubStockDto,
  RecordConsumptionDto,
  StockMovementDto,
  StockMovementFilter,
} from "../dtos";
import type { IStockRepository } from "../ports/stock-repository";

export class ListMandoubStock implements UseCase<
  { projectId: string | null; mandoubId: string | null },
  readonly MandoubStockDto[]
> {
  private readonly repo: IStockRepository;

  constructor(repo: IStockRepository) {
    this.repo = repo;
  }

  async execute(input: {
    projectId: string | null;
    mandoubId: string | null;
  }): Promise<Result<readonly MandoubStockDto[], DomainError>> {
    return this.repo.listCustody(input);
  }
}

export class ListStockMovements implements UseCase<
  StockMovementFilter,
  readonly StockMovementDto[]
> {
  private readonly repo: IStockRepository;

  constructor(repo: IStockRepository) {
    this.repo = repo;
  }

  async execute(
    input: StockMovementFilter,
  ): Promise<Result<readonly StockMovementDto[], DomainError>> {
    return this.repo.listMovements(input);
  }
}

export class IssueStockToMandoub implements UseCase<
  IssueStockDto,
  { batchId: string }
> {
  private readonly repo: IStockRepository;

  constructor(repo: IStockRepository) {
    this.repo = repo;
  }

  async execute(
    input: IssueStockDto,
  ): Promise<Result<{ batchId: string }, DomainError>> {
    const guard = guardIssueInput(input);
    if (!guard.ok) return guard;
    return this.repo.issueToMandoub(input);
  }
}

export class ReturnMandoubStock implements UseCase<IssueStockDto, { batchId: string }> {
  private readonly repo: IStockRepository;

  constructor(repo: IStockRepository) {
    this.repo = repo;
  }

  async execute(
    input: IssueStockDto,
  ): Promise<Result<{ batchId: string }, DomainError>> {
    const guard = guardIssueInput(input);
    if (!guard.ok) return guard;
    return this.repo.returnFromMandoub(input);
  }
}

export class ListConsumption implements UseCase<
  ConsumptionFilter,
  readonly ConsumptionDto[]
> {
  private readonly repo: IStockRepository;

  constructor(repo: IStockRepository) {
    this.repo = repo;
  }

  async execute(
    input: ConsumptionFilter,
  ): Promise<Result<readonly ConsumptionDto[], DomainError>> {
    return this.repo.listConsumption(input);
  }
}

/**
 * تنزيل كميات على منشأة. المندوب مطلوب لأن العهدة التي ستنقص عهدته،
 * والرصيد المتاح يُفحص قبل الإرسال ثم يُعاد فحصه على الخادم.
 */
export class RecordFacilityConsumption implements UseCase<
  RecordConsumptionDto & { available?: ReadonlyMap<string, number> },
  { batchId: string }
> {
  private readonly repo: IStockRepository;

  constructor(repo: IStockRepository) {
    this.repo = repo;
  }

  async execute(
    input: RecordConsumptionDto & { available?: ReadonlyMap<string, number> },
  ): Promise<Result<{ batchId: string }, DomainError>> {
    if (input.facilityId === "") {
      return err(new ValidationError("المنشأة مطلوبة", { facilityId: "required" }));
    }
    if (input.mandoubId === "") {
      return err(new ValidationError("المندوب مطلوب", { mandoubId: "required" }));
    }

    const lines = validateStockLines(input.lines);
    if (!lines.ok) return lines;

    if (input.available !== undefined) {
      const covered = validateAgainstCustody(input.lines, input.available);
      if (!covered.ok) return covered;
    }

    const { available: _available, ...payload } = input;
    return this.repo.recordConsumption(payload);
  }
}

function guardIssueInput(input: IssueStockDto): Result<void, DomainError> {
  if (input.projectId === "") {
    return err(new ValidationError("المشروع مطلوب", { projectId: "required" }));
  }
  if (input.mandoubId === "") {
    return err(new ValidationError("المندوب مطلوب", { mandoubId: "required" }));
  }
  return validateStockLines(input.lines);
}
