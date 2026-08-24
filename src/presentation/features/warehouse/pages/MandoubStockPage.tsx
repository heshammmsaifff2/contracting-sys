/**
 * عهدة المندوبين — المخزن الفرعي.
 * التسليم يخصم من مخزون الموقع ويضيف للعهدة في معاملة واحدة على الخادم،
 * ويصل المندوب إشعار فوري بما دخل عهدته.
 */
import { useState, type FormEvent } from "react";
import { ArrowLeftRight, PackagePlus, Plus, Trash2, Undo2 } from "lucide-react";
import type {
  MandoubStockDto,
  StockMovementDto,
} from "@application/modules/warehouse/dtos";
import type { ProjectMemberDto } from "@application/modules/projects/dtos";
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
import { formatDateTime, formatNumber } from "@presentation/shared/lib/formatters";
import { errorMessage } from "@presentation/shared/lib/query";
import {
  useProjectMembers,
  useProjects,
} from "@presentation/features/projects/hooks/useProjects";
import { useItemSearch } from "@presentation/features/catalog/hooks/useCatalog";
import {
  useIssueStock,
  useMandoubStock,
  useReturnStock,
  useStockMovements,
} from "../hooks/useWarehouse";
import { t } from "@i18n/index";

const DIRECTION_LABELS: Record<StockMovementDto["direction"], string> = {
  site_to_mandoub: t.custody.directionToMandoub,
  mandoub_to_site: t.custody.directionToSite,
  mandoub_to_facility: t.custody.directionToFacility,
};

const DIRECTION_TONES: Record<StockMovementDto["direction"], BadgeTone> = {
  site_to_mandoub: "info",
  mandoub_to_site: "neutral",
  mandoub_to_facility: "success",
};

/** العضو قد يظهر في أكثر من مشروع — نعرضه مرة واحدة في الفلتر. */
function dedupeMembers(
  members: readonly ProjectMemberDto[],
): readonly ProjectMemberDto[] {
  const seen = new Set<string>();
  return members.filter((member) => {
    if (seen.has(member.userId)) return false;
    seen.add(member.userId);
    return true;
  });
}

interface DraftLine {
  itemId: string;
  itemCode: string;
  itemName: string;
  itemUnit: string;
  qty: number;
}

/**
 * نافذة واحدة للتسليم والردّ: الفرق في اتجاه الحركة فقط،
 * فلا داعي لشاشتين تُدخلان الأصناف نفسها.
 */
