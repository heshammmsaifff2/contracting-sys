/**
 * التقارير الشاملة — قراءة من عروض Postgres لا أكثر.
 *
 * لا يُعاد حساب أي مجموع أو نسبة هنا: الأرقام كما خرجت من الخادم، فلا
 * يظهر رقمان لحقيقة واحدة. وحراسة الصلاحية داخل العروض نفسها
 * (`can_read_financial_reports` / `can_read_operational_reports`)، فمن لا
 * يملكها يستلم صفر صفوف من قاعدة البيانات لا من هذا الملف.
 */
import type { DomainError } from "@core/shared/errors/domain-error";
import { toDomainError } from "@core/shared/errors/domain-error";
import { err, ok, type Result } from "@core/shared/result";
import type {
  ArchivePendingRowDto,
  DepartmentFrequencyRowDto,
  DurationChangeRowDto,
  ManualEntryRowDto,
  OverdueTransactionRowDto,
  PartyBalanceRowDto,
  PartyType,
  ProjectCostRowDto,
  ReportFilter,
} from "@application/modules/reports/dtos";
import type { IReportRepository } from "@application/modules/reports/ports/report-repository";
import type { AppSupabaseClient } from "../client";
import { toDomainDbError } from "../errors";

function numberOrNull(value: number | string | null): number | null {
  if (value === null) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function isSet(value: string | null | undefined): value is string {
  return value != null && value !== "";
}

const PARTY_TYPES: readonly PartyType[] = [
  "supplier",
  "contractor",
  "worker",
  "employee",
];

function toPartyType(value: string | null): PartyType {
  const found = PARTY_TYPES.find((t) => t === value);
  return found ?? "employee";
}

export class SupabaseReportRepository implements IReportRepository {
  private readonly client: AppSupabaseClient;

  constructor(client: AppSupabaseClient) {
    this.client = client;
  }

  async projectCosts(
    filter: ReportFilter,
  ): Promise<Result<readonly ProjectCostRowDto[], DomainError>> {
    try {
      let query = this.client
        .from("project_cost_summary")
        .select("*")
        .order("committed_total", { ascending: false });

      if (isSet(filter.projectId)) query = query.eq("project_id", filter.projectId);

      const { data, error } = await query;
      if (error) return err(toDomainDbError(error, { entity: "تقرير تكلفة المشاريع" }));

      return ok(
        (data ?? []).map((row) => ({
          projectId: row.project_id ?? "",
          projectCode: row.project_code ?? "",
          projectName: row.project_name ?? "",
          projectStatus: row.project_status ?? "",
          contractValue: Number(row.contract_value ?? 0),
          supplyTotal: Number(row.supply_total ?? 0),
          custodyTotal: Number(row.custody_total ?? 0),
          extractTotal: Number(row.extract_total ?? 0),
          advanceTotal: Number(row.advance_total ?? 0),
          committedTotal: Number(row.committed_total ?? 0),
          paidTotal: Number(row.paid_total ?? 0),
          remainingBudget: Number(row.remaining_budget ?? 0),
          consumedRatio: numberOrNull(row.consumed_ratio),
        })),
      );
    } catch (e) {
      return err(toDomainError(e, "تعذّر قراءة تقرير تكلفة المشاريع"));
    }
  }

  async partyBalances(
    filter: ReportFilter & { partyType?: string | null },
  ): Promise<Result<readonly PartyBalanceRowDto[], DomainError>> {
    try {
      let query = this.client
        .from("party_balances")
        .select("*")
        .order("balance", { ascending: false });

      if (isSet(filter.partyType)) query = query.eq("party_type", filter.partyType);

      const { data, error } = await query;
      if (error) return err(toDomainDbError(error, { entity: "أرصدة الأطراف" }));

      return ok(
        (data ?? []).map((row) => ({
          partyType: toPartyType(row.party_type),
          partyId: row.party_id ?? "",
          partyCode: row.party_code ?? "",
          partyName: row.party_name ?? "",
          accountCode: row.account_code ?? "",
          accountName: row.account_name ?? "",
          accountType: row.account_type ?? "",
          linesCount: Number(row.lines_count ?? 0),
          debitTotal: Number(row.debit_total ?? 0),
          creditTotal: Number(row.credit_total ?? 0),
          balance: Number(row.balance ?? 0),
          lastEntryDate: row.last_entry_date,
        })),
      );
    } catch (e) {
      return err(toDomainError(e, "تعذّر قراءة أرصدة الأطراف"));
    }
  }

  async manualEntries(
    filter: ReportFilter,
  ): Promise<Result<readonly ManualEntryRowDto[], DomainError>> {
    try {
      let query = this.client
        .from("manual_entries_report")
        .select("*")
        .order("entry_date", { ascending: false });

      if (isSet(filter.projectId)) query = query.eq("project_id", filter.projectId);
      if (isSet(filter.from)) query = query.gte("entry_date", filter.from);
      if (isSet(filter.to)) query = query.lte("entry_date", filter.to);

      const { data, error } = await query;
      if (error) return err(toDomainDbError(error, { entity: "تقرير القيود اليدوية" }));

      return ok(
        (data ?? []).map((row) => ({
          entryId: row.entry_id ?? "",
          entryNo: Number(row.entry_no ?? 0),
          entryDate: row.entry_date ?? "",
          description: row.description ?? "",
          sourceType: row.source_type ?? "",
          projectId: row.project_id,
          projectName: row.project_name ?? "",
          postedBy: row.posted_by,
          postedByName: row.posted_by_name ?? "",
          totalDebit: Number(row.total_debit ?? 0),
          totalCredit: Number(row.total_credit ?? 0),
          movesReceivableToExpense: row.moves_receivable_to_expense === true,
          createdAt: row.created_at ?? "",
        })),
      );
    } catch (e) {
      return err(toDomainError(e, "تعذّر قراءة تقرير القيود اليدوية"));
    }
  }

  async archivePending(
    filter: ReportFilter,
  ): Promise<Result<readonly ArchivePendingRowDto[], DomainError>> {
    try {
      let query = this.client
        .from("archive_pending_report")
        .select("*")
        .order("days_pending", { ascending: false, nullsFirst: false });

      if (isSet(filter.projectId)) query = query.eq("project_id", filter.projectId);

      const { data, error } = await query;
      if (error) return err(toDomainDbError(error, { entity: "تقرير الأصول" }));

      return ok(
        (data ?? []).map((row) => ({
          transactionId: row.transaction_id ?? "",
          transactionNo: Number(row.transaction_no ?? 0),
          transactionType: row.transaction_type ?? "",
          subject: row.subject ?? "",
          transactionStatus: row.transaction_status ?? "",
          projectId: row.project_id,
          projectName: row.project_name ?? "",
          requestedByName: row.requested_by_name ?? "",
          received: row.received === true,
          hasOriginal: row.has_original === true,
          receivedAt: row.received_at,
          closedAt: row.closed_at,
          daysPending: numberOrNull(row.days_pending),
          notes: row.notes ?? "",
        })),
      );
    } catch (e) {
      return err(toDomainError(e, "تعذّر قراءة تقرير الأصول"));
    }
  }

  async durationChanges(
    filter: ReportFilter,
  ): Promise<Result<readonly DurationChangeRowDto[], DomainError>> {
    try {
      let query = this.client
        .from("duration_change_report")
        .select("*")
        .order("changed_at", { ascending: false });

      if (isSet(filter.projectId)) query = query.eq("project_id", filter.projectId);
      if (isSet(filter.from)) query = query.gte("changed_at", filter.from);
      if (isSet(filter.to)) query = query.lte("changed_at", `${filter.to}T23:59:59Z`);

      const { data, error } = await query;
      if (error) return err(toDomainDbError(error, { entity: "تقرير المدد المعدّلة" }));

      return ok(
        (data ?? []).map((row) => ({
          changeId: row.change_id ?? "",
          transactionId: row.transaction_id ?? "",
          transactionNo: Number(row.transaction_no ?? 0),
          transactionType: row.transaction_type ?? "",
          subject: row.subject ?? "",
          projectName: row.project_name ?? "",
          stepName: row.step_name ?? "",
          orderNo: Number(row.order_no ?? 0),
          assigneeName: row.assignee_name ?? "",
          oldMinutes: numberOrNull(row.old_minutes),
          newMinutes: Number(row.new_minutes ?? 0),
          deltaMinutes: Number(row.delta_minutes ?? 0),
          reason: row.reason ?? "",
          changedByName: row.changed_by_name ?? "",
          changedAt: row.changed_at ?? "",
          changedAfterCompletion: row.changed_after_completion === true,
        })),
      );
    } catch (e) {
      return err(toDomainError(e, "تعذّر قراءة تقرير المدد المعدّلة"));
    }
  }

  async overdueTransactions(
    filter: ReportFilter,
  ): Promise<Result<readonly OverdueTransactionRowDto[], DomainError>> {
    try {
      let query = this.client
        .from("overdue_transactions_report")
        .select("*")
        .order("elapsed_ratio", { ascending: false, nullsFirst: false });

      if (isSet(filter.projectId)) query = query.eq("project_id", filter.projectId);

      const { data, error } = await query;
      if (error)
        return err(toDomainDbError(error, { entity: "تقرير المعاملات المتأخّرة" }));

      return ok(
        (data ?? []).map((row) => ({
          stepInstanceId: row.step_instance_id ?? "",
          transactionId: row.transaction_id ?? "",
          transactionNo: Number(row.transaction_no ?? 0),
          transactionType: row.transaction_type ?? "",
          subject: row.subject ?? "",
          projectName: row.project_name ?? "",
          stepName: row.step_name ?? "",
          orderNo: Number(row.order_no ?? 0),
          assigneeId: row.assignee_id,
          assigneeName: row.assignee_name ?? "",
          allocatedMinutes: Number(row.allocated_minutes ?? 0),
          elapsedMinutes: Number(row.elapsed_minutes ?? 0),
          remainingMinutes: Number(row.remaining_minutes ?? 0),
          elapsedRatio: numberOrNull(row.elapsed_ratio),
          arrivedAt: row.arrived_at,
          dueAt: row.due_at,
          wasCompletedLate: row.was_completed_late === true,
        })),
      );
    } catch (e) {
      return err(toDomainError(e, "تعذّر قراءة تقرير المعاملات المتأخّرة"));
    }
  }

  async departmentFrequency(): Promise<
    Result<readonly DepartmentFrequencyRowDto[], DomainError>
  > {
    try {
      const { data, error } = await this.client
        .from("department_frequency_report")
        .select("*")
        .order("visits_per_transaction", { ascending: false, nullsFirst: false });

      if (error) return err(toDomainDbError(error, { entity: "تقرير تردّد الأقسام" }));

      return ok(
        (data ?? []).map((row) => ({
          departmentId: row.department_id ?? "",
          departmentName: row.department_name ?? "",
          transactionType: row.transaction_type ?? "",
          transactionsCount: Number(row.transactions_count ?? 0),
          visitsCount: Number(row.visits_count ?? 0),
          visitsPerTransaction: numberOrNull(row.visits_per_transaction),
          doneCount: Number(row.done_count ?? 0),
          avgScore: numberOrNull(row.avg_score),
        })),
      );
    } catch (e) {
      return err(toDomainError(e, "تعذّر قراءة تقرير تردّد الأقسام"));
    }
  }
}
