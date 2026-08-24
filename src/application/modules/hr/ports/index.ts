/**
 * منافذ شؤون الموظفين.
 * كل ما يمسّ اليوميات والأجور والسلف يمرّ بدوال الخادم: القواعد الثلاث
 * (لا ازدواج، لا تسجيل متأخّر، قيمة اليوم) تسكن قاعدة البيانات.
 */
import type { DomainError } from "@core/shared/errors/domain-error";
import type { Result } from "@core/shared/result";
import type {
  AttendanceFilter,
  AttendanceRowDto,
  AttendanceSettingsDto,
  AttendanceSuggestionDto,
  ChangeSalaryDto,
  DecideLoanDto,
  ImportStatementDto,
  ImportStatementResultDto,
  LaborCostRowDto,
  LaborDaysRowDto,
  LoanDto,
  ProductionRatingDto,
  RateProductionDto,
  RecommendationDto,
  RegisterAttendanceDto,
  RequestLoanDto,
  SalaryChangeDto,
  SaveRecommendationDto,
  SaveWorkerDto,
  SetWorkerStatusDto,
  WorkerDto,
  WorkerPoolFilter,
} from "../dtos";

export interface IWorkerRepository {
  /** بحث بالاسم ولو كُتب شاذًّا، أو بالكود أو رقم البطاقة [2]. */
  search(query: string): Promise<Result<readonly WorkerDto[], DomainError>>;
  listPool(
    filter: WorkerPoolFilter,
  ): Promise<Result<readonly WorkerDto[], DomainError>>;
  save(input: SaveWorkerDto): Promise<Result<WorkerDto, DomainError>>;
  setStatus(input: SetWorkerStatusDto): Promise<Result<void, DomainError>>;
}

export interface IAttendanceRepository {
  /** أسماء آخر يوم عمل للمشروع — يؤشّر المستخدم ويزيل الغائب فقط [2]. */
  suggest(
    projectId: string,
    workDate: string,
  ): Promise<Result<readonly AttendanceSuggestionDto[], DomainError>>;

  list(
    filter: AttendanceFilter,
  ): Promise<Result<readonly AttendanceRowDto[], DomainError>>;

  register(input: RegisterAttendanceDto): Promise<Result<number, DomainError>>;

  settings(): Promise<Result<AttendanceSettingsDto, DomainError>>;

  laborDays(
    projectId: string | null,
  ): Promise<Result<readonly LaborDaysRowDto[], DomainError>>;

  laborCost(
    projectId: string | null,
    period: string | null,
  ): Promise<Result<readonly LaborCostRowDto[], DomainError>>;
}

export interface ILoanRepository {
  list(workerId: string | null): Promise<Result<readonly LoanDto[], DomainError>>;
  request(input: RequestLoanDto): Promise<Result<LoanDto, DomainError>>;
  withdraw(id: string): Promise<Result<void, DomainError>>;
  decide(input: DecideLoanDto): Promise<Result<void, DomainError>>;
}

export interface IWorkerFileRepository {
  salaryHistory(
    workerId: string,
  ): Promise<Result<readonly SalaryChangeDto[], DomainError>>;
  changeSalary(input: ChangeSalaryDto): Promise<Result<void, DomainError>>;

  ratings(
    workerId: string | null,
    period: string | null,
  ): Promise<Result<readonly ProductionRatingDto[], DomainError>>;
  rateProduction(input: RateProductionDto): Promise<Result<void, DomainError>>;

  recommendations(
    workerId: string,
  ): Promise<Result<readonly RecommendationDto[], DomainError>>;
  addRecommendation(input: SaveRecommendationDto): Promise<Result<void, DomainError>>;
}

/** ترحيل كشف البنك — Edge Function لأن الترحيل المحاسبي service_role. */
export interface IPayrollImporter {
  importStatement(
    input: ImportStatementDto,
  ): Promise<Result<ImportStatementResultDto, DomainError>>;
}
