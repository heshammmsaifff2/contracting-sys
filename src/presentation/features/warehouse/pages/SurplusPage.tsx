/**
 * المواد الزائدة عن الحاجة — تُعرض لكل المشاريع بدل شراء جديد.
 */
import { useState, type FormEvent } from "react";
import { Boxes, Plus, Trash2 } from "lucide-react";
import type {
  SurplusMaterialDto,
  SurplusStatus,
} from "@application/modules/warehouse/dtos";
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
import { useDebounce } from "@presentation/shared/hooks/useDebounce";
import { formatNumber } from "@presentation/shared/lib/formatters";
import { errorMessage } from "@presentation/shared/lib/query";
import { useProjects } from "@presentation/features/projects/hooks/useProjects";
import { useItemSearch } from "@presentation/features/catalog/hooks/useCatalog";
import {
  useRemoveSurplus,
  useSaveSurplus,
  useSurplusMaterials,
} from "../hooks/useWarehouse";
import { t } from "@i18n/index";

const STATUS_LABELS: Record<SurplusStatus, string> = {
  available: t.surplus.statusAvailable,
  reserved: t.surplus.statusReserved,
  transferred: t.surplus.statusTransferred,
};

const STATUS_TONES: Record<SurplusStatus, BadgeTone> = {
  available: "success",
  reserved: "warning",
  transferred: "neutral",
};

