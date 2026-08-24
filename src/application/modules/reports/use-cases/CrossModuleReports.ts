/**
 * التقارير الشاملة العابرة للوحدات.
 *
 * كلها قراءة محضة: الحساب تمّ في Postgres وحراسة الصلاحية داخل العروض،
 * فمهمّة الـ use-case هنا تمرير المرشّح والتحقّق من صحّته وحده.
 * السبب أن أي إعادة حساب في هذه الطبقة كانت ستُنتج رقمًا ثانيًا للحقيقة
 * الواحدة — وهذا بالضبط ما تمنعه القاعدة الذهبية.
 */
import type { DomainError } from "@core/shared/errors/domain-error";
import { ValidationError } from "@core/shared/errors/domain-error";
import { err, type Result } from "@core/shared/result";
import type { UseCase } from "@application/shared/use-case";
import type {
  ArchivePendingRowDto,
  DepartmentFrequencyRowDto,
  DurationChangeRowDto,
  ManualEntryRowDto,
  OverdueTransactionRowDto,
  PartyBalanceRowDto,
  ProjectCostRowDto,
  ReportFilter,
} from "../dtos";
import type { IReportRepository } from "../ports/report-repository";

/** مدى تاريخي مقلوب يعني خطأ إدخال لا نتيجة فارغة — نردّه صراحةً. */
function validateRange(filter: ReportFilter): DomainError | null {
  const from = filter.from ?? "";
  const to = filter.to ?? "";
  if (from !== "" && to !== "" && from > to) {
    return new ValidationError("تاريخ البداية بعد تاريخ النهاية");
  }
  return null;
}

export class GetProjectCostReport implements UseCase<
  ReportFilter,
  readonly ProjectCostRowDto[]
> {
  private readonly repo: IReportRepository;

  constructor(repo: IReportRepository) {
    this.repo = repo;
  }

  async execute(
    input: ReportFilter,
  ): Promise<Result<readonly ProjectCostRowDto[], DomainError>> {
    return this.repo.projectCosts(input);
  }
}

export class GetPartyBalances implements UseCase<
  ReportFilter & { partyType?: string | null },
  readonly PartyBalanceRowDto[]
> {
  private readonly repo: IReportRepository;

  constructor(repo: IReportRepository) {
    this.repo = repo;
  }

  async execute(
    input: ReportFilter & { partyType?: string | null },
  ): Promise<Result<readonly PartyBalanceRowDto[], DomainError>> {
    return this.repo.partyBalances(input);
  }
}

export class GetManualEntriesReport implements UseCase<
  ReportFilter,
  readonly ManualEntryRowDto[]
> {
  private readonly repo: IReportRepository;

  constructor(repo: IReportRepository) {
    this.repo = repo;
  }

  async execute(
    input: ReportFilter,
  ): Promise<Result<readonly ManualEntryRowDto[], DomainError>> {
    const invalid = validateRange(input);
    if (invalid) return err(invalid);
    return this.repo.manualEntries(input);
  }
}

export class GetArchivePendingReport implements UseCase<
  ReportFilter,
  readonly ArchivePendingRowDto[]
> {
  private readonly repo: IReportRepository;

  constructor(repo: IReportRepository) {
    this.repo = repo;
  }

  async execute(
    input: ReportFilter,
  ): Promise<Result<readonly ArchivePendingRowDto[], DomainError>> {
    return this.repo.archivePending(input);
  }
}

export class GetDurationChangeReport implements UseCase<
  ReportFilter,
  readonly DurationChangeRowDto[]
> {
  private readonly repo: IReportRepository;

  constructor(repo: IReportRepository) {
    this.repo = repo;
  }

  async execute(
    input: ReportFilter,
  ): Promise<Result<readonly DurationChangeRowDto[], DomainError>> {
    const invalid = validateRange(input);
    if (invalid) return err(invalid);
    return this.repo.durationChanges(input);
  }
}

export class GetOverdueTransactionsReport implements UseCase<
  ReportFilter,
  readonly OverdueTransactionRowDto[]
> {
  private readonly repo: IReportRepository;

  constructor(repo: IReportRepository) {
    this.repo = repo;
  }

  async execute(
    input: ReportFilter,
  ): Promise<Result<readonly OverdueTransactionRowDto[], DomainError>> {
    return this.repo.overdueTransactions(input);
  }
}

export class GetDepartmentFrequencyReport implements UseCase<
  void,
  readonly DepartmentFrequencyRowDto[]
> {
  private readonly repo: IReportRepository;

  constructor(repo: IReportRepository) {
    this.repo = repo;
  }

  async execute(): Promise<Result<readonly DepartmentFrequencyRowDto[], DomainError>> {
    return this.repo.departmentFrequency();
  }
}
