/**
 * ملفات العمالة وحالتها والسلف والأجور والتقييم.
 * الخدمة الذاتية [7]: العامل يطلب سلفته بنفسه، ويرى يومياته ودرجته —
 * بهويّته لا بصلاحية، فيعمل حسابه ولو كان بلا دور.
 */
import type { DomainError } from "@core/shared/errors/domain-error";
import { ValidationError } from "@core/shared/errors/domain-error";
import { err, type Result } from "@core/shared/result";
import { validateLoanRequest } from "@core/modules/hr/entities/Loan";
import type { UseCase } from "@application/shared/use-case";
import type {
  ChangeSalaryDto,
  DecideLoanDto,
  ImportStatementDto,
  ImportStatementResultDto,
  LoanDto,
  ProductionRatingDto,
  RateProductionDto,
  RecommendationDto,
  RequestLoanDto,
  SalaryChangeDto,
  SaveRecommendationDto,
  SaveWorkerDto,
  SetWorkerStatusDto,
  WorkerDto,
  WorkerPoolFilter,
} from "../dtos";
import type {
  ILoanRepository,
  IPayrollImporter,
  IWorkerFileRepository,
  IWorkerRepository,
} from "../ports";

// ── العمالة ─────────────────────────────────────────────────────────────
export class SearchWorkers implements UseCase<{ query: string }, readonly WorkerDto[]> {
  private readonly repo: IWorkerRepository;

  constructor(repo: IWorkerRepository) {
    this.repo = repo;
  }

  async execute(input: {
    query: string;
  }): Promise<Result<readonly WorkerDto[], DomainError>> {
    return this.repo.search(input.query);
  }
}

export class ListWorkerPool implements UseCase<WorkerPoolFilter, readonly WorkerDto[]> {
  private readonly repo: IWorkerRepository;

  constructor(repo: IWorkerRepository) {
    this.repo = repo;
  }

  async execute(
    input: WorkerPoolFilter,
  ): Promise<Result<readonly WorkerDto[], DomainError>> {
    return this.repo.listPool(input);
  }
}

export class SaveWorker implements UseCase<SaveWorkerDto, WorkerDto> {
  private readonly repo: IWorkerRepository;

  constructor(repo: IWorkerRepository) {
    this.repo = repo;
  }

  async execute(input: SaveWorkerDto): Promise<Result<WorkerDto, DomainError>> {
    if (input.id === "") {
      return err(new ValidationError("الموظف مطلوب", { id: "required" }));
    }
    return this.repo.save(input);
  }
}

export class SetWorkerStatus implements UseCase<SetWorkerStatusDto, void> {
  private readonly repo: IWorkerRepository;

  constructor(repo: IWorkerRepository) {
    this.repo = repo;
  }

  async execute(input: SetWorkerStatusDto): Promise<Result<void, DomainError>> {
    if (input.status === "seconded" && input.projectId === null) {
      return err(new ValidationError("الندب يحتاج مشروعًا", { projectId: "required" }));
    }
    return this.repo.setStatus(input);
  }
}

// ── السلف ───────────────────────────────────────────────────────────────
export class ListLoans implements UseCase<
  { workerId: string | null },
  readonly LoanDto[]
> {
  private readonly repo: ILoanRepository;

  constructor(repo: ILoanRepository) {
    this.repo = repo;
  }

  async execute(input: {
    workerId: string | null;
  }): Promise<Result<readonly LoanDto[], DomainError>> {
    return this.repo.list(input.workerId);
  }
}

export class RequestLoan implements UseCase<RequestLoanDto, LoanDto> {
  private readonly repo: ILoanRepository;

  constructor(repo: ILoanRepository) {
    this.repo = repo;
  }

  async execute(input: RequestLoanDto): Promise<Result<LoanDto, DomainError>> {
    const guard = validateLoanRequest({
      amount: input.amount,
      installments: input.installments,
      reason: input.reason,
    });
    if (!guard.ok) return guard;

    return this.repo.request(input);
  }
}

export class WithdrawLoan implements UseCase<{ id: string }, void> {
  private readonly repo: ILoanRepository;

  constructor(repo: ILoanRepository) {
    this.repo = repo;
  }

