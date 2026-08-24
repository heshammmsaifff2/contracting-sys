/**
 * مواعيد العمل والإجازات [المراسلات 8].
 * هذه الصفحة هي أساس العدّاد: ما يقع خارج هذه المواعيد لا يُحتسب في المدد،
 * والاستثناء الفردي يُلغي الدوام العام لذلك اليوم لذلك الموظف.
 */
import { useState } from "react";
import { CalendarOff, CalendarPlus, Trash2 } from "lucide-react";
import type { HolidayDto, WorkScheduleDto } from "@application/modules/workflow/dtos";
import type { WeekDay } from "@core/modules/workflow/entities/WorkSchedule";
import { Card } from "@presentation/shared/ui/Card";
import { Badge } from "@presentation/shared/ui/Badge";
import { Button } from "@presentation/shared/ui/Button";
import { Input } from "@presentation/shared/ui/Input";
import { Select } from "@presentation/shared/ui/Select";
import { FormField } from "@presentation/shared/ui/FormField";
import { DataTable, type Column } from "@presentation/shared/ui/DataTable";
import { EmptyState } from "@presentation/shared/ui/EmptyState";
import { PermissionGate } from "@presentation/shared/ui/PermissionGate";
import { usePermission } from "@presentation/shared/hooks/usePermission";
import { formatDate, formatDuration } from "@presentation/shared/lib/formatters";
import { errorMessage } from "@presentation/shared/lib/query";
import { useProfiles } from "@presentation/features/identity/hooks/useIdentity";
import {
  useAddHoliday,
  useHolidays,
  useRemoveHoliday,
  useRemoveWorkSchedule,
  useSaveWorkSchedule,
  useWorkSchedules,
} from "../hooks/useWorkflow";
import { t } from "@i18n/index";

/** 0 = الأحد … 6 = السبت، مطابق لـ extract(dow) في Postgres. */
const DAY_LABELS: Record<WeekDay, string> = {
  0: t.workCalendar.sunday,
  1: t.workCalendar.monday,
  2: t.workCalendar.tuesday,
  3: t.workCalendar.wednesday,
  4: t.workCalendar.thursday,
  5: t.workCalendar.friday,
  6: t.workCalendar.saturday,
};

const DAY_OPTIONS = ([0, 1, 2, 3, 4, 5, 6] as const).map((day) => ({
  value: String(day),
  label: DAY_LABELS[day],
}));

function toMinutes(time: string): number {
  const [hours = "0", minutes = "0"] = time.split(":");
  return Number(hours) * 60 + Number(minutes);
}

