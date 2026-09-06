/**
 * المهام المجدولة — ما يفعله النظام بنفسه.
 *
 * لا شاشة «خطابات آلية»: الخطاب معاملة عادية يبدؤها المجدوِل، فتظهر في
 * الوارد بعدّاد وتُحتسب في تقارير المتأخّر كأي معاملة.
 *
 * المجدوِل يعمل بلا رقيب، فحالة كل مهمة وسجلّ فشلها معروضان هنا — بغيرهما
 * يفشل صامتًا.
 */
import { useState, type FormEvent } from "react";
import { AlertTriangle, CalendarClock, Play, Trash2, Pencil } from "lucide-react";
import type {
  Audience,
  AudienceScope,
  ScheduleKind,
  ScheduleSpec,
  TaskAction,
} from "@core/modules/workflow/entities/ScheduledTask";
import {
  describeAudience,
  describeSchedule,
} from "@core/modules/workflow/entities/ScheduledTask";
import type { ScheduledTaskDto } from "@application/modules/workflow/dtos";
import { Card } from "@presentation/shared/ui/Card";
import { Badge } from "@presentation/shared/ui/Badge";
import { Button } from "@presentation/shared/ui/Button";
import { Input } from "@presentation/shared/ui/Input";
import { Select } from "@presentation/shared/ui/Select";
import { Checkbox } from "@presentation/shared/ui/Checkbox";
import { FormField } from "@presentation/shared/ui/FormField";
import { Modal } from "@presentation/shared/ui/Modal";
import { EmptyState } from "@presentation/shared/ui/EmptyState";
import { PermissionGate } from "@presentation/shared/ui/PermissionGate";
import { useConfirm } from "@presentation/shared/ui/useConfirm";
import { formatDateTime } from "@presentation/shared/lib/formatters";
import { errorMessage } from "@presentation/shared/lib/query";
import {
  useProfiles,
  useRoles,
} from "@presentation/features/identity/hooks/useIdentity";
import { useProjects } from "@presentation/features/projects/hooks/useProjects";
import {
  useRemoveScheduledTask,
  useRunScheduledTaskNow,
  useSaveScheduledTask,
  useScheduledTaskRuns,
  useScheduledTasks,
  useSchedulePreview,
} from "../hooks/useScheduler";
import { useWorkflowDefinitions } from "../hooks/useWorkflow";
import { t } from "@i18n/index";

const ACTION_OPTIONS = [
  { value: "start_workflow", label: t.scheduler.actionStartWorkflow },
  { value: "notify", label: t.scheduler.actionNotify },
];

const KIND_OPTIONS = [
  { value: "once", label: t.scheduler.kindOnce },
  { value: "daily", label: t.scheduler.kindDaily },
  { value: "weekly", label: t.scheduler.kindWeekly },
  { value: "monthly", label: t.scheduler.kindMonthly },
  { value: "quarterly", label: t.scheduler.kindQuarterly },
  { value: "yearly", label: t.scheduler.kindYearly },
];

const SCOPE_OPTIONS = [
  { value: "company", label: t.scheduler.scopeCompany },
  { value: "role", label: t.scheduler.scopeRole },
  { value: "project", label: t.scheduler.scopeProject },
  { value: "users", label: t.scheduler.scopeUsers },
];

const WEEK_DAYS = [
  { value: 0, label: "الأحد" },
  { value: 1, label: "الاثنين" },
  { value: 2, label: "الثلاثاء" },
  { value: 3, label: "الأربعاء" },
  { value: 4, label: "الخميس" },
  { value: 5, label: "الجمعة" },
  { value: 6, label: "السبت" },
];

