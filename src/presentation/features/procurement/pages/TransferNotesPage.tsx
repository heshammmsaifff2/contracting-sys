/**
 * سندات نقل الأصناف بين المواقع.
 * الاعتماد يُطلق قيدًا ينقل ثمن المادة من مخزون الموقع المُرسِل
 * إلى المستقبِل آليًا [المشتريات 9].
 */
import { useState, type FormEvent } from "react";
import { ArrowLeftRight, CheckCircle2, Plus, Trash2 } from "lucide-react";
import type { TransferNoteDto } from "@application/modules/procurement/dtos";
import { Card } from "@presentation/shared/ui/Card";
import { Badge, type BadgeTone } from "@presentation/shared/ui/Badge";
import { Button } from "@presentation/shared/ui/Button";
import { Input } from "@presentation/shared/ui/Input";
import { Select } from "@presentation/shared/ui/Select";
import { FormField } from "@presentation/shared/ui/FormField";
import { Modal } from "@presentation/shared/ui/Modal";
import { EmptyState } from "@presentation/shared/ui/EmptyState";
import { PermissionGate } from "@presentation/shared/ui/PermissionGate";
import { useDebounce } from "@presentation/shared/hooks/useDebounce";
import { formatMoney, formatNumber } from "@presentation/shared/lib/formatters";
import { errorMessage } from "@presentation/shared/lib/query";
import { useAppSettings } from "@presentation/app/providers/settings-context";
import { useProjects } from "@presentation/features/projects/hooks/useProjects";
import { useItemSearch } from "@presentation/features/catalog/hooks/useCatalog";
import {
  useApproveTransferNote,
  useCreateTransferNote,
  useTransferNotes,
} from "../hooks/useProcurement";
import { t } from "@i18n/index";

const STATUS_LABELS: Record<TransferNoteDto["status"], string> = {
  draft: t.transferNotes.statusDraft,
  approved: t.transferNotes.statusApproved,
  cancelled: t.transferNotes.statusCancelled,
};

const STATUS_TONES: Record<TransferNoteDto["status"], BadgeTone> = {
  draft: "neutral",
  approved: "success",
  cancelled: "danger",
};

interface DraftLine {
  itemId: string;
  itemCode: string;
  itemName: string;
  itemUnit: string;
  qty: number;
  unitCost: number;
}

