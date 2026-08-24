/**
 * المنشآت — تجمّع ← حي ← منشأة.
 * الوزن النسبي يُدخَل هنا مرة واحدة، ثم تُقاس عليه كل مقارنات الاستهلاك
 * وكشف الهدر دون إدخال أي رقم ثانٍ [المخازن 9].
 */
import { useState, type FormEvent } from "react";
import { Pencil, Plus, Trash2 } from "lucide-react";
import type { FacilityDto } from "@application/modules/warehouse/dtos";
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
import { PermissionGate } from "@presentation/shared/ui/PermissionGate";
import { formatNumber } from "@presentation/shared/lib/formatters";
import { errorMessage } from "@presentation/shared/lib/query";
import { useProjects } from "@presentation/features/projects/hooks/useProjects";
import {
  useFacilities,
  useRemoveFacility,
  useSaveFacility,
} from "../hooks/useWarehouse";
import { t } from "@i18n/index";

interface FormState {
  id: string | null;
  projectId: string;
  code: string;
  groupName: string;
  district: string;
  name: string;
  weight: string;
  isActive: boolean;
}

function emptyForm(projectId: string): FormState {
  return {
    id: null,
    projectId,
    code: "",
    groupName: "",
    district: "",
    name: "",
    weight: "1",
    isActive: true,
  };
}

function toForm(facility: FacilityDto): FormState {
  return {
    id: facility.id,
    projectId: facility.projectId,
    code: facility.code,
    groupName: facility.groupName,
    district: facility.district,
    name: facility.name,
    weight: String(facility.weight),
    isActive: facility.isActive,
  };
}

function FacilityModal({
  initial,
  onClose,
}: {
  initial: FormState;
  onClose: () => void;
}) {
  const projects = useProjects();
  const save = useSaveFacility();
  const [form, setForm] = useState(initial);
  const [error, setError] = useState<string | null>(null);

  const projectOptions = (projects.data ?? []).map((project) => ({
    value: project.id,
    label: `${project.code} — ${project.name}`,
  }));

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    try {
      await save.mutateAsync({
        id: form.id,
        projectId: form.projectId,
        code: form.code,
        groupName: form.groupName,
        district: form.district,
        name: form.name,
        weight: Number(form.weight),
        isActive: form.isActive,
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
      title={form.id === null ? t.facilities.createTitle : t.facilities.editTitle}
      footer={
        <>
          <Button type="submit" form="facility-form" isLoading={save.isPending}>
            {t.common.save}
          </Button>
          <Button variant="ghost" onClick={onClose}>
            {t.common.cancel}
          </Button>
        </>
      }
    >
      <form id="facility-form" onSubmit={handleSubmit} className="flex flex-col gap-4">
        <FormField label={t.facilities.project} required>
          {(id) => (
            <Select
              id={id}
              options={projectOptions}
              placeholder={t.limits.pickProject}
              value={form.projectId}
              onChange={(e) => setForm({ ...form, projectId: e.target.value })}
              required
            />
          )}
        </FormField>

        <div className="grid gap-4 sm:grid-cols-2">
          <FormField label={t.facilities.code} required>
            {(id) => (
              <Input
                id={id}
                dir="ltr"
                value={form.code}
                onChange={(e) => setForm({ ...form, code: e.target.value })}
                required
              />
            )}
          </FormField>

          <FormField label={t.facilities.name} required>
            {(id) => (
              <Input
                id={id}
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                required
              />
            )}
          </FormField>

          <FormField label={t.facilities.group}>
            {(id) => (
              <Input
                id={id}
                value={form.groupName}
                onChange={(e) => setForm({ ...form, groupName: e.target.value })}
              />
            )}
          </FormField>

          <FormField label={t.facilities.district}>
            {(id) => (
              <Input
                id={id}
                value={form.district}
                onChange={(e) => setForm({ ...form, district: e.target.value })}
              />
            )}
          </FormField>
        </div>

        <FormField label={t.facilities.weight} hint={t.facilities.weightHint} required>
          {(id) => (
            <Input
              id={id}
              type="number"
              min="0.001"
              step="0.001"
              dir="ltr"
              value={form.weight}
              onChange={(e) => setForm({ ...form, weight: e.target.value })}
              required
            />
          )}
        </FormField>

        <Checkbox
          label={t.facilities.active}
          checked={form.isActive}
          onChange={(e) => setForm({ ...form, isActive: e.target.checked })}
        />

        {error !== null && (
          <p role="alert" className="text-danger text-sm">
            {error}
          </p>
        )}
      </form>
    </Modal>
  );
}

export function FacilitiesPage() {
  const projects = useProjects();
  const [projectId, setProjectId] = useState<string>("");
  const facilities = useFacilities(projectId === "" ? null : projectId);
  const remove = useRemoveFacility();

  const [editing, setEditing] = useState<FormState | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleRemove(facility: FacilityDto) {
    if (!window.confirm(t.facilities.deleteConfirm)) return;
    setError(null);
    try {
      await remove.mutateAsync(facility.id);
    } catch (e) {
      setError(errorMessage(e));
    }
  }

  const columns: readonly Column<FacilityDto>[] = [
    {
      key: "code",
      header: t.facilities.code,
      render: (row) => <span className="font-mono text-xs">{row.code}</span>,
    },
    {
      key: "name",
      header: t.facilities.name,
      render: (row) => (
        <span>
          <span className="text-content block text-sm font-medium">{row.name}</span>
          <span className="text-content-muted block text-xs">
            {[row.groupName, row.district].filter((p) => p !== "").join(" ← ")}
          </span>
        </span>
      ),
    },
    {
      key: "project",
      header: t.facilities.project,
      render: (row) => <span className="text-sm">{row.projectName}</span>,
    },
    {
      key: "weight",
      header: t.facilities.weight,
      numeric: true,
      render: (row) => <span className="tabular">{formatNumber(row.weight)}</span>,
    },
    {
      key: "status",
      header: t.common.status,
      render: (row) => (
        <Badge tone={row.isActive ? "success" : "neutral"}>
          {row.isActive ? t.facilities.active : t.facilities.inactive}
        </Badge>
      ),
    },
    {
      key: "actions",
      header: "",
      render: (row) => (
        <PermissionGate permission="facility.manage">
          <span className="flex gap-1">
            <Button
              variant="ghost"
              size="sm"
              aria-label={t.common.edit}
              onClick={() => setEditing(toForm(row))}
              startIcon={<Pencil aria-hidden className="size-4" />}
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
          <h1 className="text-content text-xl font-extrabold">{t.facilities.title}</h1>
          <p className="text-content-muted mt-1 text-sm">{t.facilities.subtitle}</p>
        </div>
        <PermissionGate permission="facility.manage">
          <Button
            onClick={() => setEditing(emptyForm(projectId))}
            startIcon={<Plus aria-hidden className="size-4" />}
          >
            {t.facilities.add}
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
            aria-label={t.facilities.project}
          />
        </div>
      </Card>

      {error !== null && (
        <p role="alert" className="text-danger text-sm">
          {error}
        </p>
      )}

      <Card>
        {facilities.isError ? (
          <EmptyState
            title={t.common.error}
            description={errorMessage(facilities.error)}
          />
        ) : (
          <DataTable
            columns={columns}
            rows={facilities.data ?? []}
            rowKey={(row) => row.id}
            isLoading={facilities.isLoading}
            emptyTitle={t.facilities.empty}
            emptyDescription={t.facilities.emptyHint}
          />
        )}
      </Card>

      {editing !== null && (
        <FacilityModal initial={editing} onClose={() => setEditing(null)} />
      )}
    </div>
  );
}
