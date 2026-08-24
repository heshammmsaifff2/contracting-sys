/**
 * التقارير الشاملة العابرة للوحدات.
 *
 * كل تبويب هنا يجيب عن سؤال لا تجيب عنه شاشة وحدة واحدة: كم التزم كل مشروع
 * فعلًا؟ كم علينا لكل طرف بحسب دفتر الأستاذ لا بحسب مستنداته؟ أين يتعثّر العمل؟
 *
 * كل الأرقام محسوبة في Postgres، وهذه الشاشة تعرض فقط. حتى الصلاحية محروسة
 * في العروض نفسها: من لا يملكها يستلم قائمة فارغة من الخادم، والتبويب هنا
 * يُخفى تحسينًا للتجربة لا أمانًا.
 */
import { useMemo, useState } from "react";
import { AlertTriangle, Download } from "lucide-react";
import type {
  ArchivePendingRowDto,
  DepartmentFrequencyRowDto,
  DurationChangeRowDto,
  ManualEntryRowDto,
  OverdueTransactionRowDto,
  PartyBalanceRowDto,
  ProjectCostRowDto,
} from "@application/modules/reports/dtos";
import { Card } from "@presentation/shared/ui/Card";
import { Badge } from "@presentation/shared/ui/Badge";
import { Button } from "@presentation/shared/ui/Button";
import { Input } from "@presentation/shared/ui/Input";
import { Select } from "@presentation/shared/ui/Select";
import { DataTable, type Column } from "@presentation/shared/ui/DataTable";
import { cn } from "@presentation/shared/lib/cn";
import {
  formatDate,
  formatDateTime,
  formatDuration,
  formatMoney,
  formatNumber,
  formatPercent,
} from "@presentation/shared/lib/formatters";
import { errorMessage } from "@presentation/shared/lib/query";
import { downloadCsv } from "@presentation/shared/lib/csv";
import { useAuth } from "@presentation/app/providers/auth-context";
import { useAppSettings } from "@presentation/app/providers/settings-context";
import { useProjects } from "@presentation/features/projects/hooks/useProjects";
import {
  useArchivePendingReport,
  useDepartmentFrequencyReport,
  useDurationChangeReport,
  useManualEntriesReport,
  useOverdueTransactionsReport,
  usePartyBalances,
  useProjectCostReport,
} from "../hooks/useReports";
import { t } from "@i18n/index";

type Tab =
  "costs" | "parties" | "manual" | "overdue" | "archive" | "durations" | "departments";

interface TabDef {
  key: Tab;
  label: string;
  /** الصلاحية التي تحرسها العروض في الخادم — تُستعمل هنا للإخفاء فقط. */
  permission: "report.financial" | "report.read";
  /** هل يفيد هذا التقرير مرشّح التاريخ؟ */
  dated: boolean;
}

const TABS: readonly TabDef[] = [
  {
    key: "costs",
    label: t.reports.tabCosts,
    permission: "report.financial",
    dated: false,
  },
  {
    key: "parties",
    label: t.reports.tabParties,
    permission: "report.financial",
    dated: false,
  },
  {
    key: "manual",
    label: t.reports.tabManual,
    permission: "report.financial",
    dated: true,
  },
  {
    key: "overdue",
    label: t.reports.tabOverdue,
    permission: "report.read",
    dated: false,
  },
  {
    key: "archive",
    label: t.reports.tabArchive,
    permission: "report.read",
    dated: false,
  },
  {
    key: "durations",
    label: t.reports.tabDurations,
    permission: "report.read",
    dated: true,
  },
  {
    key: "departments",
    label: t.reports.tabDepartments,
    permission: "report.read",
    dated: false,
  },
];

const PARTY_LABELS: Record<string, string> = {
  supplier: t.reports.supplier,
  contractor: t.reports.contractor,
  worker: t.reports.worker,
  employee: t.reports.employee,
};