function CreateModal({ onClose }: { onClose: () => void }) {
  const projects = useProjects();
  const create = useCreateTransferNote();

  const [fromProjectId, setFromProjectId] = useState("");
  const [toProjectId, setToProjectId] = useState("");
  const [notes, setNotes] = useState("");
  const [lines, setLines] = useState<DraftLine[]>([]);
  const [itemQuery, setItemQuery] = useState("");
  const [pickedItemId, setPickedItemId] = useState("");
  const [error, setError] = useState<string | null>(null);

  const items = useItemSearch(useDebounce(itemQuery, 250));
  const projectOptions = (projects.data ?? []).map((project) => ({
    value: project.id,
    label: `${project.code} — ${project.name}`,
  }));

  const usedIds = new Set(lines.map((line) => line.itemId));
  const itemOptions = (items.data ?? [])
    .filter((item) => item.isActive && !usedIds.has(item.id))
    .map((item) => ({ value: item.id, label: `${item.code} — ${item.name}` }));

  function addLine() {
    const item = (items.data ?? []).find((i) => i.id === pickedItemId);
    if (item === undefined) return;
    setLines([
      ...lines,
      {
        itemId: item.id,
        itemCode: item.code,
        itemName: item.name,
        itemUnit: item.unit,
        qty: 1,
        unitCost: 0,
      },
    ]);
    setPickedItemId("");
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    try {
      await create.mutateAsync({
        fromProjectId,
        toProjectId,
        notes,
        lines: lines.map((line) => ({
          itemId: line.itemId,
          qty: line.qty,
          unitCost: line.unitCost,
        })),
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
      title={t.transferNotes.createTitle}
      footer={
        <>
          <Button
            type="submit"
            form="transfer-form"
            isLoading={create.isPending}
            disabled={fromProjectId === "" || toProjectId === "" || lines.length === 0}
          >
            {t.common.save}
          </Button>
          <Button variant="ghost" onClick={onClose}>
            {t.common.cancel}
          </Button>
        </>
      }
    >
      <form id="transfer-form" onSubmit={handleSubmit} className="flex flex-col gap-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <FormField label={t.transferNotes.fromProject} required>
            {(id) => (
              <Select
                id={id}
                options={projectOptions}
                placeholder={t.limits.pickProject}
                value={fromProjectId}
                onChange={(e) => setFromProjectId(e.target.value)}
                required
              />
            )}
          </FormField>

          <FormField label={t.transferNotes.toProject} required>
            {(id) => (
              <Select
                id={id}
                options={projectOptions.filter((o) => o.value !== fromProjectId)}
                placeholder={t.limits.pickProject}
                value={toProjectId}
                onChange={(e) => setToProjectId(e.target.value)}
                required
              />
            )}
          </FormField>
        </div>

        <FormField label={t.settingsPage.description}>
          {(id) => (
            <Input id={id} value={notes} onChange={(e) => setNotes(e.target.value)} />
          )}
        </FormField>

        <div className="bg-surface-sunken flex flex-wrap items-end gap-3 rounded-[var(--radius-control)] p-3">
          <div className="min-w-56 flex-1">
            <Input
              value={itemQuery}
              onChange={(e) => setItemQuery(e.target.value)}
              placeholder={t.items.searchPlaceholder}
              aria-label={t.common.search}
              className="mb-2"
            />
            <Select
              options={itemOptions}
              placeholder={t.materialRequests.pickItem}
              value={pickedItemId}
              onChange={(e) => setPickedItemId(e.target.value)}
              aria-label={t.materialRequests.pickItem}
            />
          </div>
          <Button
            onClick={addLine}
            disabled={pickedItemId === ""}
            startIcon={<Plus aria-hidden className="size-4" />}
          >
            {t.materialRequests.addLine}
          </Button>
        </div>

        <ul className="divide-border divide-y">
          {lines.map((line) => (
            <li key={line.itemId} className="flex flex-wrap items-center gap-3 py-2.5">
              <span className="min-w-0 flex-1">
                <span className="text-content block text-sm font-medium">
                  {line.itemName}
                </span>
                <span className="text-content-muted font-mono text-xs">
                  {line.itemCode}
                </span>
              </span>
              <Input
                type="number"
                min="0.001"
                step="0.001"
                dir="ltr"
                className="h-8 w-24"
                aria-label={t.transferNotes.qty}
                value={String(line.qty)}
                onChange={(e) =>
                  setLines(
                    lines.map((l) =>
                      l.itemId === line.itemId
                        ? { ...l, qty: Number(e.target.value) }
                        : l,
                    ),
                  )
                }
              />
              <Input
                type="number"
                min="0"
                step="0.01"
                dir="ltr"
                className="h-8 w-28"
                aria-label={t.transferNotes.unitCost}
                value={String(line.unitCost)}
                onChange={(e) =>
                  setLines(
                    lines.map((l) =>
                      l.itemId === line.itemId
                        ? { ...l, unitCost: Number(e.target.value) }
                        : l,
                    ),
                  )
                }
              />
              <Button
                variant="ghost"
                size="sm"
                aria-label={t.common.delete}
                onClick={() => setLines(lines.filter((l) => l.itemId !== line.itemId))}
                startIcon={<Trash2 aria-hidden className="text-danger size-4" />}
              />
            </li>
          ))}
        </ul>

        {error !== null && (
          <p role="alert" className="text-danger text-sm">
            {error}
          </p>
        )}
      </form>
    </Modal>
  );
}

export function TransferNotesPage() {
  const notes = useTransferNotes();
  const approve = useApproveTransferNote();
  const { currency } = useAppSettings();

  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleApprove(note: TransferNoteDto) {
    if (!window.confirm(t.transferNotes.approveHint)) return;
    setMessage(null);
    setError(null);
    try {
      const result = await approve.mutateAsync(note.id);
      setMessage(`${t.transferNotes.approved} ${result.entryId.slice(0, 8)}`);
    } catch (e) {
      setError(errorMessage(e));
    }
  }

  const rows = notes.data ?? [];

  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-6">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-content text-xl font-extrabold">
            {t.transferNotes.title}
          </h1>
          <p className="text-content-muted mt-1 text-sm">{t.transferNotes.subtitle}</p>
        </div>
        <PermissionGate permission="transfer_note.manage">
          <Button
            onClick={() => setIsCreateOpen(true)}
            startIcon={<ArrowLeftRight aria-hidden className="size-4" />}
          >
            {t.transferNotes.add}
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

      {notes.isError && (
        <Card>
          <EmptyState title={t.common.error} description={errorMessage(notes.error)} />
        </Card>
      )}

      {!notes.isError && rows.length === 0 && (
        <Card>
          <EmptyState title={t.transferNotes.empty} />
        </Card>
      )}

      {rows.map((note) => (
        <Card
          key={note.id}
          title={
            <span className="flex flex-wrap items-center gap-2">
              <span className="tabular font-mono">#{note.no}</span>
              <span className="text-sm">
                {note.fromProjectName} ← {note.toProjectName}
              </span>
              <Badge tone={STATUS_TONES[note.status]}>
                {STATUS_LABELS[note.status]}
              </Badge>
            </span>
          }
          description={`${t.transferNotes.total}: ${formatMoney(note.total, currency)}`}
          actions={
            note.status === "draft" ? (
              <PermissionGate permission="transfer_note.approve">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => void handleApprove(note)}
                  isLoading={approve.isPending}
                  startIcon={<CheckCircle2 aria-hidden className="size-4" />}
                >
                  {t.transferNotes.approve}
                </Button>
              </PermissionGate>
            ) : undefined
          }
        >
          <ul className="divide-border divide-y">
            {note.lines.map((line) => (
              <li
                key={line.id}
                className="flex flex-wrap items-center justify-between gap-2 py-2"
              >
                <span className="text-content text-sm">
                  {line.itemName}
                  <span className="text-content-muted ms-2 font-mono text-xs">
                    {line.itemCode}
                  </span>
                </span>
                <span className="tabular text-content-muted text-xs">
                  {formatNumber(line.qty)} {line.itemUnit} ×{" "}
                  {formatMoney(line.unitCost, currency)} ={" "}
                  <span className="text-content font-medium">
                    {formatMoney(line.qty * line.unitCost, currency)}
                  </span>
                </span>
              </li>
            ))}
          </ul>
        </Card>
      ))}

      {isCreateOpen && <CreateModal onClose={() => setIsCreateOpen(false)} />}
    </div>
  );
}
