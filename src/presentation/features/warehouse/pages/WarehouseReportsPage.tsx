/**
 * تقارير المخازن.
 * جوهرها فكرة واحدة: الكمية وحدها لا تدلّ على شيء — المقارنة العادلة
 * هي الاستهلاك لكل وحدة وزن، وما تجاوز عتبة المشروع فهو هدر [المخازن 9].
 * كل الأرقام محسوبة في Postgres؛ هذه الشاشة تعرض فقط.
 */
import { useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { AlertTriangle } from "lucide-react";
import type {
  ProjectConsumptionRowDto,
  SupervisorConsumptionRowDto,
  WasteReportRowDto,
} from "@application/modules/warehouse/dtos";
import { Card } from "@presentation/shared/ui/Card";
import { Badge } from "@presentation/shared/ui/Badge";
import { Button } from "@presentation/shared/ui/Button";
import { Select } from "@presentation/shared/ui/Select";
import { DataTable, type Column } from "@presentation/shared/ui/DataTable";
import { EmptyState } from "@presentation/shared/ui/EmptyState";
import { cn } from "@presentation/shared/lib/cn";
import { formatDate, formatNumber } from "@presentation/shared/lib/formatters";
import { errorMessage } from "@presentation/shared/lib/query";
import { useProjects } from "@presentation/features/projects/hooks/useProjects";
import {
  useConsumptionTrend,
  useProjectConsumption,
  useSupervisorConsumption,
  useWasteReport,
} from "../hooks/useWarehouse";
import { t } from "@i18n/index";

type Tab = "waste" | "projects" | "supervisors" | "trend";

const TABS: readonly { key: Tab; label: string }[] = [
  { key: "waste", label: t.warehouseReports.tabWaste },
  { key: "projects", label: t.warehouseReports.tabProjects },
  { key: "supervisors", label: t.warehouseReports.tabSupervisors },
  { key: "trend", label: t.warehouseReports.tabTrend },
];

const MONTH_OPTIONS = [
  { value: "3", label: t.warehouseReports.months3 },
  { value: "6", label: t.warehouseReports.months6 },
  { value: "12", label: t.warehouseReports.months12 },
];

function ratioLabel(ratio: number | null): string {
  return ratio === null ? "—" : `${formatNumber(Math.round(ratio * 100) / 100)}×`;
}

export function WarehouseReportsPage() {
  const projects = useProjects();
  const [tab, setTab] = useState<Tab>("waste");
  const [projectId, setProjectId] = useState("");
  const [months, setMonths] = useState("6");

  const filter = { projectId: projectId === "" ? null : projectId, itemId: null };

  const waste = useWasteReport(filter);
  const byProject = useProjectConsumption(filter);
  const bySupervisor = useSupervisorConsumption(filter);
  const trend = useConsumptionTrend({
    months: Number(months),
    projectId: filter.projectId,
    itemId: null,
  });

  const wasteColumns: readonly Column<WasteReportRowDto>[] = [
    {
      key: "facility",
      header: t.warehouseReports.facility,
      render: (row) => (
        <span>
          <span className="text-content block text-sm font-medium">
            {row.facilityName}
          </span>
          <span className="text-content-muted block text-xs">
            {[row.groupName, row.district].filter((p) => p !== "").join(" ← ")}
          </span>
        </span>
      ),
    },
    {
      key: "item",
      header: t.warehouseReports.item,
      render: (row) => (
        <span className="text-sm">
          {row.itemName}
          <span className="text-content-muted ms-2 font-mono text-xs">
            {row.itemCode}
          </span>
        </span>
      ),
    },
    {
      key: "weight",
      header: t.warehouseReports.weight,
      numeric: true,
      render: (row) => <span className="tabular">{formatNumber(row.weight)}</span>,
    },
    {
      key: "qty",
      header: t.warehouseReports.qty,
      numeric: true,
      render: (row) => (
        <span className="tabular">
          {formatNumber(row.qty)} {row.itemUnit}
        </span>
      ),
    },
    {
      key: "perWeight",
      header: t.warehouseReports.perWeight,
      numeric: true,
      render: (row) => (
        <span className="tabular">{formatNumber(row.qtyPerWeight)}</span>
      ),
    },
    {
      key: "average",
      header: t.warehouseReports.average,
      numeric: true,
      render: (row) => (
        <span className="tabular text-content-muted">
          {formatNumber(row.avgQtyPerWeight)}
        </span>
      ),
    },
    {
      key: "ratio",
      header: t.warehouseReports.ratio,
      numeric: true,
      render: (row) => (
        <Badge tone={row.isWasteful ? "danger" : "success"}>
          {row.isWasteful && <AlertTriangle aria-hidden className="size-3" />}
          {ratioLabel(row.deviationRatio)}
        </Badge>
      ),
    },
  ];

  const projectColumns: readonly Column<ProjectConsumptionRowDto>[] = [
    {
      key: "project",
      header: t.warehouseReports.project,
      render: (row) => <span className="text-sm font-medium">{row.projectName}</span>,
    },
    {
      key: "item",
      header: t.warehouseReports.item,
      render: (row) => (
        <span className="text-sm">
          {row.itemName}
          <span className="text-content-muted ms-2 font-mono text-xs">
            {row.itemCode}
          </span>
        </span>
      ),
    },
    {
      key: "qty",
      header: t.warehouseReports.qty,
      numeric: true,
      render: (row) => (
        <span className="tabular">
          {formatNumber(row.qty)} {row.itemUnit}
        </span>
      ),
    },
    {
      key: "facilities",
      header: t.warehouseReports.facilities,
      numeric: true,
      render: (row) => (
        <span className="tabular">{formatNumber(row.facilitiesCount)}</span>
      ),
    },
    {
      key: "perWeight",
      header: t.warehouseReports.perWeight,
      numeric: true,
      render: (row) => (
        <span className="tabular">
          {row.qtyPerWeight === null ? "—" : formatNumber(row.qtyPerWeight)}
        </span>
      ),
    },
    {
      key: "last",
      header: t.warehouseReports.lastConsumed,
      render: (row) => (
        <span className="text-content-muted text-xs">
          {row.lastConsumedAt === null ? "—" : formatDate(row.lastConsumedAt)}
        </span>
      ),
    },
  ];

  const supervisorColumns: readonly Column<SupervisorConsumptionRowDto>[] = [
    {
      key: "supervisor",
      header: t.warehouseReports.supervisor,
      render: (row) => (
        <span className="text-sm font-medium">{row.supervisorName}</span>
      ),
    },
    {
      key: "project",
      header: t.warehouseReports.project,
      render: (row) => <span className="text-sm">{row.projectName}</span>,
    },
    {
      key: "downloads",
      header: t.warehouseReports.downloads,
      numeric: true,
      render: (row) => (
        <span className="tabular">{formatNumber(row.downloadsCount)}</span>
      ),
    },
    {
      key: "facilities",
      header: t.warehouseReports.facilities,
      numeric: true,
      render: (row) => (
        <span className="tabular">{formatNumber(row.facilitiesCount)}</span>
      ),
    },
    {
      key: "qty",
      header: t.warehouseReports.qty,
      numeric: true,
      render: (row) => <span className="tabular">{formatNumber(row.totalQty)}</span>,
    },
    {
      key: "photos",
      header: t.warehouseReports.withPhotos,
      numeric: true,
      render: (row) => (
        <span className="tabular">
          {formatNumber(row.withPhotos)} {t.common.of}{" "}
          {formatNumber(row.downloadsCount)}
        </span>
      ),
    },
  ];

  const projectOptions = [
    { value: "", label: t.warehouseReports.allProjects },
    ...(projects.data ?? []).map((project) => ({
      value: project.id,
      label: `${project.code} — ${project.name}`,
    })),
  ];

  const wasteRows = waste.data ?? [];
  const chartData = (byProject.data ?? []).slice(0, 8).map((row) => ({
    name: `${row.projectName} · ${row.itemName}`,
    qty: row.qty,
    perWeight: row.qtyPerWeight ?? 0,
  }));

  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-6">
      <header>
        <h1 className="text-content text-xl font-extrabold">
          {t.warehouseReports.title}
        </h1>
        <p className="text-content-muted mt-1 text-sm">{t.warehouseReports.subtitle}</p>
      </header>

      <Card>
        <div className="flex flex-wrap items-center gap-3">
          <div className="min-w-56 flex-1">
            <Select
              options={projectOptions}
              value={projectId}
              onChange={(e) => setProjectId(e.target.value)}
              aria-label={t.warehouseReports.project}
            />
          </div>
          {tab === "trend" && (
            <div className="w-40">
              <Select
                options={MONTH_OPTIONS}
                value={months}
                onChange={(e) => setMonths(e.target.value)}
                aria-label={t.warehouseReports.period}
              />
            </div>
          )}
        </div>

        <nav
          className="mt-4 flex flex-wrap gap-1"
          aria-label={t.warehouseReports.title}
        >
          {TABS.map((item) => (
            <Button
              key={item.key}
              variant={tab === item.key ? "primary" : "ghost"}
              size="sm"
              onClick={() => setTab(item.key)}
            >
              {item.label}
            </Button>
          ))}
        </nav>
      </Card>

      {tab === "waste" && (
        <Card
          title={t.warehouseReports.tabWaste}
          description={t.warehouseReports.thresholdHint}
        >
          {waste.isError ? (
            <EmptyState
              title={t.common.error}
              description={errorMessage(waste.error)}
            />
          ) : (
            <>
              <DataTable
                columns={wasteColumns}
                rows={wasteRows}
                rowKey={(row) => `${row.facilityId}:${row.itemId}`}
                isLoading={waste.isLoading}
                emptyTitle={t.warehouseReports.empty}
                emptyDescription={t.warehouseReports.emptyHint}
              />
              {wasteRows.some((row) => row.isWasteful) && (
                <p
                  className={cn(
                    "text-danger mt-3 flex items-center gap-2 text-sm font-medium",
                  )}
                >
                  <AlertTriangle aria-hidden className="size-4" />
                  {t.warehouseReports.wasteful}:{" "}
                  {formatNumber(wasteRows.filter((row) => row.isWasteful).length)}
                </p>
              )}
            </>
          )}
        </Card>
      )}

      {tab === "projects" && (
        <>
          <Card title={t.warehouseReports.tabProjects}>
            <DataTable
              columns={projectColumns}
              rows={byProject.data ?? []}
              rowKey={(row) => `${row.projectId}:${row.itemId}`}
              isLoading={byProject.isLoading}
              emptyTitle={t.warehouseReports.empty}
              emptyDescription={t.warehouseReports.emptyHint}
            />
          </Card>

          {chartData.length > 0 && (
            <Card title={t.warehouseReports.perWeight}>
              <div className="h-72 w-full" dir="ltr">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={chartData}>
                    <CartesianGrid stroke="var(--color-border)" strokeDasharray="3 3" />
                    <XAxis dataKey="name" tick={{ fontSize: 10 }} hide />
                    <YAxis tick={{ fontSize: 10 }} />
                    <Tooltip />
                    <Legend />
                    <Bar
                      dataKey="qty"
                      name={t.warehouseReports.qty}
                      fill="var(--color-brand-500)"
                    />
                    <Bar
                      dataKey="perWeight"
                      name={t.warehouseReports.perWeight}
                      fill="var(--color-info)"
                    />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </Card>
          )}
        </>
      )}

      {tab === "supervisors" && (
        <Card title={t.warehouseReports.tabSupervisors}>
          <DataTable
            columns={supervisorColumns}
            rows={bySupervisor.data ?? []}
            rowKey={(row) => `${row.supervisorId ?? "none"}:${row.projectId}`}
            isLoading={bySupervisor.isLoading}
            emptyTitle={t.warehouseReports.empty}
            emptyDescription={t.warehouseReports.emptyHint}
          />
        </Card>
      )}

      {tab === "trend" && (
        <Card title={t.warehouseReports.tabTrend}>
          {(trend.data ?? []).length === 0 ? (
            <EmptyState
              title={t.warehouseReports.empty}
              description={t.warehouseReports.emptyHint}
            />
          ) : (
            <div className="h-72 w-full" dir="ltr">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={[...(trend.data ?? [])]}>
                  <CartesianGrid stroke="var(--color-border)" strokeDasharray="3 3" />
                  <XAxis dataKey="period" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} />
                  <Tooltip />
                  <Legend />
                  <Line
                    type="monotone"
                    dataKey="qty"
                    name={t.warehouseReports.qty}
                    stroke="var(--color-brand-600)"
                    strokeWidth={2}
                  />
                  <Line
                    type="monotone"
                    dataKey="cumulativeQty"
                    name={t.warehouseReports.cumulative}
                    stroke="var(--color-success)"
                    strokeWidth={2}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          )}
        </Card>
      )}
    </div>
  );
}
