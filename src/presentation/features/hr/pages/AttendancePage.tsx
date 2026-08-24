/**
 * اليوميات.
 * الشاشة تبدأ من كشف الأمس مؤشَّرًا [شؤون الموظفين 2]: المستخدم يزيل الغائب
 * أو يغيّر حالته فقط. القواعد المُلزِمة في قاعدة البيانات: لا ازدواج بين
 * المشاريع [16]، ولا تسجيل بعد الموعد بلا صلاحية [17].
 */
import { useState } from "react";
import { CalendarCheck, Clock, Plus, Trash2, Users } from "lucide-react";
import type {
  AttendanceEntryDto,
  AttendanceSuggestionDto,
} from "@application/modules/hr/dtos";
import type { AttendanceStatus } from "@core/modules/hr/entities/Attendance";
import { isPastCutoff, payableDays } from "@core/modules/hr/entities/Attendance";
import { Card } from "@presentation/shared/ui/Card";
import { Badge, type BadgeTone } from "@presentation/shared/ui/Badge";
import { Button } from "@presentation/shared/ui/Button";
import { Input } from "@presentation/shared/ui/Input";
import { Select } from "@presentation/shared/ui/Select";
import { Checkbox } from "@presentation/shared/ui/Checkbox";
import { FormField } from "@presentation/shared/ui/FormField";
import { EmptyState } from "@presentation/shared/ui/EmptyState";
import { PermissionGate } from "@presentation/shared/ui/PermissionGate";
import { useDebounce } from "@presentation/shared/hooks/useDebounce";
import { formatDate, formatNumber } from "@presentation/shared/lib/formatters";
import { errorMessage } from "@presentation/shared/lib/query";
import { useProjects } from "@presentation/features/projects/hooks/useProjects";
import {
  useAttendance,
  useAttendanceSettings,
  useAttendanceSuggestions,
  useRegisterAttendance,
  useWorkerSearch,
} from "../hooks/useHr";
import { t } from "@i18n/index";

const STATUS_LABELS: Record<AttendanceStatus, string> = {
  present: t.attendance.present,
  excused: t.attendance.excused,
  absent: t.attendance.absent,
  sick: t.attendance.sick,
};

const STATUS_TONES: Record<AttendanceStatus, BadgeTone> = {
  present: "success",
  excused: "warning",
  absent: "danger",
  sick: "info",
};

const STATUS_OPTIONS = (Object.keys(STATUS_LABELS) as AttendanceStatus[]).map(
  (status) => ({ value: status, label: STATUS_LABELS[status] }),
);

interface SheetLine extends AttendanceEntryDto {
  fullName: string;
  cardNo: string | null;
}

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