export function ReportsPage() {
  const { user } = useAuth();
  const { currency } = useAppSettings();
  const projects = useProjects();

  const allowedTabs = useMemo(
    () => TABS.filter((tab) => user?.can(tab.permission) ?? false),
    [user],
  );

  const [tab, setTab] = useState<Tab>(() => allowedTabs[0]?.key ?? "overdue");
  const [projectId, setProjectId] = useState("");
  const [partyType, setPartyType] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");

  const active = allowedTabs.find((x) => x.key === tab) ?? allowedTabs[0];
  const filter = {
    projectId: projectId === "" ? null : projectId,
    from: from === "" ? null : from,
    to: to === "" ? null : to,
  };

  // الاستعلام يعمل فقط للتبويب المعروض: التقارير التجميعية ثقيلة،
  // ولا معنى لجلب سبعة منها لعرض واحد.
  const costs = useProjectCostReport(filter, active?.key === "costs");
  const parties = usePartyBalances(
    { ...filter, partyType: partyType === "" ? null : partyType },
    active?.key === "parties",
  );
  const manual = useManualEntriesReport(filter, active?.key === "manual");
  const overdue = useOverdueTransactionsReport(filter, active?.key === "overdue");
  const archive = useArchivePendingReport(filter, active?.key === "archive");
  const durations = useDurationChangeReport(filter, active?.key === "durations");
  const departments = useDepartmentFrequencyReport(active?.key === "departments");

  if (allowedTabs.length === 0 || active === undefined) {
    return (
      <div className="space-y-6">
        <header>
          <h1 className="text-content text-xl font-bold">{t.reports.title}</h1>
        </header>
        <Card>
          <p className="text-content-muted p-6 text-center text-sm">
            {t.reports.noPermission}
          </p>
        </Card>
      </div>
    );
  }

  const projectOptions = [
    { value: "", label: t.reports.allProjects },
    ...(projects.data ?? []).map((p) => ({ value: p.id, label: p.name })),
  ];

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-content text-xl font-bold">{t.reports.title}</h1>
        <p className="text-content-muted mt-1 text-sm">{t.reports.subtitle}</p>
      </header>

      <nav className="flex flex-wrap gap-2" aria-label={t.reports.title}>
        {allowedTabs.map((item) => (
          <button
            key={item.key}
            type="button"
            onClick={() => setTab(item.key)}
            aria-current={item.key === tab ? "page" : undefined}
            className={cn(
              "rounded-[var(--radius-control)] px-3 py-1.5 text-sm transition-colors",
              item.key === tab
                ? "bg-brand-600 font-medium text-white"
                : "bg-surface-sunken text-content hover:bg-border",
            )}
          >
            {item.label}
          </button>
        ))}
      </nav>

      <Card>
        <div className="flex flex-wrap items-end gap-3 p-4">
          {active.key !== "departments" && (
            <label className="flex flex-col gap-1 text-sm">
              <span className="text-content-muted">{t.reports.project}</span>
              <Select
                value={projectId}
                onChange={(e) => setProjectId(e.target.value)}
                options={projectOptions}
              />
            </label>
          )}

          {active.key === "parties" && (
            <label className="flex flex-col gap-1 text-sm">
              <span className="text-content-muted">{t.reports.partyType}</span>
              <Select
                value={partyType}
                onChange={(e) => setPartyType(e.target.value)}
                options={[
                  { value: "", label: t.common.all },
                  { value: "supplier", label: t.reports.supplier },
                  { value: "contractor", label: t.reports.contractor },
                  { value: "worker", label: t.reports.worker },
                  { value: "employee", label: t.reports.employee },
                ]}
              />
            </label>
          )}

          {active.dated && (
            <>
              <label className="flex flex-col gap-1 text-sm">
                <span className="text-content-muted">{t.reports.from}</span>
                <Input
                  type="date"
                  value={from}
                  onChange={(e) => setFrom(e.target.value)}
                />
              </label>
              <label className="flex flex-col gap-1 text-sm">
                <span className="text-content-muted">{t.reports.to}</span>
                <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} />
              </label>
            </>
          )}
        </div>
      </Card>

      {active.key === "costs" && (
        <ReportBlock
          note={t.reports.laborNote}
          error={costs.error}
          rows={costs.data ?? []}
          isLoading={costs.isPending}
          filename="project-costs"
          columns={costColumns(currency)}
          rowKey={(row: ProjectCostRowDto) => row.projectId}
        />
      )}

      {active.key === "parties" && (
        <ReportBlock
          note={t.reports.balanceNote}
          error={parties.error}
          rows={parties.data ?? []}
          isLoading={parties.isPending}
          filename="party-balances"
          columns={partyColumns(currency)}
          rowKey={(row: PartyBalanceRowDto) =>
            `${row.partyType}:${row.partyId}:${row.accountCode}`
          }
        />
      )}

      {active.key === "manual" && (
        <ReportBlock
          note={t.reports.manualNote}
          error={manual.error}
          rows={manual.data ?? []}
          isLoading={manual.isPending}
          filename="manual-entries"
          columns={manualColumns(currency)}
          rowKey={(row: ManualEntryRowDto) => row.entryId}
        />
      )}

      {active.key === "overdue" && (
        <ReportBlock
          error={overdue.error}
          rows={overdue.data ?? []}
          isLoading={overdue.isPending}
          filename="overdue-transactions"
          columns={overdueColumns()}
          rowKey={(row: OverdueTransactionRowDto) => row.stepInstanceId}
        />
      )}

      {active.key === "archive" && (
        <ReportBlock
          error={archive.error}
          rows={archive.data ?? []}
          isLoading={archive.isPending}
          filename="archive-pending"
          columns={archiveColumns()}
          rowKey={(row: ArchivePendingRowDto) => row.transactionId}
        />
      )}

      {active.key === "durations" && (
        <ReportBlock
          error={durations.error}
          rows={durations.data ?? []}
          isLoading={durations.isPending}
          filename="duration-changes"
          columns={durationColumns()}
          rowKey={(row: DurationChangeRowDto) => row.changeId}
        />
      )}

      {active.key === "departments" && (
        <ReportBlock
          note={t.reports.churnNote}
          error={departments.error}
          rows={departments.data ?? []}
          isLoading={departments.isPending}
          filename="department-frequency"
          columns={departmentColumns()}
          rowKey={(row: DepartmentFrequencyRowDto) =>
            `${row.departmentId}:${row.transactionType}`
          }
        />
      )}
    </div>
  );
}

