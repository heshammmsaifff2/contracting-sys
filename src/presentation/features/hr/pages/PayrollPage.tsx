/**
 * ترحيل كشف البنك + تقرير «كم يومية كلّفني المشروع».
 * الترحيل يمرّ بـ Edge Function لأن تسجيل القيد مقصور على service_role،
 * والتقرير عرضان: الأيام يراها الجميع، والتكلفة بالمال لمن يرى الأجور.
 */
import { useMemo, useState } from "react";
import { Banknote, FileUp, Play } from "lucide-react";
import type {
  BankStatementRowDto,
  LaborDaysRowDto,
} from "@application/modules/hr/dtos";
import { Card } from "@presentation/shared/ui/Card";
import { Badge } from "@presentation/shared/ui/Badge";
import { Button } from "@presentation/shared/ui/Button";
import { Select } from "@presentation/shared/ui/Select";
import { Checkbox } from "@presentation/shared/ui/Checkbox";
import { DataTable, type Column } from "@presentation/shared/ui/DataTable";
import { EmptyState } from "@presentation/shared/ui/EmptyState";
import { PermissionGate } from "@presentation/shared/ui/PermissionGate";
import { formatMoney, formatNumber } from "@presentation/shared/lib/formatters";
import { errorMessage } from "@presentation/shared/lib/query";
import { useAppSettings } from "@presentation/app/providers/settings-context";
import { useProjects } from "@presentation/features/projects/hooks/useProjects";
import { useImportStatement, useLaborCost, useLaborDays } from "../hooks/useHr";
import { t } from "@i18n/index";

/** سطر لكل تحويل: رقم طلب الدفع، القيمة، التاريخ (اختياري). */
function parseStatement(text: string): {
  rows: BankStatementRowDto[];
  invalid: number;
} {
  const rows: BankStatementRowDto[] = [];
  let invalid = 0;

  for (const line of text.split("\n")) {
    const trimmed = line.trim();
    if (trimmed === "") continue;

    const parts = trimmed.split(/[,\t;]/).map((part) => part.trim());
    const reference = Number(parts[0]);
    const amount = Number((parts[1] ?? "").replace(/,/g, ""));
    const date = parts[2] ?? "";

    if (!Number.isFinite(reference) || !Number.isFinite(amount) || amount <= 0) {
      invalid += 1;
      continue;
    }

    rows.push({
      reference,
      amount,
      transferredAt: date === "" ? null : date,
    });
  }

  return { rows, invalid };
}