function TaskModal({
  task,
  onClose,
}: {
  task: ScheduledTaskDto | null;
  onClose: () => void;
}) {
  const save = useSaveScheduledTask();
  const definitions = useWorkflowDefinitions();
  const roles = useRoles();
  const profiles = useProfiles();
  const projects = useProjects();

  const [name, setName] = useState(task?.name ?? "");
  const [isActive, setIsActive] = useState(task?.isActive ?? true);
  const [action, setAction] = useState<TaskAction>(task?.action ?? "start_workflow");
  const [transactionType, setTransactionType] = useState(task?.transactionType ?? "");
  const [projectId, setProjectId] = useState(task?.projectId ?? "");
  const [subject, setSubject] = useState(task?.subjectTemplate ?? "");
  const [body, setBody] = useState(task?.bodyTemplate ?? "");
  const [scope, setScope] = useState<AudienceScope>(task?.audience.scope ?? "company");
  const [audienceIds, setAudienceIds] = useState<string[]>([
    ...(task?.audience.ids ?? []),
  ]);
  const [kind, setKind] = useState<ScheduleKind>(task?.scheduleKind ?? "monthly");
  const [time, setTime] = useState(task?.scheduleSpec.time ?? "08:00");
  const [at, setAt] = useState(task?.scheduleSpec.at ?? "");
  const [days, setDays] = useState<number[]>([...(task?.scheduleSpec.days ?? [0])]);
  const [dayOfMonth, setDayOfMonth] = useState(
    String(task?.scheduleSpec.day_of_month ?? 1),
  );
  const [month, setMonth] = useState(String(task?.scheduleSpec.month ?? 1));
  const [day, setDay] = useState(String(task?.scheduleSpec.day ?? 1));
  const [shift, setShift] = useState(task?.shiftToWorkday ?? false);
  const [error, setError] = useState<string | null>(null);

  function buildSpec(): ScheduleSpec {
    switch (kind) {
      case "once":
        return { at };
      case "weekly":
        return { time, days };
      case "monthly":
      case "quarterly":
        return { time, day_of_month: Number(dayOfMonth) };
      case "yearly":
        return { time, month: Number(month), day: Number(day) };
      default:
        return { time };
    }
  }

  const spec = buildSpec();
  const audience: Audience =
    scope === "company" ? { scope } : { scope, ids: audienceIds };

  // المعاينة من القاعدة: توقيت الشركة ومواعيد دوامها لا توقيت المتصفّح
  const preview = useSchedulePreview(kind, spec, shift, name.trim() !== "");

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    try {
      await save.mutateAsync({
        id: task?.id ?? null,
        name,
        isActive,
        action,
        transactionType: action === "start_workflow" ? transactionType : null,
        projectId: projectId === "" ? null : projectId,
        subjectTemplate: subject,
        bodyTemplate: body,
        context: task?.context ?? {},
        audience,
        scheduleKind: kind,
        scheduleSpec: spec,
        shiftToWorkday: shift,
        nextRunAt: null,
      });
      onClose();
    } catch (e) {
      setError(errorMessage(e));
    }
  }

  const idOptions =
    scope === "role"
      ? (roles.data ?? []).map((r) => ({ value: r.id, label: r.name }))
      : scope === "project"
        ? (projects.data ?? []).map((p) => ({ value: p.id, label: p.name }))
        : (profiles.data ?? [])
            .filter((p) => p.isActive)
            .map((p) => ({ value: p.id, label: p.fullName }));

  return (
    <Modal
      isOpen
      onClose={onClose}
      title={task === null ? t.scheduler.createTitle : t.scheduler.editTitle}
      footer={
        <>
          <Button type="submit" form="task-form" isLoading={save.isPending}>
            {t.common.save}
          </Button>
          <Button variant="ghost" onClick={onClose}>
            {t.common.cancel}
          </Button>
        </>
      }
    >
      <form
        id="task-form"
        onSubmit={handleSubmit}
        className="grid gap-4 sm:grid-cols-2"
      >
        <FormField label={t.scheduler.name} required>
          {(id) => (
            <Input
              id={id}
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
            />
          )}
        </FormField>

        <FormField label={t.scheduler.action} hint={t.scheduler.actionHint} required>
          {(id) => (
            <Select
              id={id}
              options={ACTION_OPTIONS}
              value={action}
              onChange={(e) => setAction(e.target.value as TaskAction)}
            />
          )}
        </FormField>

        {action === "start_workflow" && (
          <FormField label={t.scheduler.transactionType} required>
            {(id) => (
              <Select
                id={id}
                options={(definitions.data ?? [])
                  .filter((d) => d.isActive)
                  .map((d) => ({ value: d.transactionType, label: d.name }))}
                placeholder={t.projects.none}
                value={transactionType}
                onChange={(e) => setTransactionType(e.target.value)}
              />
            )}
          </FormField>
        )}

        <FormField label={t.transaction.project}>
          {(id) => (
            <Select
              id={id}
              options={(projects.data ?? []).map((p) => ({
                value: p.id,
                label: p.name,
              }))}
              placeholder={t.projects.none}
              value={projectId}
              onChange={(e) => setProjectId(e.target.value)}
            />
          )}
        </FormField>

        <div className="sm:col-span-2">
          <FormField
            label={t.scheduler.subject}
            hint={t.scheduler.templateHint}
            required={action === "notify"}
          >
            {(id) => (
              <Input
                id={id}
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
              />
            )}
          </FormField>
        </div>

        <div className="sm:col-span-2">
          <FormField label={t.scheduler.body}>
            {(id) => (
              <textarea
                id={id}
                rows={3}
                value={body}
                onChange={(e) => setBody(e.target.value)}
                className="border-border-strong bg-surface text-content w-full rounded-[var(--radius-control)] border px-3 py-2 text-sm"
              />
            )}
          </FormField>
        </div>

        <FormField
          label={t.scheduler.audience}
          hint={t.scheduler.audienceHint}
          required
        >
          {(id) => (
            <Select
              id={id}
              options={SCOPE_OPTIONS}
              value={scope}
              onChange={(e) => {
                setScope(e.target.value as AudienceScope);
                setAudienceIds([]);
              }}
            />
          )}
        </FormField>

        {scope !== "company" && (
          <FormField label={t.scheduler.audienceIds} required>
            {(id) => (
              <select
                id={id}
                multiple
                size={5}
                value={audienceIds}
                onChange={(e) =>
                  setAudienceIds(
                    Array.from(e.target.selectedOptions).map((o) => o.value),
                  )
                }
                className="border-border-strong bg-surface text-content w-full rounded-[var(--radius-control)] border px-3 py-2 text-sm"
              >
                {idOptions.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
            )}
          </FormField>
        )}

        <FormField label={t.scheduler.scheduleKind} required>
          {(id) => (
            <Select
              id={id}
              options={KIND_OPTIONS}
              value={kind}
              onChange={(e) => setKind(e.target.value as ScheduleKind)}
            />
          )}
        </FormField>

        {kind === "once" ? (
          <FormField label={t.scheduler.at} required>
            {(id) => (
              <Input
                id={id}
                type="datetime-local"
                dir="ltr"
                value={at.slice(0, 16)}
                onChange={(e) => setAt(new Date(e.target.value).toISOString())}
              />
            )}
          </FormField>
        ) : (
          <FormField label={t.scheduler.time} required>
            {(id) => (
              <Input
                id={id}
                type="time"
                dir="ltr"
                value={time}
                onChange={(e) => setTime(e.target.value)}
              />
            )}
          </FormField>
        )}

        {kind === "weekly" && (
          <div className="sm:col-span-2">
            <span className="text-content-muted mb-1 block text-xs">
              {t.scheduler.days}
            </span>
            <div className="flex flex-wrap gap-3">
              {WEEK_DAYS.map((d) => (
                <Checkbox
                  key={d.value}
                  label={d.label}
                  checked={days.includes(d.value)}
                  onChange={(e) =>
                    setDays(
                      e.target.checked
                        ? [...days, d.value]
                        : days.filter((x) => x !== d.value),
                    )
                  }
                />
              ))}
            </div>
          </div>
        )}

        {(kind === "monthly" || kind === "quarterly") && (
          <FormField label={t.scheduler.dayOfMonth} hint={t.scheduler.dayOfMonthHint}>
            {(id) => (
              <Input
                id={id}
                type="number"
                min="1"
                max="28"
                dir="ltr"
                value={dayOfMonth}
                onChange={(e) => setDayOfMonth(e.target.value)}
              />
            )}
          </FormField>
        )}

        {kind === "yearly" && (
          <>
            <FormField label={t.scheduler.month}>
              {(id) => (
                <Input
                  id={id}
                  type="number"
                  min="1"
                  max="12"
                  dir="ltr"
                  value={month}
                  onChange={(e) => setMonth(e.target.value)}
                />
              )}
            </FormField>
            <FormField label={t.scheduler.day} hint={t.scheduler.dayOfMonthHint}>
              {(id) => (
                <Input
                  id={id}
                  type="number"
                  min="1"
                  max="28"
                  dir="ltr"
                  value={day}
                  onChange={(e) => setDay(e.target.value)}
                />
              )}
            </FormField>
          </>
        )}

        <Checkbox
          label={t.scheduler.shiftToWorkday}
          hint={t.scheduler.shiftHint}
          checked={shift}
          onChange={(e) => setShift(e.target.checked)}
        />
        <Checkbox
          label={t.scheduler.isActive}
          checked={isActive}
          onChange={(e) => setIsActive(e.target.checked)}
        />

        {/* معاينة المواعيد: أوضح من أي وصف نصّي */}
        <div className="bg-surface-sunken rounded-[var(--radius-control)] p-3 sm:col-span-2">
          <span className="text-content-muted block text-xs">
            {t.scheduler.nextRuns}
          </span>
          <ul className="mt-1 flex flex-col gap-0.5">
            {(preview.data ?? []).map((iso) => (
              <li key={iso} className="tabular text-content text-xs">
                {formatDateTime(iso)}
              </li>
            ))}
            {(preview.data ?? []).length === 0 && (
              <li className="text-content-muted text-xs">{t.common.noData}</li>
            )}
          </ul>
        </div>

        {error !== null && (
          <p role="alert" className="text-danger text-sm sm:col-span-2">
            {error}
          </p>
        )}
      </form>
    </Modal>
  );
}