// ── غلاف موحّد: ملاحظة تفسيرية + خطأ + تصدير + جدول ────────────────────
interface ReportBlockProps<T> {
  rows: readonly T[];
  columns: readonly Column<T>[];
  rowKey: (row: T) => string;
  isLoading: boolean;
  error: unknown;
  filename: string;
  note?: string;
}

function ReportBlock<T>({
  rows,
  columns,
  rowKey,
  isLoading,
  error,
  filename,
  note,
}: ReportBlockProps<T>) {
  return (
    <Card
      actions={
        rows.length > 0 ? (
          <Button
            variant="secondary"
            onClick={() => downloadCsv(filename, columns, rows)}
          >
            <Download aria-hidden className="size-4" />
            {t.reports.export}
          </Button>
        ) : undefined
      }
    >
      {note !== undefined && (
        <p className="text-content-muted border-border border-b px-5 py-3 text-xs">
          {note}
        </p>
      )}

      {error != null && (
        <p className="text-danger px-5 py-3 text-sm">{errorMessage(error)}</p>
      )}

      <div className="p-2">
        <DataTable
          columns={columns}
          rows={rows}
          rowKey={rowKey}
          isLoading={isLoading}
          emptyTitle={t.reports.empty}
        />
      </div>
    </Card>
  );
}

// ── أعمدة كل تقرير ─────────────────────────────────────────────────────
function costColumns(currency: Parameters<typeof formatMoney>[1]) {
  const money = (v: number) => formatMoney(v, currency);

  return [
    { key: "project", header: t.reports.project, render: (r) => r.projectName },
    {
      key: "contract",
      header: t.reports.contractValue,
      numeric: true,
      render: (r) => money(r.contractValue),
    },
    {
      key: "supply",
      header: t.reports.supplyTotal,
      numeric: true,
      render: (r) => money(r.supplyTotal),
    },
    {
      key: "custody",
      header: t.reports.custodyTotal,
      numeric: true,
      render: (r) => money(r.custodyTotal),
    },
    {
      key: "extract",
      header: t.reports.extractTotal,
      numeric: true,
      render: (r) => money(r.extractTotal),
    },
    {
      key: "advance",
      header: t.reports.advanceTotal,
      numeric: true,
      render: (r) => money(r.advanceTotal),
    },
    {
      key: "committed",
      header: t.reports.committedTotal,
      numeric: true,
      render: (r) => <span className="font-medium">{money(r.committedTotal)}</span>,
    },
    {
      key: "paid",
      header: t.reports.paidTotal,
      numeric: true,
      render: (r) => money(r.paidTotal),
    },
    {
      key: "ratio",
      header: t.reports.consumedRatio,
      numeric: true,
      render: (r) =>
        r.consumedRatio === null ? (
          "—"
        ) : r.consumedRatio > 1 ? (
          <Badge tone="danger">
            <AlertTriangle aria-hidden className="size-3" />
            {formatPercent(r.consumedRatio)}
          </Badge>
        ) : (
          <Badge tone={r.consumedRatio >= 0.9 ? "warning" : "neutral"}>
            {formatPercent(r.consumedRatio)}
          </Badge>
        ),
    },
    {
      key: "remaining",
      header: t.reports.remainingBudget,
      numeric: true,
      render: (r) => (
        <span className={cn(r.remainingBudget < 0 && "text-danger font-medium")}>
          {money(r.remainingBudget)}
        </span>
      ),
    },
  ] satisfies readonly Column<ProjectCostRowDto>[];
}