export function WorkCalendarPage() {
  const schedules = useWorkSchedules();
  const holidays = useHolidays();
  const profiles = useProfiles();
  const saveSchedule = useSaveWorkSchedule();
  const removeSchedule = useRemoveWorkSchedule();
  const addHoliday = useAddHoliday();
  const removeHoliday = useRemoveHoliday();
  const canManage = usePermission("work_calendar.manage");

  const [scope, setScope] = useState<"global" | "user">("global");
  const [userId, setUserId] = useState("");
  const [dayOfWeek, setDayOfWeek] = useState<WeekDay>(0);
  const [startTime, setStartTime] = useState("09:00");
  const [endTime, setEndTime] = useState("17:00");

  const [holidayDate, setHolidayDate] = useState("");
  const [holidayDescription, setHolidayDescription] = useState("");

  const [error, setError] = useState<string | null>(null);

  const staffOptions = (profiles.data ?? []).map((profile) => ({
    value: profile.id,
    label: profile.fullName,
  }));

  async function handleAddSchedule() {
    setError(null);
    try {
      await saveSchedule.mutateAsync({
        id: null,
        scope,
        userId: scope === "user" ? (userId === "" ? null : userId) : null,
        dayOfWeek,
        startTime,
        endTime,
      });
    } catch (e) {
      setError(errorMessage(e));
    }
  }

  async function handleAddHoliday() {
    setError(null);
    try {
      await addHoliday.mutateAsync({
        holidayDate,
        description: holidayDescription,
        scope: "global",
        userId: null,
      });
      setHolidayDate("");
      setHolidayDescription("");
    } catch (e) {
      setError(errorMessage(e));
    }
  }

  const scheduleColumns: readonly Column<WorkScheduleDto>[] = [
    {
      key: "scope",
      header: t.workCalendar.scope,
      render: (row) => (
        <Badge tone={row.scope === "user" ? "warning" : "neutral"}>
          {row.scope === "user"
            ? `${t.workCalendar.scopeUser}: ${row.userName ?? ""}`
            : t.workCalendar.scopeGlobal}
        </Badge>
      ),
    },
    {
      key: "day",
      header: t.workCalendar.day,
      render: (row) => (
        <span className="text-content text-sm">{DAY_LABELS[row.dayOfWeek]}</span>
      ),
    },
    {
      key: "from",
      header: t.workCalendar.from,
      render: (row) => (
        <span dir="ltr" className="tabular text-content-muted font-mono text-xs">
          {row.startTime}
        </span>
      ),
    },
    {
      key: "to",
      header: t.workCalendar.to,
      render: (row) => (
        <span dir="ltr" className="tabular text-content-muted font-mono text-xs">
          {row.endTime}
        </span>
      ),
    },
    {
      key: "duration",
      header: t.workCalendar.duration,
      numeric: true,
      render: (row) =>
        formatDuration(toMinutes(row.endTime) - toMinutes(row.startTime)),
    },
    {
      key: "actions",
      header: "",
      render: (row) =>
        canManage ? (
          <span className="flex justify-end">
            <Button
              variant="ghost"
              size="sm"
              aria-label={t.common.delete}
              onClick={() => removeSchedule.mutate(row.id)}
              startIcon={<Trash2 aria-hidden className="text-danger size-4" />}
            />
          </span>
        ) : null,
    },
  ];

  const holidayColumns: readonly Column<HolidayDto>[] = [
    {
      key: "date",
      header: t.workCalendar.date,
      render: (row) => (
        <span className="tabular text-content text-sm">
          {formatDate(row.holidayDate)}
        </span>
      ),
    },
    {
      key: "description",
      header: t.workCalendar.description,
      render: (row) => (
        <span className="text-content-muted text-sm">{row.description}</span>
      ),
    },
    {
      key: "scope",
      header: t.workCalendar.scope,
      render: (row) => (
        <Badge tone={row.scope === "user" ? "warning" : "neutral"}>
          {row.scope === "user"
            ? `${t.workCalendar.scopeUser}: ${row.userName ?? ""}`
            : t.workCalendar.scopeGlobal}
        </Badge>
      ),
    },
    {
      key: "actions",
      header: "",
      render: (row) =>
        canManage ? (
          <span className="flex justify-end">
            <Button
              variant="ghost"
              size="sm"
              aria-label={t.common.delete}
              onClick={() => removeHoliday.mutate(row.id)}
              startIcon={<Trash2 aria-hidden className="text-danger size-4" />}
            />
          </span>
        ) : null,
    },
  ];

  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-6">
      <header>
        <h1 className="text-content text-xl font-extrabold">{t.workCalendar.title}</h1>
        <p className="text-content-muted mt-1 text-sm">{t.workCalendar.subtitle}</p>
      </header>

      {error !== null && (
        <p role="alert" className="text-danger text-sm">
          {error}
        </p>
      )}

      <Card title={t.workCalendar.schedules} description={t.workCalendar.overrideHint}>
        <PermissionGate permission="work_calendar.manage">
          <div className="bg-surface-sunken mb-4 grid gap-3 rounded-[var(--radius-control)] p-3 sm:grid-cols-3">
            <FormField label={t.workCalendar.scope}>
              {(id) => (
                <Select
                  id={id}
                  options={[
                    { value: "global", label: t.workCalendar.scopeGlobal },
                    { value: "user", label: t.workCalendar.scopeUser },
                  ]}
                  value={scope}
                  onChange={(e) => setScope(e.target.value as "global" | "user")}
                />
              )}
            </FormField>

            {scope === "user" && (
              <FormField label={t.workCalendar.employee}>
                {(id) => (
                  <Select
                    id={id}
                    options={staffOptions}
                    placeholder={t.workCalendar.employee}
                    value={userId}
                    onChange={(e) => setUserId(e.target.value)}
                  />
                )}
              </FormField>
            )}

            <FormField label={t.workCalendar.day}>
              {(id) => (
                <Select
                  id={id}
                  options={DAY_OPTIONS}
                  value={String(dayOfWeek)}
                  onChange={(e) => setDayOfWeek(Number(e.target.value) as WeekDay)}
                />
              )}
            </FormField>

            <FormField label={t.workCalendar.from}>
              {(id) => (
                <Input
                  id={id}
                  type="time"
                  dir="ltr"
                  value={startTime}
                  onChange={(e) => setStartTime(e.target.value)}
                />
              )}
            </FormField>

            <FormField label={t.workCalendar.to}>
              {(id) => (
                <Input
                  id={id}
                  type="time"
                  dir="ltr"
                  value={endTime}
                  onChange={(e) => setEndTime(e.target.value)}
                />
              )}
            </FormField>

            <div className="flex items-end">
              <Button
                onClick={() => void handleAddSchedule()}
                isLoading={saveSchedule.isPending}
                disabled={scope === "user" && userId === ""}
                startIcon={<CalendarPlus aria-hidden className="size-4" />}
              >
                {t.workCalendar.addSchedule}
              </Button>
            </div>
          </div>
        </PermissionGate>

        {schedules.isError ? (
          <EmptyState
            title={t.common.error}
            description={errorMessage(schedules.error)}
          />
        ) : (
          <DataTable
            columns={scheduleColumns}
            rows={schedules.data ?? []}
            rowKey={(row) => row.id}
            isLoading={schedules.isPending}
            emptyTitle={t.workCalendar.noSchedules}
          />
        )}
      </Card>

      <Card title={t.workCalendar.holidays}>
        <PermissionGate permission="work_calendar.manage">
          <div className="bg-surface-sunken mb-4 grid gap-3 rounded-[var(--radius-control)] p-3 sm:grid-cols-3">
            <FormField label={t.workCalendar.date}>
              {(id) => (
                <Input
                  id={id}
                  type="date"
                  value={holidayDate}
                  onChange={(e) => setHolidayDate(e.target.value)}
                />
              )}
            </FormField>

            <FormField label={t.workCalendar.description}>
              {(id) => (
                <Input
                  id={id}
                  value={holidayDescription}
                  onChange={(e) => setHolidayDescription(e.target.value)}
                />
              )}
            </FormField>

            <div className="flex items-end">
              <Button
                onClick={() => void handleAddHoliday()}
                isLoading={addHoliday.isPending}
                disabled={holidayDate === ""}
                startIcon={<CalendarOff aria-hidden className="size-4" />}
              >
                {t.workCalendar.addHoliday}
              </Button>
            </div>
          </div>
        </PermissionGate>

        {holidays.isError ? (
          <EmptyState
            title={t.common.error}
            description={errorMessage(holidays.error)}
          />
        ) : (
          <DataTable
            columns={holidayColumns}
            rows={holidays.data ?? []}
            rowKey={(row) => row.id}
            isLoading={holidays.isPending}
            emptyTitle={t.workCalendar.noHolidays}
          />
        )}
      </Card>
    </div>
  );
}