export function PayrollPage() {
  const projects = useProjects();
  const { currency } = useAppSettings();
  const [projectId, setProjectId] = useState("");

  const laborDays = useLaborDays(projectId === "" ? null : projectId);
  const laborCost = useLaborCost(projectId === "" ? null : projectId, null);
  const importStatement = useImportStatement();

  const [text, setText] = useState("");
  const [dryRun, setDryRun] = useState(true);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const parsed = useMemo(() => parseStatement(text), [text]);

  async function handleImport() {
    setError(null);
    setMessage(null);
    try {
      const result = await importStatement.mutateAsync({
        rows: parsed.rows,
        dryRun,
      });
      setMessage(
        `${t.payroll.done}: ${t.payroll.matched} ${formatNumber(result.matched)} · ` +
          `${t.payroll.transferred} ${formatNumber(result.transferred)} · ` +
          `${t.payroll.posted} ${formatNumber(result.posted)}`,
      );
    } catch (e) {
      setError(errorMessage(e));
    }
  }

  const daysColumns: readonly Column<LaborDaysRowDto>[] = [
    {
      key: "project",
      header: t.attendance.project,
      render: (row) => (
        <span>
          <span className="text-content block text-sm font-medium">
            {row.projectName}
          </span>
          <span className="text-content-muted font-mono text-xs">{row.period}</span>
        </span>
      ),
    },
    {
      key: "present",
      header: t.attendance.presentDays,
      numeric: true,
      render: (row) => <span className="tabular">{formatNumber(row.presentDays)}</span>,
    },
    {
      key: "sick",
      header: t.attendance.sickDays,
      numeric: true,
      render: (row) => <span className="tabular">{formatNumber(row.sickDays)}</span>,
    },
    {
      key: "excused",
      header: t.attendance.excusedDays,
      numeric: true,
      render: (row) => <span className="tabular">{formatNumber(row.excusedDays)}</span>,
    },
    {
      key: "absent",
      header: t.attendance.absentDays,
      numeric: true,
      render: (row) => <span className="tabular">{formatNumber(row.absentDays)}</span>,
    },
    {
      key: "workers",
      header: t.attendance.workersCount,
      numeric: true,
      render: (row) => (
        <span className="tabular">{formatNumber(row.workersCount)}</span>
      ),
    },
    {
      key: "payable",
      header: t.attendance.payableDays,
      numeric: true,
      render: (row) => (
        <Badge tone={row.payableDays >= 0 ? "success" : "danger"}>
          {formatNumber(row.payableDays)}
        </Badge>
      ),
    },
  ];

  const costRows = laborCost.data ?? [];
  const costTotal = costRows.reduce((sum, row) => sum + row.cost, 0);

  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-6">
      <header>
        <h1 className="text-content text-xl font-extrabold">{t.payroll.title}</h1>
        <p className="text-content-muted mt-1 text-sm">{t.payroll.subtitle}</p>
      </header>

      <Card title={t.attendance.reportTitle}>
        <div className="mb-4 max-w-sm">
          <Select
            options={[
              { value: "", label: t.facilities.allProjects },
              ...(projects.data ?? []).map((project) => ({
                value: project.id,
                label: `${project.code} — ${project.name}`,
              })),
            ]}
            value={projectId}
            onChange={(e) => setProjectId(e.target.value)}
            aria-label={t.attendance.project}
          />
        </div>

        <DataTable
          columns={daysColumns}
          rows={laborDays.data ?? []}
          rowKey={(row) => `${row.projectId}:${row.period}`}
          isLoading={laborDays.isLoading}
          emptyTitle={t.attendance.noReport}
        />

        {costRows.length > 0 ? (
          <p className="text-content mt-3 text-sm font-medium">
            {t.attendance.cost}: {formatMoney(costTotal, currency)}
          </p>
        ) : (
          <p className="text-content-muted mt-3 text-xs">{t.attendance.costHidden}</p>
        )}
      </Card>

      <PermissionGate permission="payroll.import">
        <Card
          title={
            <span className="flex items-center gap-2">
              <Banknote aria-hidden className="size-4" />
              {t.payroll.title}
            </span>
          }
          description={t.payroll.pasteHint}
        >
          <textarea
            rows={8}
            dir="ltr"
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder={t.payroll.example}
            aria-label={t.payroll.paste}
            className="border-border-strong bg-surface text-content w-full rounded-[var(--radius-control)] border px-3 py-2 font-mono text-sm"
          />

          <div className="mt-3 flex flex-wrap items-center gap-4">
            <span className="text-content-muted text-sm">
              {t.payroll.parsed}: {formatNumber(parsed.rows.length)}
              {parsed.invalid > 0 && (
                <span className="text-danger ms-2">
                  {t.payroll.invalidLine}: {formatNumber(parsed.invalid)}
                </span>
              )}
            </span>

            <Checkbox
              label={t.payroll.dryRun}
              checked={dryRun}
              onChange={(e) => setDryRun(e.target.checked)}
            />

            <Button
              onClick={() => void handleImport()}
              isLoading={importStatement.isPending}
              disabled={parsed.rows.length === 0}
              startIcon={
                dryRun ? (
                  <Play aria-hidden className="size-4" />
                ) : (
                  <FileUp aria-hidden className="size-4" />
                )
              }
            >
              {dryRun ? t.payroll.dryRun : t.payroll.run}
            </Button>
          </div>

          {message !== null && (
            <p role="status" className="text-success mt-3 text-sm">
              {message}
            </p>
          )}
          {error !== null && (
            <p role="alert" className="text-danger mt-3 text-sm">
              {error}
            </p>
          )}

          {(importStatement.data?.skipped ?? []).length > 0 && (
            <ul className="divide-border mt-3 divide-y text-xs">
              {(importStatement.data?.skipped ?? []).map((row) => (
                <li key={row.reference} className="flex justify-between py-1.5">
                  <span className="font-mono">{row.reference}</span>
                  <span className="text-content-muted">{row.reason}</span>
                </li>
              ))}
            </ul>
          )}

          {parsed.rows.length === 0 && text === "" && (
            <div className="mt-3">
              <EmptyState title={t.payroll.empty} description={t.payroll.example} />
            </div>
          )}
        </Card>
      </PermissionGate>
    </div>
  );
}