function partyColumns(currency: Parameters<typeof formatMoney>[1]) {
  return [
    {
      key: "type",
      header: t.reports.partyType,
      render: (r) => <Badge>{PARTY_LABELS[r.partyType] ?? r.partyType}</Badge>,
    },
    { key: "code", header: t.reports.partyCode, render: (r) => r.partyCode },
    { key: "name", header: t.reports.partyName, render: (r) => r.partyName },
    {
      key: "account",
      header: t.reports.account,
      render: (r) => `${r.accountCode} — ${r.accountName}`,
    },
    {
      key: "debit",
      header: t.reports.debitTotal,
      numeric: true,
      render: (r) => formatMoney(r.debitTotal, currency),
    },
    {
      key: "credit",
      header: t.reports.creditTotal,
      numeric: true,
      render: (r) => formatMoney(r.creditTotal, currency),
    },
    {
      key: "balance",
      header: t.reports.balance,
      numeric: true,
      render: (r) => (
        <span className="font-medium">{formatMoney(r.balance, currency)}</span>
      ),
    },
    {
      key: "last",
      header: t.reports.lastEntry,
      render: (r) => (r.lastEntryDate === null ? "—" : formatDate(r.lastEntryDate)),
    },
  ] satisfies readonly Column<PartyBalanceRowDto>[];
}

function manualColumns(currency: Parameters<typeof formatMoney>[1]) {
  return [
    { key: "no", header: t.reports.entryNo, numeric: true, render: (r) => r.entryNo },
    {
      key: "date",
      header: t.reports.entryDate,
      render: (r) => formatDate(r.entryDate),
    },
    { key: "desc", header: t.reports.description, render: (r) => r.description },
    { key: "project", header: t.reports.project, render: (r) => r.projectName || "—" },
    { key: "by", header: t.reports.postedBy, render: (r) => r.postedByName || "—" },
    {
      key: "debit",
      header: t.reports.totalDebit,
      numeric: true,
      render: (r) => formatMoney(r.totalDebit, currency),
    },
    {
      key: "credit",
      header: t.reports.totalCredit,
      numeric: true,
      render: (r) => formatMoney(r.totalCredit, currency),
    },
    {
      key: "flag",
      header: t.reports.movedToExpense,
      render: (r) =>
        r.movesReceivableToExpense ? (
          <Badge tone="warning">
            <AlertTriangle aria-hidden className="size-3" />
            {t.common.yes}
          </Badge>
        ) : (
          <span className="text-content-muted">—</span>
        ),
    },
  ] satisfies readonly Column<ManualEntryRowDto>[];
}

function overdueColumns() {
  return [
    {
      key: "no",
      header: t.reports.transactionNo,
      numeric: true,
      render: (r) => r.transactionNo,
    },
    { key: "subject", header: t.reports.subject, render: (r) => r.subject },
    { key: "project", header: t.reports.project, render: (r) => r.projectName || "—" },
    { key: "step", header: t.reports.step, render: (r) => r.stepName },
    {
      key: "assignee",
      header: t.reports.assignee,
      render: (r) => r.assigneeName || "—",
    },
    {
      key: "allocated",
      header: t.reports.allocated,
      numeric: true,
      render: (r) => formatDuration(r.allocatedMinutes),
    },
    {
      key: "elapsed",
      header: t.reports.elapsed,
      numeric: true,
      render: (r) => formatDuration(r.elapsedMinutes),
    },
    {
      key: "over",
      header: t.reports.overBy,
      numeric: true,
      render: (r) => (
        <Badge tone="danger">{formatDuration(Math.abs(r.remainingMinutes))}</Badge>
      ),
    },
    {
      key: "state",
      header: t.common.status,
      render: (r) =>
        r.wasCompletedLate ? (
          <Badge tone="warning">{t.reports.completedLate}</Badge>
        ) : (
          <Badge tone="danger">{t.reports.stillOpen}</Badge>
        ),
    },
  ] satisfies readonly Column<OverdueTransactionRowDto>[];
}

