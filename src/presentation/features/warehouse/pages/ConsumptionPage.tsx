/**
 * تنزيل الكميات على المنشآت.
 * أثر واحد لثلاثة أشياء: ينقص عهدة المندوب، يُسجَّل الاستهلاك بصوره،
 * ويصل إشعار فوري لأصحاب الصلاحية [المخازن 18، 19].
 * الأصناف تأتي من عهدة المندوب نفسها — لا كتابة أصناف من جديد.
 */
import { useMemo, useState, type FormEvent } from "react";
import { Camera, PackageMinus, Plus, Trash2 } from "lucide-react";
import type { ConsumptionDto } from "@application/modules/warehouse/dtos";
import type { StoredFile } from "@application/shared/ports/file-storage";
import { Card } from "@presentation/shared/ui/Card";
import { Badge } from "@presentation/shared/ui/Badge";
import { Button } from "@presentation/shared/ui/Button";
import { Input } from "@presentation/shared/ui/Input";
import { Select } from "@presentation/shared/ui/Select";
import { FormField } from "@presentation/shared/ui/FormField";
import { Modal } from "@presentation/shared/ui/Modal";
import { EmptyState } from "@presentation/shared/ui/EmptyState";
import { FileUpload } from "@presentation/shared/ui/FileUpload";
import { PermissionGate } from "@presentation/shared/ui/PermissionGate";
import { formatDateTime, formatNumber } from "@presentation/shared/lib/formatters";
import { errorMessage } from "@presentation/shared/lib/query";
import { STORAGE_ROOT } from "@config/app";
import {
  useProjectMembers,
  useProjects,
} from "@presentation/features/projects/hooks/useProjects";
import {
  useConsumption,
  useFacilities,
  useMandoubStock,
  useRecordConsumption,
} from "../hooks/useWarehouse";
import { t } from "@i18n/index";

interface DraftLine {
  itemId: string;
  itemCode: string;
  itemName: string;
  itemUnit: string;
  qty: number;
  available: number;
}

