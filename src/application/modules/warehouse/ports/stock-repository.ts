import type { DomainError } from "@core/shared/errors/domain-error";
import type { Result } from "@core/shared/result";
import type {
  ConsumptionDto,
  ConsumptionFilter,
  IssueStockDto,
  MandoubStockDto,
  RecordConsumptionDto,
  StockMovementDto,
  StockMovementFilter,
} from "../dtos";

/**
 * حركة المخزون كلها على الخادم: كل عملية تنادي دالة Postgres واحدة
 * تنقص رصيدًا وتزيد آخر وتكتب الأثر وتُطلق الإشعار في معاملة واحدة.
 */
export interface IStockRepository {
  listCustody(filter: {
    projectId?: string | null;
    mandoubId?: string | null;
  }): Promise<Result<readonly MandoubStockDto[], DomainError>>;

  listMovements(
    filter: StockMovementFilter,
  ): Promise<Result<readonly StockMovementDto[], DomainError>>;

  /** تسليم من مخزون الموقع إلى عهدة المندوب — يعيد معرّف السند. */
  issueToMandoub(
    input: IssueStockDto,
  ): Promise<Result<{ batchId: string }, DomainError>>;

  /** ردّ من العهدة إلى مخزون الموقع. */
  returnFromMandoub(
    input: IssueStockDto,
  ): Promise<Result<{ batchId: string }, DomainError>>;

  listConsumption(
    filter: ConsumptionFilter,
  ): Promise<Result<readonly ConsumptionDto[], DomainError>>;

  /** تنزيل كميات على منشأة — ينقص العهدة ويُطلق إشعارًا. */
  recordConsumption(
    input: RecordConsumptionDto,
  ): Promise<Result<{ batchId: string }, DomainError>>;
}