function SurplusModal({
  initial,
  onClose,
}: {
  initial: SurplusMaterialDto | null;
  onClose: () => void;
}) {
  const projects = useProjects();
  const save = useSaveSurplus();

  const [projectId, setProjectId] = useState(initial?.projectId ?? "");
  const [itemId, setItemId] = useState(initial?.itemId ?? "");
  const [qty, setQty] = useState(String(initial?.qty ?? 1));
  const [status, setStatus] = useState<SurplusStatus>(initial?.status ?? "available");
  const [note, setNote] = useState(initial?.note ?? "");
  const [itemQuery, setItemQuery] = useState("");
  const [error, setError] = useState<string | null>(null);

  const items = useItemSearch(useDebounce(itemQuery, 250));

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    try {
      await save.mutateAsync({
        id: initial?.id ?? null,
        projectId,
        itemId,
        qty: Number(qty),
        status,
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
      title={t.surplus.createTitle}
      footer={
        <>
          <Button
            type="submit"
            form="surplus-form"
            isLoading={save.isPending}
            disabled={projectId === "" || itemId === ""}
          >
            {t.common.save}
          </Button>
          <Button variant="ghost" onClick={onClose}>
            {t.common.cancel}
          </Button>
        </>
      }
    >
      <form id="surplus-form" onSubmit={handleSubmit} className="flex flex-col gap-4">
        <FormField label={t.surplus.project} required>
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
              required
            />
          )}
        </FormField>

        <FormField label={t.surplus.item} required>
          {(id) => (
            <div className="flex flex-col gap-2">
              <Input
                value={itemQuery}
                onChange={(e) => setItemQuery(e.target.value)}
                placeholder={t.items.searchPlaceholder}
                aria-label={t.common.search}
              />
              <Select
                id={id}
                options={(items.data ?? [])
                  .filter((item) => item.isActive)
                  .map((item) => ({
                    value: item.id,
                    label: `${item.code} — ${item.name}`,
                  }))}
                placeholder={t.materialRequests.pickItem}
                value={itemId}
                onChange={(e) => setItemId(e.target.value)}
                required
              />
            </div>
          )}
        </FormField>

        <div className="grid gap-4 sm:grid-cols-2">
          <FormField label={t.surplus.qty} required>
            {(id) => (
              <Input
                id={id}
                type="number"
                min="0.001"
                step="0.001"
                dir="ltr"
                value={qty}
                onChange={(e) => setQty(e.target.value)}
                required
              />
            )}
          </FormField>

          <FormField label={t.surplus.status}>
            {(id) => (
              <Select
                id={id}
                options={(Object.keys(STATUS_LABELS) as SurplusStatus[]).map((key) => ({
                  value: key,
                  label: STATUS_LABELS[key],
                }))}
                value={status}
                onChange={(e) => setStatus(e.target.value as SurplusStatus)}
              />
            )}
          </FormField>
        </div>

        <FormField label={t.surplus.note}>
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

export function SurplusPage() {
  const projects = useProjects();
  const [projectId, setProjectId] = useState("");
  const surplus = useSurplusMaterials(projectId === "" ? null : projectId);
  const remove = useRemoveSurplus();

  const [editing, setEditing] = useState<SurplusMaterialDto | null | "new">(null);
  const [error, setError] = useState<string | null>(null);

  async function handleRemove(row: SurplusMaterialDto) {
    if (!window.confirm(t.surplus.deleteConfirm)) return;
    setError(null);
    try {
      await remove.mutateAsync(row.id);
    } catch (e) {
      setError(errorMessage(e));
    }
  }

  const columns: readonly Column<SurplusMaterialDto>[] = [
    {
      key: "item",
      header: t.surplus.item,
      render: (row) => (
        <span>
          <span className="text-content block text-sm font-medium">{row.itemName}</span>
          <span className="text-content-muted font-mono text-xs">{row.itemCode}</span>
        </span>
      ),
    },
    {
      key: "project",
      header: t.surplus.project,
      render: (row) => <span className="text-sm">{row.projectName}</span>,
    },
    {
      key: "qty",
      header: t.surplus.qty,
      numeric: true,
      render: (row) => (
        <span className="tabular">
          {formatNumber(row.qty)} {row.itemUnit}
        </span>
      ),
    },
    {
      key: "status",
      header: t.surplus.status,
      render: (row) => (
        <Badge tone={STATUS_TONES[row.status]}>{STATUS_LABELS[row.status]}</Badge>
      ),
    },
    {
      key: "note",
      header: t.surplus.note,
      render: (row) => <span className="text-content-muted text-xs">{row.note}</span>,
    },
    {
      key: "actions",
      header: "",
      render: (row) => (
        <PermissionGate permission="surplus.manage">
          <span className="flex gap-1">
            <Button
              variant="ghost"
              size="sm"
              aria-label={t.common.edit}
              onClick={() => setEditing(row)}
              startIcon={<Boxes aria-hidden className="size-4" />}
            />
            <Button
              variant="ghost"
              size="sm"
              aria-label={t.common.delete}
              onClick={() => void handleRemove(row)}
              startIcon={<Trash2 aria-hidden className="text-danger size-4" />}
            />
          </span>
        </PermissionGate>
      ),
    },
  ];

  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-6">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-content text-xl font-extrabold">{t.surplus.title}</h1>
          <p className="text-content-muted mt-1 text-sm">{t.surplus.subtitle}</p>
        </div>
        <PermissionGate permission="surplus.manage">
          <Button
            onClick={() => setEditing("new")}
            startIcon={<Plus aria-hidden className="size-4" />}
          >
            {t.surplus.add}
          </Button>
        </PermissionGate>
      </header>

      <Card>
        <div className="max-w-sm">
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
            aria-label={t.surplus.project}
          />
        </div>
      </Card>

      {error !== null && (
        <p role="alert" className="text-danger text-sm">
          {error}
        </p>
      )}

      <Card>
        {surplus.isError ? (
          <EmptyState
            title={t.common.error}
            description={errorMessage(surplus.error)}
          />
        ) : (
          <DataTable
            columns={columns}
            rows={surplus.data ?? []}
            rowKey={(row) => row.id}
            isLoading={surplus.isLoading}
            emptyTitle={t.surplus.empty}
            emptyDescription={t.surplus.emptyHint}
          />
        )}
      </Card>

      {editing !== null && (
        <SurplusModal
          initial={editing === "new" ? null : editing}
          onClose={() => setEditing(null)}
        />
      )}
    </div>
  );
}
