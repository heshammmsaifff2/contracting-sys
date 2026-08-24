import type { DomainError } from "@core/shared/errors/domain-error";
import type { Result } from "@core/shared/result";
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

/**
 * منفذ التقارير الشاملة — قراءة فقط.
 *
 * لا توجد دالة كتابة هنا عمدًا: التقرير ناتج لا مستند. وكل الحساب في
 * Postgres، فلا يملك هذا المنفذ سوى تمرير المرشّحات وإعادة الصفوف.
 * حراسة الصلاحية في العروض نفسها (`can_read_*_reports`)، فالمنفذ لا
 * يفحص شيئًا: من لا يملك الصلاحية يستلم قائمة فارغة من الخادم.
 */
export interface IReportRepository {
  projectCosts(
    filter: ReportFilter,
  ): Promise<Result<readonly ProjectCostRowDto[], DomainError>>;

  partyBalances(
    filter: ReportFilter & { partyType?: string | null },
  ): Promise<Result<readonly PartyBalanceRowDto[], DomainError>>;

  manualEntries(
    filter: ReportFilter,
  ): Promise<Result<readonly ManualEntryRowDto[], DomainError>>;

  archivePending(
    filter: ReportFilter,
  ): Promise<Result<readonly ArchivePendingRowDto[], DomainError>>;

  durationChanges(
    filter: ReportFilter,
  ): Promise<Result<readonly DurationChangeRowDto[], DomainError>>;

  overdueTransactions(
    filter: ReportFilter,
  ): Promise<Result<readonly OverdueTransactionRowDto[], DomainError>>;

  departmentFrequency(): Promise<
    Result<readonly DepartmentFrequencyRowDto[], DomainError>
  >;
}
