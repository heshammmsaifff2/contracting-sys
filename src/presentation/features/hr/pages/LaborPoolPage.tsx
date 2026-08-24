/**
 * حالة العمالة: الشاغرة والمنتدبة والتي بها مشكلة [شؤون الموظفين 4، 5، 6].
 * الحالة المفتوحة واحدة لكل عامل (فهرس فريد)، وتغييرها يُغلق السابقة
 * فيبقى للحالة تاريخ لا مجرّد قيمة أخيرة.
 */
import { useState, type FormEvent } from "react";
import { UserCheck, UserMinus, UserX } from "lucide-react";
import type { WorkerDto } from "@application/modules/hr/dtos";
import type { WorkerStatus } from "@core/modules/hr/entities/Worker";
import { Card } from "@presentation/shared/ui/Card";
import { Badge, type BadgeTone } from "@presentation/shared/ui/Badge";
import { Button } from "@presentation/shared/ui/Button";
import { Input } from "@presentation/shared/ui/Input";
import { Select } from "@presentation/shared/ui/Select";
import { FormField } from "@presentation/shared/ui/FormField";
import { Modal } from "@presentation/shared/ui/Modal";
import { DataTable, type Column } from "@presentation/shared/ui/DataTable";
import { EmptyState } from "@presentation/shared/ui/EmptyState";
import { PermissionGate } from "@presentation/shared/ui/PermissionGate";
import { errorMessage } from "@presentation/shared/lib/query";
import { useProjects } from "@presentation/features/projects/hooks/useProjects";
import { useSetWorkerStatus, useWorkerPool } from "../hooks/useHr";
import { t } from "@i18n/index";

const STATUS_LABELS: Record<WorkerStatus, string> = {
  available: t.laborPool.available,
  seconded: t.laborPool.seconded,
  problem: t.laborPool.problem,
};

const STATUS_TONES: Record<WorkerStatus, BadgeTone> = {
  available: "success",
  seconded: "info",
  problem: "danger",
};

const TABS: readonly { key: WorkerStatus | null; label: string }[] = [
  { key: null, label: t.laborPool.all },
  { key: "available", label: t.laborPool.available },
  { key: "seconded", label: t.laborPool.seconded },
  { key: "problem", label: t.laborPool.problem },
];

