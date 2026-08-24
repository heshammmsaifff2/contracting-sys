/**
 * المعدّات: الملف والصورة والصيانة والحركة بين المشاريع.
 * موقع المعدّة يتبع حركتها آليًا على الخادم، وإخلاؤها يعلنها شاغرة للجميع
 * ويُطلق إشعارًا — فلا يُستأجر ما هو متاح.
 */
import { useState, type FormEvent } from "react";
import { Truck, Wrench, Pencil, Plus, MapPin, Unplug } from "lucide-react";
import type { EquipmentDto } from "@application/modules/warehouse/dtos";
import type { StoredFile } from "@application/shared/ports/file-storage";
import type {
  EquipmentStatus,
  MaintenanceKind,
} from "@core/modules/warehouse/entities/Equipment";
import { Card } from "@presentation/shared/ui/Card";
import { Badge, type BadgeTone } from "@presentation/shared/ui/Badge";
import { Button } from "@presentation/shared/ui/Button";
import { Input } from "@presentation/shared/ui/Input";
import { Select } from "@presentation/shared/ui/Select";
import { Checkbox } from "@presentation/shared/ui/Checkbox";
import { FormField } from "@presentation/shared/ui/FormField";
import { Modal } from "@presentation/shared/ui/Modal";
import { EmptyState } from "@presentation/shared/ui/EmptyState";
import { FileUpload } from "@presentation/shared/ui/FileUpload";
import { PermissionGate } from "@presentation/shared/ui/PermissionGate";
import { useDebounce } from "@presentation/shared/hooks/useDebounce";
import {
  formatDate,
  formatMoney,
  formatNumber,
} from "@presentation/shared/lib/formatters";
import { errorMessage } from "@presentation/shared/lib/query";
import { useAppSettings } from "@presentation/app/providers/settings-context";
import { STORAGE_ROOT } from "@config/app";
import {
  useProjectMembers,
  useProjects,
} from "@presentation/features/projects/hooks/useProjects";
import {
  useAddMaintenance,
  useEquipment,
  useEquipmentMovements,
  useIdleEquipment,
  useMaintenance,
  useMoveEquipment,
  useReleaseEquipment,
  useSaveEquipment,
} from "../hooks/useWarehouse";
import { t } from "@i18n/index";

const STATUS_LABELS: Record<EquipmentStatus, string> = {
  working: t.equipment.statusWorking,
  idle: t.equipment.statusIdle,
  maintenance: t.equipment.statusMaintenance,
  out_of_service: t.equipment.statusOut,
};

const STATUS_TONES: Record<EquipmentStatus, BadgeTone> = {
  working: "success",
  idle: "info",
  maintenance: "warning",
  out_of_service: "danger",
};

const STATUS_OPTIONS = (Object.keys(STATUS_LABELS) as EquipmentStatus[]).map(
  (status) => ({ value: status, label: STATUS_LABELS[status] }),
);

/** المواصفات الحرّة تُحرَّر «مفتاح: قيمة» في كل سطر بدل نموذج جامد. */
function specToText(spec: Readonly<Record<string, unknown>>): string {
  return Object.entries(spec)
    .map(([key, value]) => `${key}: ${String(value)}`)
    .join("\n");
}

function textToSpec(text: string): Record<string, unknown> {
  const spec: Record<string, unknown> = {};
  for (const line of text.split("\n")) {
    const separator = line.indexOf(":");
    if (separator <= 0) continue;
    const key = line.slice(0, separator).trim();
    const value = line.slice(separator + 1).trim();
    if (key !== "") spec[key] = value;
  }
  return spec;
}