function RecordModal({ onClose }: { onClose: () => void }) {
  const facilities = useFacilities(null);
  const record = useRecordConsumption();

  const [facilityId, setFacilityId] = useState("");
  const [mandoubId, setMandoubId] = useState("");
  const [note, setNote] = useState("");
  const [consumedAt, setConsumedAt] = useState("");
  const [photos, setPhotos] = useState<StoredFile[]>([]);
  const [lines, setLines] = useState<DraftLine[]>([]);
  const [pickedItemId, setPickedItemId] = useState("");
  const [error, setError] = useState<string | null>(null);

  const facility = (facilities.data ?? []).find((f) => f.id === facilityId) ?? null;
  const projectId = facility?.projectId ?? null;

  // المندوب من فريق مشروع المنشأة نفسه
  const members = useProjectMembers(projectId);
  // العهدة تحدّد ما يمكن تنزيله: لا صنف خارجها ولا كمية تتجاوزها
  const custody = useMandoubStock(projectId, mandoubId === "" ? null : mandoubId);

  const usedIds = new Set(lines.map((line) => line.itemId));
  const itemOptions = (custody.data ?? [])
    .filter((row) => !usedIds.has(row.itemId) && row.quantity > 0)
    .map((row) => ({
      value: row.itemId,
      label: `${row.itemCode} — ${row.itemName} (${formatNumber(row.quantity)} ${row.itemUnit})`,
    }));

  const availableMap = useMemo(
    () => new Map((custody.data ?? []).map((row) => [row.itemId, row.quantity])),
    [custody.data],
  );

  const overLimit = lines.some((line) => line.qty > line.available);

  function addLine() {
    const row = (custody.data ?? []).find((r) => r.itemId === pickedItemId);
    if (row === undefined) return;
    setLines([
      ...lines,
      {
        itemId: row.itemId,
        itemCode: row.itemCode,
        itemName: row.itemName,
        itemUnit: row.itemUnit,
        qty: row.quantity,
        available: row.quantity,
      },
    ]);
    setPickedItemId("");
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    try {
      await record.mutateAsync({
        facilityId,
        mandoubId,
        note,
        consumedAt: consumedAt === "" ? null : new Date(consumedAt).toISOString(),
        photos,
        lines: lines.map((line) => ({ itemId: line.itemId, qty: line.qty })),
        available: availableMap,
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
      title={t.consumption.recordTitle}
      footer={
        <>
          <Button
            type="submit"
            form="consumption-form"
            isLoading={record.isPending}
            disabled={
              facilityId === "" || mandoubId === "" || lines.length === 0 || overLimit
            }
          >
            {t.common.save}
          </Button>
          <Button variant="ghost" onClick={onClose}>
            {t.common.cancel}
          </Button>
        </>
      }
    >
      <form
        id="consumption-form"
        onSubmit={handleSubmit}
        className="flex flex-col gap-4"
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <FormField label={t.consumption.facility} required>
            {(id) => (
              <Select
                id={id}
                options={(facilities.data ?? [])
                  .filter((f) => f.isActive)
                  .map((f) => ({
                    value: f.id,
                    label: `${f.code} — ${f.name} (${f.projectName})`,
                  }))}
                placeholder={t.consumption.pickFacility}
                value={facilityId}
                onChange={(e) => {
                  setFacilityId(e.target.value);
                  setLines([]);
                }}
                required
              />
            )}
          </FormField>

          <FormField label={t.consumption.mandoub} required>
            {(id) => (
              <Select
                id={id}
                options={(members.data ?? []).map((member) => ({
                  value: member.userId,
                  label: member.fullName,
                }))}
                placeholder={t.custody.pickMandoub}
                value={mandoubId}
                onChange={(e) => {
                  setMandoubId(e.target.value);
                  setLines([]);
                }}
                required
              />
            )}
          </FormField>

          <FormField label={t.consumption.consumedAt}>
            {(id) => (
              <Input
                id={id}
                type="datetime-local"
                dir="ltr"
                value={consumedAt}
                onChange={(e) => setConsumedAt(e.target.value)}
              />
            )}
          </FormField>

          <FormField label={t.consumption.note}>
            {(id) => (
              <Input id={id} value={note} onChange={(e) => setNote(e.target.value)} />
            )}
          </FormField>
        </div>

        <div className="bg-surface-sunken flex flex-wrap items-end gap-3 rounded-[var(--radius-control)] p-3">
          <div className="min-w-56 flex-1">
            <Select
              options={itemOptions}
              placeholder={
                mandoubId === "" || custody.data?.length === 0
                  ? t.consumption.noCustody
                  : t.materialRequests.pickItem
              }
              value={pickedItemId}
              onChange={(e) => setPickedItemId(e.target.value)}
              aria-label={t.consumption.item}
              disabled={itemOptions.length === 0}
            />
          </div>
          <Button
            onClick={addLine}
            disabled={pickedItemId === ""}
            startIcon={<Plus aria-hidden className="size-4" />}
          >
            {t.consumption.addLine}
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
                  {line.itemCode} — {t.custody.available}:{" "}
                  {formatNumber(line.available)} {line.itemUnit}
                </span>
              </span>
              <Input
                type="number"
                min="0.001"
                step="0.001"
                max={String(line.available)}
                dir="ltr"
                className="h-8 w-28"
                hasError={line.qty > line.available}
                aria-label={t.consumption.qty}
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

        <div className="flex flex-col gap-2">
          <span className="text-content text-sm font-medium">
            {t.consumption.photos}
          </span>
          <p className="text-content-muted text-xs">{t.consumption.photosHint}</p>

          {photos.length > 0 && (
            <ul className="flex flex-wrap gap-2">
              {photos.map((photo) => (
                <li key={photo.publicId} className="relative">
                  <img
                    src={photo.url}
                    alt={photo.publicId}
                    className="border-border size-20 rounded-[var(--radius-control)] border object-cover"
                  />
                  <Button
                    variant="ghost"
                    size="sm"
                    aria-label={t.upload.remove}
                    onClick={() =>
                      setPhotos(photos.filter((p) => p.publicId !== photo.publicId))
                    }
                    startIcon={<Trash2 aria-hidden className="text-danger size-4" />}
                  />
                </li>
              ))}
            </ul>
          )}

          <FileUpload
            folder={`${STORAGE_ROOT}/${projectId ?? "shared"}/consumption`}
            accept="image/*"
            value={null}
            onChange={(file) => {
              if (file !== null) setPhotos((current) => [...current, file]);
            }}
          />
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

export function ConsumptionPage() {
  const projects = useProjects();
  const [projectId, setProjectId] = useState("");
  const [facilityId, setFacilityId] = useState("");
  const [isOpen, setIsOpen] = useState(false);

  const facilities = useFacilities(projectId === "" ? null : projectId);
  const consumption = useConsumption({
    projectId: projectId === "" ? null : projectId,
    facilityId: facilityId === "" ? null : facilityId,
  });

  // أسطر التنزيل الواحد تُعرض مجمّعة كسند واحد بصوره
  const batches = useMemo(() => {
    const grouped = new Map<string, ConsumptionDto[]>();
    for (const row of consumption.data ?? []) {
      const bucket = grouped.get(row.batchId);
      if (bucket === undefined) grouped.set(row.batchId, [row]);
      else bucket.push(row);
    }
    return [...grouped.entries()];
  }, [consumption.data]);

  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-6">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-content text-xl font-extrabold">{t.consumption.title}</h1>
          <p className="text-content-muted mt-1 text-sm">{t.consumption.subtitle}</p>
        </div>
        <PermissionGate permission="consumption.record">
          <Button
            onClick={() => setIsOpen(true)}
            startIcon={<PackageMinus aria-hidden className="size-4" />}
          >
            {t.consumption.record}
          </Button>
        </PermissionGate>
      </header>

      <Card>
        <div className="grid gap-3 sm:grid-cols-2">
          <Select
            options={[
              { value: "", label: t.facilities.allProjects },
              ...(projects.data ?? []).map((project) => ({
                value: project.id,
                label: `${project.code} — ${project.name}`,
              })),
            ]}
            value={projectId}
            onChange={(e) => {
              setProjectId(e.target.value);
              setFacilityId("");
            }}
            aria-label={t.consumption.filterProject}
          />
          <Select
            options={[
              { value: "", label: t.common.all },
              ...(facilities.data ?? []).map((f) => ({
                value: f.id,
                label: `${f.code} — ${f.name}`,
              })),
            ]}
            value={facilityId}
            onChange={(e) => setFacilityId(e.target.value)}
            aria-label={t.consumption.filterFacility}
          />
        </div>
      </Card>

      {consumption.isError && (
        <Card>
          <EmptyState
            title={t.common.error}
            description={errorMessage(consumption.error)}
          />
        </Card>
      )}

      {!consumption.isError && batches.length === 0 && (
        <Card>
          <EmptyState
            title={t.consumption.empty}
            description={t.consumption.emptyHint}
          />
        </Card>
      )}

      {batches.map(([batchId, rows]) => {
        const head = rows[0];
        if (head === undefined) return null;
        return (
          <Card
            key={batchId}
            title={
              <span className="flex flex-wrap items-center gap-2">
                <span className="text-sm">{head.facilityName}</span>
                <Badge tone="neutral">{head.projectName}</Badge>
                {head.photos.length > 0 && (
                  <Badge tone="info">
                    <Camera aria-hidden className="size-3" />
                    {head.photos.length}
                  </Badge>
                )}
              </span>
            }
            description={`${t.consumption.supervisor}: ${head.supervisorName} · ${t.custody.mandoub}: ${head.mandoubName} · ${formatDateTime(head.consumedAt)}`}
          >
            <ul className="divide-border divide-y">
              {rows.map((row) => (
                <li
                  key={row.id}
                  className="flex flex-wrap items-center justify-between gap-2 py-2"
                >
                  <span className="text-content text-sm">
                    {row.itemName}
                    <span className="text-content-muted ms-2 font-mono text-xs">
                      {row.itemCode}
                    </span>
                  </span>
                  <span className="tabular text-content-muted text-xs">
                    {formatNumber(row.qty)} {row.itemUnit}
                    {row.facilityWeight > 0 && (
                      <span className="ms-2">
                        ({t.consumption.perWeight}:{" "}
                        {formatNumber(row.qty / row.facilityWeight)})
                      </span>
                    )}
                  </span>
                </li>
              ))}
            </ul>

            {head.photos.length > 0 && (
              <ul className="mt-3 flex flex-wrap gap-2">
                {head.photos.map((photo) => (
                  <li key={photo.publicId}>
                    <a href={photo.url} target="_blank" rel="noreferrer">
                      <img
                        src={photo.url}
                        alt={head.facilityName}
                        className="border-border size-20 rounded-[var(--radius-control)] border object-cover"
                      />
                    </a>
                  </li>
                ))}
              </ul>
            )}

            {head.note !== "" && (
              <p className="text-content-muted mt-3 text-xs">{head.note}</p>
            )}
          </Card>
        );
      })}

      {isOpen && <RecordModal onClose={() => setIsOpen(false)} />}
    </div>
  );
}