function archiveColumns() {
  return [
    {
      key: "no",
      header: t.reports.transactionNo,
      numeric: true,
      render: (r) => r.transactionNo,
    },
    { key: "subject", header: t.reports.subject, render: (r) => r.subject },
    { key: "project", header: t.reports.project, render: (r) => r.projectName || "—" },
    {
      key: "requested",
      header: t.reports.requestedBy,
      render: (r) => r.requestedByName || "—",
    },
    {
      key: "closed",
      header: t.reports.closedAt,
      render: (r) => (r.closedAt === null ? "—" : formatDate(r.closedAt)),
    },
    {
      key: "days",
      header: t.reports.daysPending,
      numeric: true,
      render: (r) =>
        r.daysPending === null ? (
          "—"
        ) : (
          <Badge
            tone={
              r.daysPending > 30 ? "danger" : r.daysPending > 7 ? "warning" : "neutral"
            }
          >
            {formatNumber(r.daysPending)}
          </Badge>
        ),
    },
    {
      key: "received",
      header: t.reports.received,
      render: (r) => (r.received ? t.common.yes : t.common.no),
    },
    {
      key: "original",
      header: t.reports.hasOriginal,
      render: (r) => (r.hasOriginal ? t.common.yes : t.common.no),
    },
  ] satisfies readonly Column<ArchivePendingRowDto>[];
}

function durationColumns() {
  return [
    {
      key: "no",
      header: t.reports.transactionNo,
      numeric: true,
      render: (r) => r.transactionNo,
    },
    { key: "subject", header: t.reports.subject, render: (r) => r.subject },
    { key: "step", header: t.reports.step, render: (r) => r.stepName },
    {
      key: "assignee",
      header: t.reports.assignee,
      render: (r) => r.assigneeName || "—",
    },
    {
      key: "old",
      header: t.reports.oldMinutes,
      numeric: true,
      render: (r) => (r.oldMinutes === null ? "—" : formatDuration(r.oldMinutes)),
    },
    {
      key: "new",
      header: t.reports.newMinutes,
      numeric: true,
      render: (r) => formatDuration(r.newMinutes),
    },
    {
      key: "delta",
      header: t.reports.delta,
      numeric: true,
      render: (r) => (
        <span className={cn(r.deltaMinutes > 0 ? "text-warning" : "text-info")}>
          {r.deltaMinutes > 0 ? "+" : ""}
          {formatDuration(Math.abs(r.deltaMinutes))}
        </span>
      ),
    },
    { key: "reason", header: t.reports.reason, render: (r) => r.reason || "—" },
    {
      key: "by",
      header: t.reports.changedBy,
      render: (r) => r.changedByName || "—",
    },
    {
      key: "at",
      header: t.reports.changedAt,
      render: (r) => (
        <span className="flex items-center gap-2">
          {formatDateTime(r.changedAt)}
          {r.changedAfterCompletion && (
            <Badge tone="warning">{t.reports.afterCompletion}</Badge>
          )}
        </span>
      ),
    },
  ] satisfies readonly Column<DurationChangeRowDto>[];
}

function departmentColumns() {
  return [
    { key: "dept", header: t.reports.department, render: (r) => r.departmentName },
    {
      key: "type",
      header: t.reports.transactionType,
      render: (r) => r.transactionType,
    },
    {
      key: "count",
      header: t.reports.transactionsCount,
      numeric: true,
      render: (r) => formatNumber(r.transactionsCount),
    },
    {
      key: "visits",
      header: t.reports.visitsCount,
      numeric: true,
      render: (r) => formatNumber(r.visitsCount),
    },
    {
      key: "ratio",
      header: t.reports.visitsPerTransaction,
      numeric: true,
      render: (r) =>
        r.visitsPerTransaction === null ? (
          "—"
        ) : (
          <Badge tone={r.visitsPerTransaction > 1 ? "warning" : "neutral"}>
            {formatNumber(r.visitsPerTransaction)}×
          </Badge>
        ),
    },
    {
      key: "score",
      header: t.reports.avgScore,
      numeric: true,
      render: (r) => (r.avgScore === null ? "—" : formatNumber(r.avgScore)),
    },
  ] satisfies readonly Column<DepartmentFrequencyRowDto>[];
}