function StatusModal({ worker, onClose }: { worker: WorkerDto; onClose: () => void }) {
  const projects = useProjects();
  const setStatus = useSetWorkerStatus();

  const [status, setStatusValue] = useState<WorkerStatus>(worker.status ?? "available");
  const [projectId, setProjectId] = useState(worker.statusProjectId ?? "");
  const [availableFrom, setAvailableFrom] = useState(
    new Date().toISOString().slice(0, 10),
  );
  const [availableTo, setAvailableTo] = useState("");
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    try {
      await setStatus.mutateAsync({
        workerId: worker.id,
        status,
        projectId: status === "seconded" ? (projectId === "" ? null : projectId) : null,
        availableFrom,
        availableTo: availableTo === "" ? null : availableTo,
        note,
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
      title={`${t.laborPool.statusTitle} — ${worker.fullName}`}
      footer={
        <>
          <Button
            type="submit"
            form="status-form"
            isLoading={setStatus.isPending}
            disabled={status === "seconded" && projectId === ""}
          >
            {t.common.save}
          </Button>
          <Button variant="ghost" onClick={onClose}>
            {t.common.cancel}
          </Button>
        </>
      }
    >
      <form id="status-form" onSubmit={handleSubmit} className="flex flex-col gap-4">
        <FormField label={t.workers.status} required>
          {(id) => (
            <Select
              id={id}
              options={(Object.keys(STATUS_LABELS) as WorkerStatus[]).map((key) => ({
                value: key,
                label: STATUS_LABELS[key],
              }))}
              value={status}
              onChange={(e) => setStatusValue(e.target.value as WorkerStatus)}
            />
          )}
        </FormField>

        {status === "seconded" && (
          <FormField label={t.laborPool.project} required>
            {(id) => (
              <Select
                id={id}
                options={(projects.data ?? []).map((project) => ({
                  value: project.id,
                  label: `${project.code} — ${project.name}`,
                }))}
                placeholder={t.limits.pickProject}
                value={projectId}
                onChange={(e) => setProjectId(e.target.value)}
              />
            )}
          </FormField>
        )}

        <div className="grid gap-4 sm:grid-cols-2">
          <FormField label={t.laborPool.from} required>
            {(id) => (
              <Input
                id={id}
                type="date"
                dir="ltr"
                value={availableFrom}
                onChange={(e) => setAvailableFrom(e.target.value)}
                required
              />
            )}
          </FormField>

          <FormField label={t.laborPool.to}>
            {(id) => (
              <Input
                id={id}
                type="date"
                dir="ltr"
                value={availableTo}
                onChange={(e) => setAvailableTo(e.target.value)}
              />
            )}
          </FormField>
        </div>

        <FormField label={t.laborPool.note}>
          {(id) => (
            <Input id={id} value={note} onChange={(e) => setNote(e.target.value)} />
          )}
        </FormField>

        {error !== null && (
          <p role="alert" className="text-danger text-sm">
            {error}
          </p>
        )}
      </form>
    </Modal>
  );
}

export function LaborPoolPage() {
  const [tab, setTab] = useState<WorkerStatus | null>(null);
  const pool = useWorkerPool({ status: tab });
  const [selected, setSelected] = useState<WorkerDto | null>(null);

  const columns: readonly Column<WorkerDto>[] = [
    {
      key: "name",
      header: t.workers.name,
      render: (row) => (
        <span>
          <span className="text-content block text-sm font-medium">{row.fullName}</span>
          <span className="text-content-muted font-mono text-xs">
            {row.cardNo ?? "—"}
          </span>
        </span>
      ),
    },
    {
      key: "professions",
      header: t.workers.professions,
      render: (row) => (
        <span className="flex flex-wrap gap-1">
          {row.professions.map((profession) => (
            <Badge key={profession} tone="neutral">
              {profession}
            </Badge>
          ))}
        </span>
      ),
    },
    {
      key: "status",
      header: t.workers.status,
      render: (row) =>
        row.status === null ? (
          <span className="text-content-muted text-xs">—</span>
        ) : (
          <Badge tone={STATUS_TONES[row.status]}>{STATUS_LABELS[row.status]}</Badge>
        ),
    },
    {
      key: "project",
      header: t.laborPool.project,
      render: (row) => (
        <span className="text-sm">
          {row.statusProjectName === "" ? "—" : row.statusProjectName}
        </span>
      ),
    },
    {
      key: "note",
      header: t.laborPool.note,
      render: (row) => (
        <span className="text-content-muted text-xs">{row.statusNote}</span>
      ),
    },
    {
      key: "actions",
      header: "",
      render: (row) => (
        <PermissionGate permission="worker.manage">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setSelected(row)}
            startIcon={<UserCheck aria-hidden className="size-4" />}
          >
            {t.laborPool.setStatus}
          </Button>
        </PermissionGate>
      ),
    },
  ];

  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-6">
      <header>
        <h1 className="text-content text-xl font-extrabold">{t.laborPool.title}</h1>
        <p className="text-content-muted mt-1 text-sm">{t.laborPool.subtitle}</p>
      </header>

      <Card>
        <nav className="flex flex-wrap gap-1" aria-label={t.laborPool.title}>
          {TABS.map((item) => (
            <Button
              key={item.key ?? "all"}
              variant={tab === item.key ? "primary" : "ghost"}
              size="sm"
              onClick={() => setTab(item.key)}
              startIcon={
                item.key === "problem" ? (
                  <UserX aria-hidden className="size-4" />
                ) : item.key === "seconded" ? (
                  <UserMinus aria-hidden className="size-4" />
                ) : undefined
              }
            >
              {item.label}
            </Button>
          ))}
        </nav>
      </Card>

      <Card>
        {pool.isError ? (
          <EmptyState title={t.common.error} description={errorMessage(pool.error)} />
        ) : (
          <DataTable
            columns={columns}
            rows={pool.data ?? []}
            rowKey={(row) => row.id}
            isLoading={pool.isLoading}
            emptyTitle={t.laborPool.empty}
            emptyDescription={t.laborPool.emptyHint}
          />
        )}
      </Card>

      {selected !== null && (
        <StatusModal worker={selected} onClose={() => setSelected(null)} />
      )}
    </div>
  );
}