  async execute(input: { id: string }): Promise<Result<void, DomainError>> {
    return this.repo.withdraw(input.id);
  }
}

export class DecideLoan implements UseCase<DecideLoanDto, void> {
  private readonly repo: ILoanRepository;

  constructor(repo: ILoanRepository) {
    this.repo = repo;
  }

  async execute(input: DecideLoanDto): Promise<Result<void, DomainError>> {
    return this.repo.decide(input);
  }
}

// ── الأجور والتقييم والتوصيات ───────────────────────────────────────────
export class GetSalaryHistory implements UseCase<
  { workerId: string },
  readonly SalaryChangeDto[]
> {
  private readonly repo: IWorkerFileRepository;

  constructor(repo: IWorkerFileRepository) {
    this.repo = repo;
  }

  async execute(input: {
    workerId: string;
  }): Promise<Result<readonly SalaryChangeDto[], DomainError>> {
    return this.repo.salaryHistory(input.workerId);
  }
}

export class ChangeSalary implements UseCase<ChangeSalaryDto, void> {
  private readonly repo: IWorkerFileRepository;

  constructor(repo: IWorkerFileRepository) {
    this.repo = repo;
  }

  async execute(input: ChangeSalaryDto): Promise<Result<void, DomainError>> {
    if (input.newBase < 0 || input.newDaily < 0) {
      return err(new ValidationError("الأجر لا يكون سالبًا", { wage: "negative" }));
    }
    return this.repo.changeSalary(input);
  }
}

export class ListProductionRatings implements UseCase<
  { workerId: string | null; period: string | null },
  readonly ProductionRatingDto[]
> {
  private readonly repo: IWorkerFileRepository;

  constructor(repo: IWorkerFileRepository) {
    this.repo = repo;
  }

  async execute(input: {
    workerId: string | null;
    period: string | null;
  }): Promise<Result<readonly ProductionRatingDto[], DomainError>> {
    return this.repo.ratings(input.workerId, input.period);
  }
}

export class RateProduction implements UseCase<RateProductionDto, void> {
  private readonly repo: IWorkerFileRepository;

  constructor(repo: IWorkerFileRepository) {
    this.repo = repo;
  }

  async execute(input: RateProductionDto): Promise<Result<void, DomainError>> {
    if (!/^\d{4}-\d{2}$/.test(input.period)) {
      return err(new ValidationError("الفترة بصيغة YYYY-MM", { period: "invalid" }));
    }
    if (!Number.isFinite(input.income) || input.income < 0) {
      return err(new ValidationError("الدخل لا يكون سالبًا", { income: "invalid" }));
    }
    return this.repo.rateProduction(input);
  }
}

export class ListRecommendations implements UseCase<
  { workerId: string },
  readonly RecommendationDto[]
> {
  private readonly repo: IWorkerFileRepository;

  constructor(repo: IWorkerFileRepository) {
    this.repo = repo;
  }

  async execute(input: {
    workerId: string;
  }): Promise<Result<readonly RecommendationDto[], DomainError>> {
    return this.repo.recommendations(input.workerId);
  }
}

export class AddRecommendation implements UseCase<SaveRecommendationDto, void> {
  private readonly repo: IWorkerFileRepository;

  constructor(repo: IWorkerFileRepository) {
    this.repo = repo;
  }

  async execute(input: SaveRecommendationDto): Promise<Result<void, DomainError>> {
    if (input.note.trim() === "") {
      return err(new ValidationError("نص الملاحظة مطلوب", { note: "required" }));
    }
    return this.repo.addRecommendation(input);
  }
}

// ── ترحيل كشف البنك ─────────────────────────────────────────────────────
export class ImportBankStatement implements UseCase<
  ImportStatementDto,
  ImportStatementResultDto
> {
  private readonly importer: IPayrollImporter;

  constructor(importer: IPayrollImporter) {
    this.importer = importer;
  }

  async execute(
    input: ImportStatementDto,
  ): Promise<Result<ImportStatementResultDto, DomainError>> {
    if (input.rows.length === 0) {
      return err(new ValidationError("الكشف بلا سطور", { rows: "empty" }));
    }
    return this.importer.importStatement(input);
  }
}
