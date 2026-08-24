/**
 * صندوق الوارد — معيار قبول المرحلة الرابعة.
 * العدّاد واللون يأتيان محسوبَين من الخادم داخل مواعيد العمل؛ الواجهة تعرض
 * فقط. الترتيب حسب أولوية الوصول [المراسلات 25].
 */
import { useState } from "react";
import { CheckCircle2, Inbox as InboxIcon, Search, Send } from "lucide-react";
import type { InboxItemDto } from "@application/modules/workflow/dtos";
import { Card } from "@presentation/shared/ui/Card";
import { Badge } from "@presentation/shared/ui/Badge";
import { Button } from "@presentation/shared/ui/Button";
import { Input } from "@presentation/shared/ui/Input";
import { Select } from "@presentation/shared/ui/Select";
import { Checkbox } from "@presentation/shared/ui/Checkbox";
import { FormField } from "@presentation/shared/ui/FormField";
import { Modal } from "@presentation/shared/ui/Modal";
import { DataTable, type Column } from "@presentation/shared/ui/DataTable";
import { EmptyState } from "@presentation/shared/ui/EmptyState";
import { CountdownBadge } from "@presentation/shared/ui/CountdownBadge";
import { PermissionGate } from "@presentation/shared/ui/PermissionGate";
import { useDebounce } from "@presentation/shared/hooks/useDebounce";
import {
  formatDateTime,
  formatDuration,
  formatRelative,
} from "@presentation/shared/lib/formatters";
import { errorMessage } from "@presentation/shared/lib/query";
import { useProjects } from "@presentation/features/projects/hooks/useProjects";
import {
  useCompleteStep,
  useInbox,
  useStartTransaction,
  useTransactionSearch,
  useWorkflowDefinitions,
} from "../hooks/useWorkflow";
import { t } from "@i18n/index";