function RunsModal({ task, onClose }: { task: ScheduledTaskDto; onClose: () => void }) {
  const runs = useScheduledTaskRuns(task.id);

  return (
    <Modal isOpen onClose={onClose} title={t.scheduler.runs} description={task.name}>
      {(runs.data ?? []).length === 0 ? (
        <EmptyState title={t.scheduler.noRuns} />
      ) : (
        <ul className="divide-border divide-y">
          {(runs.data ?? []).map((run) => (
            <li key={run.id} className="flex flex-wrap items-baseline gap-2 py-2">
              <Badge tone={run.status === "error" ? "danger" : "success"}>
                {run.status === "error" ? t.common.error : t.scheduler.ran}
              </Badge>
              <span className="tabular text-content-muted text-xs">
                {formatDateTime(run.firedAt)}
              </span>
              <span className="text-content-muted text-xs">
                {t.scheduler.audienceCount}: {run.audienceCount}
              </span>
              {run.notifiedCount > 0 && (
                <span className="text-content-muted text-xs">
                  {t.scheduler.notified}: {run.notifiedCount}
                </span>
              )}
              {run.createdTransactionIds.length > 0 && (
                <a
                  href={`/transactions/${run.createdTransactionIds[0]}`}
                  className="text-brand-700 text-xs underline"
                >
                  {t.scheduler.openTransaction}
                </a>
              )}
              {run.error !== "" && (
                <span className="text-danger basis-full text-xs">{run.error}</span>
              )}
            </li>
          ))}
        </ul>
      )}
    </Modal>
  );
}