export function AttendancePage() {
  const projects = useProjects();
  const settings = useAttendanceSettings();
  const register = useRegisterAttendance();

  const [projectId, setProjectId] = useState("");
  const [workDate, setWorkDate] = useState(today());
  const [sheet, setSheet] = useState<SheetLine[]>([]);
  const [workerQuery, setWorkerQuery] = useState("");
  const [pickedWorkerId, setPickedWorkerId] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const suggestions = useAttendanceSuggestions(projectId, workDate);
  const workers = useWorkerSearch(useDebounce(workerQuery, 250));
  const registered = useAttendance({ projectId, workDate, workerId: null });

  /** كشف مشروع لا يُحمل على غيره: تبديل المشروع أو اليوم يُفرغ الكشف. */
  function switchContext(next: { projectId?: string; workDate?: string }) {
    if (next.projectId !== undefined) setProjectId(next.projectId);
    if (next.workDate !== undefined) setWorkDate(next.workDate);
    setSheet([]);
    setMessage(null);
  }

  const cutoff = settings.data?.cutoffTime ?? "12:00";
  const dayValues = settings.data?.dayValues ?? {
    present: 1,
    sick: 0.5,
    excused: -1,
    absent: -2,
  };
  const pastCutoff = workDate === today() && isPastCutoff(cutoff);

  function loadSuggestions() {
    const rows = suggestions.data ?? [];
    setSheet(
      rows
        .filter((row: AttendanceSuggestionDto) => !row.alreadyRegistered)
        .map((row) => ({
          workerId: row.workerId,
          fullName: row.fullName,
          cardNo: row.cardNo,
          // الافتراض حضور: المستخدم يغيّر الاستثناء لا القاعدة
          status: "present" as AttendanceStatus,
          isTemp: false,
          note: "",
        })),
    );
    setMessage(null);
  }

  function addWorker() {
    const worker = (workers.data ?? []).find((row) => row.id === pickedWorkerId);
    if (worker === undefined) return;
    if (sheet.some((line) => line.workerId === worker.id)) return;

    setSheet([
      ...sheet,
      {
        workerId: worker.id,
        fullName: worker.fullName,
        cardNo: worker.cardNo,
        status: "present",
        isTemp: false,
        note: "",
      },
    ]);
    setPickedWorkerId("");
  }

  function updateLine(workerId: string, patch: Partial<SheetLine>) {
    setSheet(
      sheet.map((line) => (line.workerId === workerId ? { ...line, ...patch } : line)),
    );
  }

  async function handleSave() {
    setError(null);
    setMessage(null);
    try {
      const count = await register.mutateAsync({
        projectId,
        workDate,
        entries: sheet.map((line) => ({
          workerId: line.workerId,
          status: line.status,
          isTemp: line.isTemp,
          note: line.note,
        })),
      });
      setMessage(`${t.attendance.saved} ${formatNumber(count)}`);
      setSheet([]);
    } catch (e) {
      setError(errorMessage(e));
    }
  }

  const sheetPayable = payableDays(sheet, dayValues);

  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-6">
      <header>
        <h1 className="text-content text-xl font-extrabold">{t.attendance.title}</h1>
        <p className="text-content-muted mt-1 text-sm">{t.attendance.subtitle}</p>
      </header>

      <Card>
        <div className="grid gap-4 sm:grid-cols-3">
          <FormField label={t.attendance.project} required>
            {(id) => (
              <Select
                id={id}
                options={(projects.data ?? []).map((project) => ({
                  value: project.id,
                  label: `${project.code} — ${project.name}`,
                }))}
                placeholder={t.limits.pickProject}
                value={projectId}
                onChange={(e) => switchContext({ projectId: e.target.value })}
              />
            )}
          </FormField>

          <FormField label={t.attendance.date} required>
            {(id) => (
              <Input
                id={id}
                type="date"
                dir="ltr"
                value={workDate}
                onChange={(e) => switchContext({ workDate: e.target.value })}
              />
            )}
          </FormField>

          <div className="flex items-end">
            <Button
              variant="outline"
              onClick={loadSuggestions}
              disabled={projectId === "" || (suggestions.data ?? []).length === 0}
              startIcon={<Users aria-hidden className="size-4" />}
            >
              {t.attendance.load}
            </Button>
          </div>
        </div>

        <p className="text-content-muted mt-3 flex items-center gap-2 text-xs">
          <Clock aria-hidden className="size-4" />
          {t.attendance.cutoffHint} {cutoff} · {t.attendance.dayValuesHint}
        </p>

        {pastCutoff && (
          <p role="status" className="text-warning mt-2 text-sm font-medium">
            {t.attendance.cutoffWarning} ({cutoff})
          </p>
        )}
      </Card>

      <Card
        title={t.attendance.sheet}
        description={`${t.attendance.payableDays}: ${formatNumber(sheetPayable)}`}
        actions={
          <PermissionGate permission="attendance.register">
            <Button
              onClick={() => void handleSave()}
              isLoading={register.isPending}
              disabled={projectId === "" || sheet.length === 0}
              startIcon={<CalendarCheck aria-hidden className="size-4" />}
            >
              {t.attendance.save}
            </Button>
          </PermissionGate>
        }
      >
        <div className="bg-surface-sunken mb-4 flex flex-wrap items-end gap-3 rounded-[var(--radius-control)] p-3">
          <div className="min-w-56 flex-1">
            <Input
              value={workerQuery}
              onChange={(e) => setWorkerQuery(e.target.value)}
              placeholder={t.workers.search}
              aria-label={t.common.search}
              className="mb-2"
            />
            <Select
              options={(workers.data ?? [])
                .filter((worker) => worker.isActive)
                .map((worker) => ({
                  value: worker.id,
                  label: `${worker.fullName}${worker.cardNo === null ? "" : ` — ${worker.cardNo}`}`,
                }))}
              placeholder={t.attendance.pickWorker}
              value={pickedWorkerId}
              onChange={(e) => setPickedWorkerId(e.target.value)}
              aria-label={t.attendance.pickWorker}
            />
          </div>
          <Button
            onClick={addWorker}
            disabled={pickedWorkerId === ""}
            startIcon={<Plus aria-hidden className="size-4" />}
          >
            {t.attendance.addWorker}
          </Button>
        </div>

        {sheet.length === 0 ? (
          <EmptyState title={t.attendance.empty} description={t.attendance.emptyHint} />
        ) : (
          <ul className="divide-border divide-y">
            {sheet.map((line) => (
              <li
                key={line.workerId}
                className="flex flex-wrap items-center gap-3 py-2.5"
              >
                <span className="min-w-0 flex-1">
                  <span className="text-content block text-sm font-medium">
                    {line.fullName}
                  </span>
                  {line.cardNo !== null && (
                    <span className="text-content-muted font-mono text-xs">
                      {line.cardNo}
                    </span>
                  )}
                </span>

                <div className="w-40">
                  <Select
                    options={STATUS_OPTIONS}
                    value={line.status}
                    onChange={(e) =>
                      updateLine(line.workerId, {
                        status: e.target.value as AttendanceStatus,
                      })
                    }
                    aria-label={t.attendance.status}
                  />
                </div>

                <Checkbox
                  label={t.attendance.isTemp}
                  checked={line.isTemp}
                  onChange={(e) =>
                    updateLine(line.workerId, { isTemp: e.target.checked })
                  }
                />

                <Button
                  variant="ghost"
                  size="sm"
                  aria-label={t.attendance.remove}
                  onClick={() =>
                    setSheet(sheet.filter((row) => row.workerId !== line.workerId))
                  }
                  startIcon={<Trash2 aria-hidden className="text-danger size-4" />}
                />
              </li>
            ))}
          </ul>
        )}

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
      </Card>

      <Card title={t.attendance.records}>
        {(registered.data ?? []).length === 0 ? (
          <EmptyState title={t.attendance.noReport} />
        ) : (
          <ul className="divide-border divide-y">
            {(registered.data ?? []).map((row) => (
              <li
                key={row.id}
                className="flex flex-wrap items-center justify-between gap-2 py-2"
              >
                <span className="text-content text-sm">
                  {row.workerName}
                  {row.cardNo !== null && (
                    <span className="text-content-muted ms-2 font-mono text-xs">
                      {row.cardNo}
                    </span>
                  )}
                </span>
                <span className="flex items-center gap-2">
                  {row.isTemp && <Badge tone="neutral">{t.attendance.isTemp}</Badge>}
                  <Badge tone={STATUS_TONES[row.status]}>
                    {STATUS_LABELS[row.status]}
                  </Badge>
                  <span className="text-content-muted tabular text-xs">
                    {formatDate(row.workDate)}
                  </span>
                </span>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