function StockModal({
  mode,
  onClose,
}: {
  mode: "issue" | "return";
  onClose: () => void;
}) {
  const projects = useProjects();
  const issue = useIssueStock();
  const back = useReturnStock();
  const mutation = mode === "issue" ? issue : back;

  const [projectId, setProjectId] = useState("");
  const [mandoubId, setMandoubId] = useState("");
  const [note, setNote] = useState("");
  // المندوب يُختار من فريق المشروع لا من دفتر الموظفين كله
  const members = useProjectMembers(projectId === "" ? null : projectId);
  const [lines, setLines] = useState<DraftLine[]>([]);
  const [itemQuery, setItemQuery] = useState("");
  const [pickedItemId, setPickedItemId] = useState("");
  const [error, setError] = useState<string | null>(null);

  const items = useItemSearch(useDebounce(itemQuery, 250));
  // في الردّ لا نعرض إلا ما في عهدته فعلًا — إدخال واحد لا يُكرَّر
  const custody = useMandoubStock(
    projectId === "" ? null : projectId,
    mandoubId === "" ? null : mandoubId,
  );

  const usedIds = new Set(lines.map((line) => line.itemId));
  const itemOptions =
    mode === "issue"
      ? (items.data ?? [])
          .filter((item) => item.isActive && !usedIds.has(item.id))
          .map((item) => ({ value: item.id, label: `${item.code} — ${item.name}` }))
      : (custody.data ?? [])
          .filter((row) => !usedIds.has(row.itemId))
          .map((row) => ({
            value: row.itemId,
            label: `${row.itemCode} — ${row.itemName} (${formatNumber(row.quantity)})`,
          }));

  function addLine() {
    if (mode === "issue") {
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
        },
      ]);
    } else {
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
        },
      ]);
    }
    setPickedItemId("");
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    try {
      await mutation.mutateAsync({
        projectId,
        mandoubId,
        note,
        lines: lines.map((line) => ({ itemId: line.itemId, qty: line.qty })),
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
      title={mode === "issue" ? t.custody.issueTitle : t.custody.returnTitle}
      footer={
        <>
          <Button
            type="submit"
            form="stock-form"
            isLoading={mutation.isPending}
            disabled={projectId === "" || mandoubId === "" || lines.length === 0}
          >
            {t.common.save}
          </Button>
          <Button variant="ghost" onClick={onClose}>
            {t.common.cancel}
          </Button>
        </>
      }
    >
      <form id="stock-form" onSubmit={handleSubmit} className="flex flex-col gap-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <FormField label={t.custody.project} required>
            {(id) => (
              <Select
                id={id}
                options={(projects.data ?? []).map((project) => ({
                  value: project.id,
                  label: `${project.code} — ${project.name}`,
                }))}
                placeholder={t.limits.pickProject}
                value={projectId}
                onChange={(e) => {
                  setProjectId(e.target.value);
                  setLines([]);
                }}
                required
              />
            )}
          </FormField>

          <FormField label={t.custody.mandoub} required>
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
        </div>

        <FormField label={t.custody.note}>
          {(id) => (
            <Input id={id} value={note} onChange={(e) => setNote(e.target.value)} />
          )}
        </FormField>

        <div className="bg-surface-sunken flex flex-wrap items-end gap-3 rounded-[var(--radius-control)] p-3">
          <div className="min-w-56 flex-1">
            {mode === "issue" && (
              <Input
                value={itemQuery}
                onChange={(e) => setItemQuery(e.target.value)}
                placeholder={t.items.searchPlaceholder}
                aria-label={t.common.search}
                className="mb-2"
              />
            )}
            <Select
              options={itemOptions}
              placeholder={t.materialRequests.pickItem}
              value={pickedItemId}
              onChange={(e) => setPickedItemId(e.target.value)}
              aria-label={t.custody.item}
            />
          </div>
          <Button
            onClick={addLine}
            disabled={pickedItemId === ""}
            startIcon={<Plus aria-hidden className="size-4" />}
          >
            {t.custody.addLine}
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
                  {line.itemCode} — {line.itemUnit}
                </span>
              </span>
              <Input
                type="number"
                min="0.001"
                step="0.001"
                dir="ltr"
                className="h-8 w-28"
                aria-label={t.custody.qty}
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

        {error !== null && (
          <p role="alert" className="text-danger text-sm">
            {error}
          </p>
        )}
      </form>
    </Modal>
  );
}

export function MandoubStockPage() {
  const projects = useProjects();
  const members = useProjectMembers(null);

  const [projectId, setProjectId] = useState("");
  const [mandoubId, setMandoubId] = useState("");
  const [modal, setModal] = useState<"issue" | "return" | null>(null);

  const filter = {
    projectId: projectId === "" ? null : projectId,
    mandoubId: mandoubId === "" ? null : mandoubId,
  };

  const custody = useMandoubStock(filter.projectId, filter.mandoubId);
  const movements = useStockMovements(filter);

  const custodyColumns: readonly Column<MandoubStockDto>[] = [
    {
      key: "mandoub",
      header: t.custody.mandoub,
      render: (row) => <span className="text-sm font-medium">{row.mandoubName}</span>,
    },
    {
      key: "project",
      header: t.custody.project,
      render: (row) => <span className="text-sm">{row.projectName}</span>,
    },
    {
      key: "item",
      header: t.custody.item,
      render: (row) => (
        <span>
          <span className="text-content block text-sm">{row.itemName}</span>
          <span className="text-content-muted font-mono text-xs">{row.itemCode}</span>
        </span>
      ),
    },
    {
      key: "qty",
      header: t.custody.available,
      numeric: true,
      render: (row) => (
        <span className="tabular font-medium">
          {formatNumber(row.quantity)} {row.itemUnit}
        </span>
      ),
    },
    {
      key: "updated",
      header: t.custody.updatedAt,
      render: (row) => (
        <span className="text-content-muted text-xs">
          {row.updatedAt === "" ? "—" : formatDateTime(row.updatedAt)}
        </span>
      ),
    },
  ];

  const movementColumns: readonly Column<StockMovementDto>[] = [
    {
      key: "at",
      header: t.custody.updatedAt,
      render: (row) => (
        <span className="text-content-muted text-xs">
          {formatDateTime(row.createdAt)}
        </span>
      ),
    },
    {
      key: "direction",
      header: t.common.status,
      render: (row) => (
        <Badge tone={DIRECTION_TONES[row.direction]}>
          {DIRECTION_LABELS[row.direction]}
        </Badge>
      ),
    },
    {
      key: "item",
      header: t.custody.item,
      render: (row) => (
        <span className="text-sm">
          {row.itemName}
          <span className="text-content-muted ms-2 font-mono text-xs">
            {row.itemCode}
          </span>
        </span>
      ),
    },
    {
      key: "qty",
      header: t.custody.qty,
      numeric: true,
      render: (row) => (
        <span className="tabular">
          {formatNumber(row.qty)} {row.itemUnit}
        </span>
      ),
    },
    {
      key: "who",
      header: t.custody.mandoub,
      render: (row) => (
        <span className="text-sm">
          {row.mandoubName}
          {row.facilityName !== "" && (
            <span className="text-content-muted block text-xs">{row.facilityName}</span>
          )}
        </span>
      ),
    },
  ];

  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-6">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-content text-xl font-extrabold">{t.custody.title}</h1>
          <p className="text-content-muted mt-1 text-sm">{t.custody.subtitle}</p>
        </div>
        <PermissionGate permission="mandoub_stock.issue">
          <div className="flex gap-2">
            <Button
              onClick={() => setModal("issue")}
              startIcon={<PackagePlus aria-hidden className="size-4" />}
            >
              {t.custody.issue}
            </Button>
            <Button
              variant="outline"
              onClick={() => setModal("return")}
              startIcon={<Undo2 aria-hidden className="size-4" />}
            >
              {t.custody.returnAction}
            </Button>
          </div>
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
            onChange={(e) => setProjectId(e.target.value)}
            aria-label={t.custody.project}
          />
          <Select
            options={[
              { value: "", label: t.common.all },
              ...dedupeMembers(members.data ?? []).map((member) => ({
                value: member.userId,
                label: member.fullName,
              })),
            ]}
            value={mandoubId}
            onChange={(e) => setMandoubId(e.target.value)}
            aria-label={t.custody.mandoub}
          />
        </div>
      </Card>

      <Card title={t.custody.title}>
        {custody.isError ? (
          <EmptyState
            title={t.common.error}
            description={errorMessage(custody.error)}
          />
        ) : (
          <DataTable
            columns={custodyColumns}
            rows={custody.data ?? []}
            rowKey={(row) => `${row.projectId}:${row.mandoubId}:${row.itemId}`}
            isLoading={custody.isLoading}
            emptyTitle={t.custody.empty}
            emptyDescription={t.custody.emptyHint}
          />
        )}
      </Card>

      <Card
        title={
          <span className="flex items-center gap-2">
            <ArrowLeftRight aria-hidden className="size-4" />
            {t.custody.movements}
          </span>
        }
      >
        <DataTable
          columns={movementColumns}
          rows={movements.data ?? []}
          rowKey={(row) => row.id}
          isLoading={movements.isLoading}
          emptyTitle={t.custody.movementsEmpty}
        />
      </Card>

      {modal !== null && <StockModal mode={modal} onClose={() => setModal(null)} />}
    </div>
  );
}