function NewTransactionModal({ onClose }: { onClose: () => void }) {
  const definitions = useWorkflowDefinitions();
  const projects = useProjects();
  const start = useStartTransaction();

  const [type, setType] = useState("");
  const [subject, setSubject] = useState("");
  const [projectId, setProjectId] = useState("");
  const [error, setError] = useState<string | null>(null);

  async function handleStart() {
    setError(null);
    try {
      await start.mutateAsync({
        type,
        subject,
        projectId: projectId === "" ? null : projectId,
      });
      onClose();
    } catch (e) {
      setError(errorMessage(e));
    }
  }

  return (
    <Modal
      isOpen
      onClose={onClose}
      title={t.transaction.newTitle}
      footer={
        <>
          <Button
            onClick={() => void handleStart()}
            isLoading={start.isPending}
            disabled={type === "" || subject.trim().length < 2}
          >
            {t.common.save}
          </Button>
          <Button variant="ghost" onClick={onClose}>
            {t.common.cancel}
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        <FormField label={t.transaction.newType} required>
          {(id) => (
            <Select
              id={id}
              options={(definitions.data ?? [])
                .filter((definition) => definition.isActive)
                .map((definition) => ({
                  value: definition.transactionType,
                  label: definition.name,
                }))}
              placeholder={t.transaction.newType}
              value={type}
              onChange={(e) => setType(e.target.value)}
            />
          )}
        </FormField>

        <FormField label={t.transaction.subject} required>
          {(id) => (
            <Input
              id={id}
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
            />
          )}
        </FormField>

        <FormField label={t.transaction.project}>
          {(id) => (
            <Select
              id={id}
              options={(projects.data ?? []).map((project) => ({
                value: project.id,
                label: `${project.code} — ${project.name}`,
              }))}
              placeholder={t.projects.none}
              value={projectId}
              onChange={(e) => setProjectId(e.target.value)}
            />
          )}
        </FormField>

        {error !== null && (
          <p role="alert" className="text-danger text-sm">
            {error}
          </p>
        )}
      </div>
    </Modal>
  );
}

function SearchPanel() {
  const [query, setQuery] = useState("");
  const results = useTransactionSearch(useDebounce(query, 300));

  return (
    <Card title={t.common.search} description={t.inbox.notParticipant}>
      <div className="relative mb-3">
        <Search
          aria-hidden
          className="text-content-muted pointer-events-none absolute end-3 top-1/2 size-4 -translate-y-1/2"
        />
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={t.inbox.searchPlaceholder}
          aria-label={t.common.search}
          className="pe-9"
        />
      </div>

      {query.trim() !== "" && (
        <ul className="divide-border divide-y">
          {(results.data ?? []).map((row) => (
            <li
              key={row.transactionNo}
              className="flex flex-wrap items-center justify-between gap-2 py-2"
            >
              <span className="flex items-center gap-2">
                <span className="tabular text-content font-mono text-sm">
                  #{row.transactionNo}
                </span>
                <Badge tone="neutral">{row.transactionType}</Badge>
                <span className="text-content-muted text-xs">{row.status}</span>
              </span>
              {!row.isParticipant && (
                <Badge tone="warning">{t.inbox.notParticipant}</Badge>
              )}
            </li>
          ))}
          {(results.data ?? []).length === 0 && !results.isPending && (
            <li className="text-content-muted py-2 text-sm">{t.common.noData}</li>
          )}
        </ul>
      )}
    </Card>
  );
}

export function InboxPage() {
  const [mineOnly, setMineOnly] = useState(true);
  const [openOnly, setOpenOnly] = useState(true);
  const [isNewOpen, setIsNewOpen] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const inbox = useInbox({ mineOnly, openOnly });
  const complete = useCompleteStep();

  async function handleComplete(item: InboxItemDto) {
    if (!window.confirm(t.inbox.completeHint)) return;
    setMessage(null);
    setError(null);
    try {
      await complete.mutateAsync({ stepInstanceId: item.stepInstanceId, notes: "" });
      setMessage(t.inbox.completed);
    } catch (e) {
      setError(errorMessage(e));
    }
  }

  const columns: readonly Column<InboxItemDto>[] = [
    {
      key: "no",
      header: t.inbox.no,
      render: (row) => (
        <a
          href={`/transactions/${row.transactionId}`}
          className="tabular text-brand-700 font-mono text-xs underline"
        >
          #{row.transactionNo}
        </a>
      ),
    },
    {
      key: "subject",
      header: t.inbox.subject,
      render: (row) => (
        <span className="flex flex-col">
          <span className="text-content text-sm font-medium">{row.subject}</span>
          <span className="text-content-muted text-[11px]">{row.stepName}</span>
        </span>
      ),
    },
    {
      key: "project",
      header: t.inbox.project,
      render: (row) =>
        row.projectName === null ? (
          <span className="text-content-muted text-xs">—</span>
        ) : (
          <Badge tone="neutral">{row.projectName}</Badge>
        ),
    },
    {
      key: "assignee",
      header: t.inbox.assignee,
      render: (row) => (
        <span className="text-content-muted text-sm">{row.assigneeName ?? "—"}</span>
      ),
    },
    {
      key: "allocated",
      header: t.inbox.allocated,
      numeric: true,
      render: (row) =>
        row.allocatedMinutes === null ? "—" : formatDuration(row.allocatedMinutes),
    },
    {
      key: "elapsed",
      header: t.inbox.elapsed,
      numeric: true,
      render: (row) => formatDuration(row.elapsedMinutes),
    },
    {
      key: "countdown",
      header: t.inbox.remaining,
      render: (row) => (
        <CountdownBadge
          color={row.color}
          remainingMinutes={row.remainingMinutes}
          awaitingDuration={row.awaitingDuration}
          isDone={row.stepStatus === "done"}
        />
      ),
    },
    {
      key: "due",
      header: t.inbox.dueAt,
      render: (row) => (
        <span className="tabular text-content-muted text-xs">
          {row.dueAt === null ? "—" : formatDateTime(row.dueAt)}
        </span>
      ),
    },
    {
      key: "arrived",
      header: t.inbox.arrivedAgo,
      render: (row) => (
        <span className="text-content-muted text-xs">
          {row.arrivedAt === null ? "—" : formatRelative(row.arrivedAt)}
        </span>
      ),
    },
    {
      key: "actions",
      header: "",
      render: (row) =>
        row.stepStatus === "in_progress" && !row.awaitingDuration ? (
          <span className="flex justify-end">
            <Button
              variant="outline"
              size="sm"
              onClick={() => void handleComplete(row)}
              isLoading={complete.isPending}
              startIcon={<CheckCircle2 aria-hidden className="size-4" />}
            >
              {t.inbox.complete}
            </Button>
          </span>
        ) : null,
    },
  ];

  return (
    <div className="mx-auto flex max-w-7xl flex-col gap-6">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-content text-xl font-extrabold">{t.inbox.title}</h1>
          <p className="text-content-muted mt-1 text-sm">{t.inbox.subtitle}</p>
        </div>

        <PermissionGate permission="transaction.create">
          <Button
            onClick={() => setIsNewOpen(true)}
            startIcon={<Send aria-hidden className="size-4" />}
          >
            {t.transaction.newTitle}
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

      <Card>
        <div className="mb-4 flex flex-wrap gap-4">
          <Checkbox
            label={t.inbox.mineOnly}
            checked={mineOnly}
            onChange={(e) => setMineOnly(e.target.checked)}
          />
          <Checkbox
            label={t.inbox.openOnly}
            checked={openOnly}
            onChange={(e) => setOpenOnly(e.target.checked)}
          />
        </div>

        {inbox.isError ? (
          <EmptyState title={t.common.error} description={errorMessage(inbox.error)} />
        ) : (
          <DataTable
            columns={columns}
            rows={inbox.data ?? []}
            rowKey={(row) => row.stepInstanceId}
            isLoading={inbox.isPending}
            emptyTitle={t.inbox.empty}
            emptyDescription={t.inbox.emptyHint}
          />
        )}
      </Card>

      <SearchPanel />

      {isNewOpen && <NewTransactionModal onClose={() => setIsNewOpen(false)} />}

      {(inbox.data ?? []).length === 0 && !inbox.isPending && (
        <p className="text-content-muted flex items-center gap-2 text-xs">
          <InboxIcon aria-hidden className="size-4" />
          {t.inbox.emptyHint}
        </p>
      )}
    </div>
  );
}