export function ScheduledTasksPage() {
  const tasks = useScheduledTasks();
  const remove = useRemoveScheduledTask();
  const confirm = useConfirm();
  const runNow = useRunScheduledTaskNow();
  const roles = useRoles();
  const profiles = useProfiles();
  const projects = useProjects();

  const [editing, setEditing] = useState<ScheduledTaskDto | null>(null);
  const [isOpen, setIsOpen] = useState(false);
  const [runsFor, setRunsFor] = useState<ScheduledTaskDto | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // أسماء الجمهور: الدومين يصف، والواجهة تسمّي
  const names: Record<string, string> = {};
  for (const r of roles.data ?? []) names[r.id] = r.name;
  for (const p of profiles.data ?? []) names[p.id] = p.fullName;
  for (const p of projects.data ?? []) names[p.id] = p.name;

  async function handleRun(task: ScheduledTaskDto) {
    if (!window.confirm(t.scheduler.runNowHint)) return;
    setMessage(null);
    setError(null);
    try {
      await runNow.mutateAsync(task.id);
      setMessage(t.scheduler.ran);
    } catch (e) {
      setError(errorMessage(e));
    }
  }

  const rows = tasks.data ?? [];

  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-6">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-content text-xl font-extrabold">{t.scheduler.title}</h1>
          <p className="text-content-muted mt-1 text-sm">{t.scheduler.subtitle}</p>
        </div>

        <PermissionGate permission="schedule.manage">
          <Button
            onClick={() => {
              setEditing(null);
              setIsOpen(true);
            }}
            startIcon={<CalendarClock aria-hidden className="size-4" />}
          >
            {t.scheduler.add}
          </Button>
        </PermissionGate>
      </header>

      {message !== null && (
        <p role="status" className="text-success text-sm">
          {message}
        </p>
      )}
      {error !== null && (
        <p role="alert" className="text-danger text-sm">
          {error}
        </p>
      )}

      {tasks.isError && (
        <Card>
          <EmptyState title={t.common.error} description={errorMessage(tasks.error)} />
        </Card>
      )}

      {!tasks.isError && rows.length === 0 && (
        <Card>
          <EmptyState title={t.scheduler.empty} description={t.scheduler.emptyHint} />
        </Card>
      )}

      {rows.map((task) => (
        <Card
          key={task.id}
          title={
            <span className="flex flex-wrap items-center gap-2">
              <span>{task.name}</span>
              <Badge tone={task.isActive ? "success" : "neutral"}>
                {task.isActive ? t.items.active : t.items.inactive}
              </Badge>
              <Badge tone="neutral">
                {task.action === "start_workflow"
                  ? t.scheduler.actionStartWorkflow
                  : t.scheduler.actionNotify}
              </Badge>
              {/* الفشل الصامت هو خطر المجدوِل الأول */}
              {task.errorRuns > 0 && (
                <Badge tone="danger">
                  <AlertTriangle aria-hidden className="me-1 inline size-3" />
                  {t.scheduler.failedRuns}: {task.errorRuns}
                </Badge>
              )}
            </span>
          }
          actions={
            <PermissionGate permission="schedule.manage">
              <span className="flex gap-1">
                <Button variant="ghost" size="sm" onClick={() => setRunsFor(task)}>
                  {t.scheduler.runs}
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => void handleRun(task)}
                  isLoading={runNow.isPending}
                  startIcon={<Play aria-hidden className="size-4" />}
                >
                  {t.scheduler.runNow}
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  aria-label={t.common.edit}
                  onClick={() => {
                    setEditing(task);
                    setIsOpen(true);
                  }}
                  startIcon={<Pencil aria-hidden className="size-4" />}
                />
                <Button
                  variant="ghost"
                  size="sm"
                  aria-label={t.common.delete}
                  onClick={() =>
                    confirm.ask({
                      title: t.scheduler.deleteTask,
                      description: task.name,
                      consequences: [t.scheduler.deleteTaskHint],
                      onConfirm: () => remove.mutateAsync(task.id),
                    })
                  }
                  startIcon={<Trash2 aria-hidden className="text-danger size-4" />}
                />
              </span>
            </PermissionGate>
          }
        >
          <dl className="grid gap-3 sm:grid-cols-4">
            <div>
              <dt className="text-content-muted text-xs">{t.scheduler.scheduleKind}</dt>
              <dd className="text-content mt-0.5 text-sm">
                {describeSchedule(
                  task.scheduleKind,
                  task.scheduleSpec,
                  task.shiftToWorkday,
                )}
              </dd>
            </div>
            <div>
              <dt className="text-content-muted text-xs">{t.scheduler.audience}</dt>
              <dd className="text-content mt-0.5 text-sm">
                {describeAudience(task.audience, names)}
                <span className="text-content-muted"> · {task.audienceSize}</span>
              </dd>
            </div>
            <div>
              <dt className="text-content-muted text-xs">{t.scheduler.nextRun}</dt>
              <dd className="tabular text-content mt-0.5 text-sm">
                {task.isActive ? formatDateTime(task.nextRunAt) : "—"}
              </dd>
            </div>
            <div>
              <dt className="text-content-muted text-xs">{t.scheduler.lastRun}</dt>
              <dd className="tabular text-content mt-0.5 text-sm">
                {task.lastRunAt === null ? "—" : formatDateTime(task.lastRunAt)}
                {task.runCount > 0 && (
                  <span className="text-content-muted"> · {task.runCount}</span>
                )}
              </dd>
            </div>
          </dl>

          {task.lastError !== "" && (
            <p className="text-danger mt-2 text-xs">{task.lastError}</p>
          )}
        </Card>
      ))}

      {isOpen && (
        <TaskModal
          key={editing?.id ?? "new"}
          task={editing}
          onClose={() => setIsOpen(false)}
        />
      )}

      {runsFor !== null && (
        <RunsModal task={runsFor} onClose={() => setRunsFor(null)} />
      )}
    </div>
  );
}