function EquipmentModal({
  initial,
  onClose,
}: {
  initial: EquipmentDto | null;
  onClose: () => void;
}) {
  const save = useSaveEquipment();
  const [code, setCode] = useState(initial?.code ?? "");
  const [name, setName] = useState(initial?.name ?? "");
  const [category, setCategory] = useState(initial?.category ?? "");
  const [status, setStatus] = useState<EquipmentStatus>(initial?.status ?? "idle");
  const [acquiredAt, setAcquiredAt] = useState(initial?.acquiredAt ?? "");
  const [specText, setSpecText] = useState(specToText(initial?.spec ?? {}));
  const [photo, setPhoto] = useState<StoredFile | null>(initial?.photo ?? null);
  const [isActive, setIsActive] = useState(initial?.isActive ?? true);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    try {
      await save.mutateAsync({
        id: initial?.id ?? null,
        code,
        name,
        category,
        status,
        spec: textToSpec(specText),
        photo,
        acquiredAt: acquiredAt === "" ? null : acquiredAt,
        isActive,
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
      title={initial === null ? t.equipment.createTitle : t.equipment.editTitle}
      footer={
        <>
          <Button type="submit" form="equipment-form" isLoading={save.isPending}>
            {t.common.save}
          </Button>
          <Button variant="ghost" onClick={onClose}>
            {t.common.cancel}
          </Button>
        </>
      }
    >
      <form id="equipment-form" onSubmit={handleSubmit} className="flex flex-col gap-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <FormField label={t.equipment.code} required>
            {(id) => (
              <Input
                id={id}
                dir="ltr"
                value={code}
                onChange={(e) => setCode(e.target.value)}
                required
              />
            )}
          </FormField>

          <FormField label={t.equipment.name} required>
            {(id) => (
              <Input
                id={id}
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
              />
            )}
          </FormField>

          <FormField label={t.equipment.category}>
            {(id) => (
              <Input
                id={id}
                value={category}
                onChange={(e) => setCategory(e.target.value)}
              />
            )}
          </FormField>

          <FormField label={t.equipment.status}>
            {(id) => (
              <Select
                id={id}
                options={STATUS_OPTIONS}
                value={status}
                onChange={(e) => setStatus(e.target.value as EquipmentStatus)}
              />
            )}
          </FormField>

          <FormField label={t.equipment.acquiredAt}>
            {(id) => (
              <Input
                id={id}
                type="date"
                dir="ltr"
                value={acquiredAt}
                onChange={(e) => setAcquiredAt(e.target.value)}
              />
            )}
          </FormField>
        </div>

        <FormField label={t.equipment.spec} hint={t.equipment.specHint}>
          {(id) => (
            <textarea
              id={id}
              rows={4}
              value={specText}
              onChange={(e) => setSpecText(e.target.value)}
              className="border-border-strong bg-surface text-content w-full rounded-[var(--radius-control)] border px-3 py-2 text-sm"
            />
          )}
        </FormField>

        <div className="flex flex-col gap-2">
          <span className="text-content text-sm font-medium">{t.equipment.photo}</span>
          <FileUpload
            folder={`${STORAGE_ROOT}/equipment`}
            accept="image/*"
            value={photo}
            onChange={setPhoto}
          />
        </div>

        <Checkbox
          label={t.equipment.active}
          checked={isActive}
          onChange={(e) => setIsActive(e.target.checked)}
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

function MaintenanceModal({
  equipment,
  onClose,
}: {
  equipment: EquipmentDto;
  onClose: () => void;
}) {
  const list = useMaintenance(equipment.id);
  const add = useAddMaintenance(equipment.id);
  const { currency } = useAppSettings();

  const [kind, setKind] = useState<MaintenanceKind>("repair");
  const [part, setPart] = useState("");
  const [notes, setNotes] = useState("");
  const [cost, setCost] = useState("0");
  const [performedAt, setPerformedAt] = useState(new Date().toISOString().slice(0, 10));
  const [nextDueAt, setNextDueAt] = useState("");
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    try {
      await add.mutateAsync({
        equipmentId: equipment.id,
        kind,
        part,
        notes,
        cost: Number(cost),
        performedAt,
        nextDueAt: nextDueAt === "" ? null : nextDueAt,
      });
      setPart("");
      setNotes("");
      setCost("0");
    } catch (e) {
      setError(errorMessage(e));
    }
  }

  return (
    <Modal
      isOpen
      onClose={onClose}
      title={`${t.equipment.maintenanceTitle} — ${equipment.name}`}
      footer={
        <Button variant="ghost" onClick={onClose}>
          {t.common.close}
        </Button>
      }
    >
      <div className="flex flex-col gap-5">
        <PermissionGate permission="equipment.manage">
          <form onSubmit={handleSubmit} className="flex flex-col gap-3">
            <div className="grid gap-3 sm:grid-cols-2">
              <FormField label={t.equipment.maintenanceKind}>
                {(id) => (
                  <Select
                    id={id}
                    options={[
                      { value: "repair", label: t.equipment.kindRepair },
                      { value: "periodic", label: t.equipment.kindPeriodic },
                    ]}
                    value={kind}
                    onChange={(e) => setKind(e.target.value as MaintenanceKind)}
                  />
                )}
              </FormField>

              <FormField label={t.equipment.part}>
                {(id) => (
                  <Input
                    id={id}
                    value={part}
                    onChange={(e) => setPart(e.target.value)}
                  />
                )}
              </FormField>

              <FormField label={t.equipment.cost}>
                {(id) => (
                  <Input
                    id={id}
                    type="number"
                    min="0"
                    step="0.01"
                    dir="ltr"
                    value={cost}
                    onChange={(e) => setCost(e.target.value)}
                  />
                )}
              </FormField>

              <FormField label={t.equipment.performedAt} required>
                {(id) => (
                  <Input
                    id={id}
                    type="date"
                    dir="ltr"
                    value={performedAt}
                    onChange={(e) => setPerformedAt(e.target.value)}
                    required
                  />
                )}
              </FormField>

              <FormField label={t.equipment.nextDueAt}>
                {(id) => (
                  <Input
                    id={id}
                    type="date"
                    dir="ltr"
                    value={nextDueAt}
                    onChange={(e) => setNextDueAt(e.target.value)}
                  />
                )}
              </FormField>

              <FormField label={t.equipment.notes}>
                {(id) => (
                  <Input
                    id={id}
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                  />
                )}
              </FormField>
            </div>

            <div>
              <Button
                type="submit"
                isLoading={add.isPending}
                startIcon={<Plus aria-hidden className="size-4" />}
              >
                {t.equipment.maintenanceAdd}
              </Button>
            </div>

            {error !== null && (
              <p role="alert" className="text-danger text-sm">
                {error}
              </p>
            )}
          </form>
        </PermissionGate>

        <ul className="divide-border divide-y">
          {(list.data ?? []).map((row) => (
            <li key={row.id} className="flex flex-wrap items-center gap-2 py-2">
              <Badge tone={row.kind === "periodic" ? "info" : "warning"}>
                {row.kind === "periodic"
                  ? t.equipment.kindPeriodic
                  : t.equipment.kindRepair}
              </Badge>
              <span className="text-content flex-1 text-sm">
                {row.part === "" ? row.notes : row.part}
              </span>
              <span className="tabular text-content-muted text-xs">
                {formatDate(row.performedAt)} · {formatMoney(row.cost, currency)}
              </span>
            </li>
          ))}
          {(list.data ?? []).length === 0 && (
            <li className="py-2">
              <EmptyState title={t.equipment.maintenanceEmpty} />
            </li>
          )}
        </ul>
      </div>
    </Modal>
  );
}

function MoveModal({
  equipment,
  onClose,
}: {
  equipment: EquipmentDto;
  onClose: () => void;
}) {
  const projects = useProjects();
  const move = useMoveEquipment();
  const movements = useEquipmentMovements(equipment.id);

  const [projectId, setProjectId] = useState("");
  const [fromDate, setFromDate] = useState(new Date().toISOString().slice(0, 10));
  // المشرف المستلم من فريق المشروع المنقول إليه
  const [supervisorId, setSupervisorId] = useState("");
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);
  const members = useProjectMembers(projectId === "" ? null : projectId);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    try {
      await move.mutateAsync({
        equipmentId: equipment.id,
        projectId,
        fromDate,
        supervisorId: supervisorId === "" ? null : supervisorId,
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
      title={`${t.equipment.moveTitle} — ${equipment.name}`}
      footer={
        <>
          <Button
            type="submit"
            form="move-form"
            isLoading={move.isPending}
            disabled={projectId === ""}
          >
            {t.common.save}
          </Button>
          <Button variant="ghost" onClick={onClose}>
            {t.common.cancel}
          </Button>
        </>
      }
    >
      <form id="move-form" onSubmit={handleSubmit} className="flex flex-col gap-4">
        <FormField label={t.equipment.currentProject}>
          {() => (
            <p className="text-content-muted text-sm">
              {equipment.currentProjectName === ""
                ? t.equipment.noProject
                : equipment.currentProjectName}
            </p>
          )}
        </FormField>

        <FormField label={t.custody.project} required>
          {(id) => (
            <Select
              id={id}
              options={(projects.data ?? [])
                .filter((project) => project.id !== equipment.currentProjectId)
                .map((project) => ({
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

        <div className="grid gap-4 sm:grid-cols-2">
          <FormField label={t.equipment.fromDate} required>
            {(id) => (
              <Input
                id={id}
                type="date"
                dir="ltr"
                value={fromDate}
                onChange={(e) => setFromDate(e.target.value)}
                required
              />
            )}
          </FormField>

          <FormField label={t.equipment.supervisor}>
            {(id) => (
              <Select
                id={id}
                options={(members.data ?? []).map((member) => ({
                  value: member.userId,
                  label: member.fullName,
                }))}
                placeholder={t.common.all}
                value={supervisorId}
                onChange={(e) => setSupervisorId(e.target.value)}
              />
            )}
          </FormField>
        </div>

        <FormField label={t.equipment.note}>
          {(id) => (
            <Input id={id} value={note} onChange={(e) => setNote(e.target.value)} />
          )}
        </FormField>

        <div>
          <h3 className="text-content mb-2 text-sm font-bold">
            {t.equipment.movements}
          </h3>
          <ul className="divide-border divide-y">
            {(movements.data ?? []).map((row) => (
              <li key={row.id} className="flex flex-wrap items-center gap-2 py-2">
                <span className="text-content flex-1 text-sm">{row.projectName}</span>
                <span className="tabular text-content-muted text-xs">
                  {formatDate(row.fromDate)} →{" "}
                  {row.toDate === null ? "…" : formatDate(row.toDate)}
                </span>
              </li>
            ))}
            {(movements.data ?? []).length === 0 && (
              <li className="py-2">
                <EmptyState title={t.equipment.movementsEmpty} />
              </li>
            )}
          </ul>
        </div>

        {error !== null && (
          <p role="alert" className="text-danger text-sm">
            {error}
          </p>
        )}
      </form>
    </Modal>
  );
}

function ReleaseModal({
  equipment,
  onClose,
}: {
  equipment: EquipmentDto;
  onClose: () => void;
}) {
  const release = useReleaseEquipment();
  const [toDate, setToDate] = useState(new Date().toISOString().slice(0, 10));
  const [availableTo, setAvailableTo] = useState("");
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    try {
      await release.mutateAsync({
        equipmentId: equipment.id,
        toDate,
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
      title={`${t.equipment.releaseTitle} — ${equipment.name}`}
      footer={
        <>
          <Button type="submit" form="release-form" isLoading={release.isPending}>
            {t.common.save}
          </Button>
          <Button variant="ghost" onClick={onClose}>
            {t.common.cancel}
          </Button>
        </>
      }
    >
      <form id="release-form" onSubmit={handleSubmit} className="flex flex-col gap-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <FormField label={t.equipment.toDate} required>
            {(id) => (
              <Input
                id={id}
                type="date"
                dir="ltr"
                value={toDate}
                onChange={(e) => setToDate(e.target.value)}
                required
              />
            )}
          </FormField>

          <FormField label={t.equipment.availableTo}>
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

        <FormField label={t.equipment.note}>
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

export function EquipmentPage() {
  const [query, setQuery] = useState("");
  const equipment = useEquipment(useDebounce(query, 250));
  const idle = useIdleEquipment();
  const { currency } = useAppSettings();

  const [editing, setEditing] = useState<EquipmentDto | null | "new">(null);
  const [maintenanceFor, setMaintenanceFor] = useState<EquipmentDto | null>(null);
  const [movingFor, setMovingFor] = useState<EquipmentDto | null>(null);
  const [releasingFor, setReleasingFor] = useState<EquipmentDto | null>(null);

  const rows = equipment.data ?? [];

  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-6">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-content text-xl font-extrabold">{t.equipment.title}</h1>
          <p className="text-content-muted mt-1 text-sm">{t.equipment.subtitle}</p>
        </div>
        <PermissionGate permission="equipment.manage">
          <Button
            onClick={() => setEditing("new")}
            startIcon={<Plus aria-hidden className="size-4" />}
          >
            {t.equipment.add}
          </Button>
        </PermissionGate>
      </header>

      <Card>
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={t.equipment.search}
          aria-label={t.common.search}
          className="max-w-sm"
        />
      </Card>

      {(idle.data ?? []).length > 0 && (
        <Card title={t.equipment.idle}>
          <ul className="divide-border divide-y">
            {(idle.data ?? []).map((row) => (
              <li key={row.id} className="flex flex-wrap items-center gap-2 py-2">
                <Badge tone="info">{t.equipment.statusIdle}</Badge>
                <span className="text-content flex-1 text-sm">
                  {row.equipmentName}
                  <span className="text-content-muted ms-2 font-mono text-xs">
                    {row.equipmentCode}
                  </span>
                </span>
                <span className="tabular text-content-muted text-xs">
                  {t.equipment.availableFrom}: {formatDate(row.availableFrom)}
                  {row.availableTo !== null && ` → ${formatDate(row.availableTo)}`}
                </span>
              </li>
            ))}
          </ul>
        </Card>
      )}

      {equipment.isError && (
        <Card>
          <EmptyState
            title={t.common.error}
            description={errorMessage(equipment.error)}
          />
        </Card>
      )}

      {!equipment.isError && rows.length === 0 && (
        <Card>
          <EmptyState title={t.equipment.empty} description={t.equipment.emptyHint} />
        </Card>
      )}

      <div className="grid gap-4 md:grid-cols-2">
        {rows.map((row) => (
          <Card
            key={row.id}
            title={
              <span className="flex flex-wrap items-center gap-2">
                <Truck aria-hidden className="size-4" />
                <span className="text-sm">{row.name}</span>
                <span className="text-content-muted font-mono text-xs">{row.code}</span>
                <Badge tone={STATUS_TONES[row.status]}>
                  {STATUS_LABELS[row.status]}
                </Badge>
              </span>
            }
            description={
              row.currentProjectName === ""
                ? t.equipment.noProject
                : `${t.equipment.currentProject}: ${row.currentProjectName}`
            }
          >
            <div className="flex flex-wrap items-start gap-4">
              {row.photo !== null && (
                <img
                  src={row.photo.url}
                  alt={row.name}
                  className="border-border size-24 rounded-[var(--radius-control)] border object-cover"
                />
              )}

              <dl className="min-w-40 flex-1 text-xs">
                {Object.entries(row.spec).map(([key, value]) => (
                  <div key={key} className="flex gap-2 py-0.5">
                    <dt className="text-content-muted">{key}:</dt>
                    <dd className="text-content">{String(value)}</dd>
                  </div>
                ))}
                <div className="flex gap-2 py-0.5">
                  <dt className="text-content-muted">
                    {t.equipment.maintenanceCount}:
                  </dt>
                  <dd className="text-content tabular">
                    {formatNumber(row.maintenanceCount)} ·{" "}
                    {formatMoney(row.maintenanceCost, currency)}
                  </dd>
                </div>
              </dl>
            </div>

            <div className="mt-3 flex flex-wrap gap-2">
              <PermissionGate permission="equipment.manage">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setEditing(row)}
                  startIcon={<Pencil aria-hidden className="size-4" />}
                >
                  {t.common.edit}
                </Button>
              </PermissionGate>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setMaintenanceFor(row)}
                startIcon={<Wrench aria-hidden className="size-4" />}
              >
                {t.equipment.maintenance}
              </Button>
              <PermissionGate permission="equipment.move">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setMovingFor(row)}
                  startIcon={<MapPin aria-hidden className="size-4" />}
                >
                  {t.equipment.move}
                </Button>
              </PermissionGate>
              <PermissionGate permission="equipment.move">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setReleasingFor(row)}
                  startIcon={<Unplug aria-hidden className="size-4" />}
                >
                  {t.equipment.release}
                </Button>
              </PermissionGate>
            </div>
          </Card>
        ))}
      </div>

      {editing !== null && (
        <EquipmentModal
          initial={editing === "new" ? null : editing}
          onClose={() => setEditing(null)}
        />
      )}
      {maintenanceFor !== null && (
        <MaintenanceModal
          equipment={maintenanceFor}
          onClose={() => setMaintenanceFor(null)}
        />
      )}
      {movingFor !== null && (
        <MoveModal equipment={movingFor} onClose={() => setMovingFor(null)} />
      )}
      {releasingFor !== null && (
        <ReleaseModal equipment={releasingFor} onClose={() => setReleasingFor(null)} />
      )}
    </div>
  );
}
