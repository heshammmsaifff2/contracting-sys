/**
 * طلبات الاحتياج — الشاشة التي يظهر فيها البند [2] من المواصفات:
 * الحد الأقصى والمطلوب سابقًا والمتبقّي تُحسب كلها على الخادم وتُعرض هنا،
 * ولا يُدخل المستخدم إلا الكمية المطلوبة.
 */
import { useState, type FormEvent } from "react";
import {
  CheckCircle2,
  ClipboardList,
  Plus,
  ShoppingCart,
  Trash2,
  XCircle,
} from "lucide-react";
import type {
  MaterialRequestDto,
  MaterialRequestLineDto,
} from "@application/modules/procurement/dtos";
import { Card } from "@presentation/shared/ui/Card";
import { Badge, type BadgeTone } from "@presentation/shared/ui/Badge";
import { Button } from "@presentation/shared/ui/Button";
import { Input } from "@presentation/shared/ui/Input";
import { Select } from "@presentation/shared/ui/Select";
import { Checkbox } from "@presentation/shared/ui/Checkbox";
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
  useApproveMaterialRequest,
  useCreateMaterialRequest,
  useGeneratePurchaseRequest,
  useMaterialRequests,
  useRejectMaterialRequest,
} from "../hooks/useProcurement";
import { t } from "@i18n/index";

const STATUS_LABELS: Record<MaterialRequestDto["status"], string> = {
  draft: t.materialRequests.statusDraft,
  submitted: t.materialRequests.statusSubmitted,
  approved: t.materialRequests.statusApproved,
  rejected: t.materialRequests.statusRejected,
  converted: t.materialRequests.statusConverted,
  cancelled: t.materialRequests.statusCancelled,
};

const STATUS_TONES: Record<MaterialRequestDto["status"], BadgeTone> = {
  draft: "neutral",
  submitted: "info",
  approved: "success",
  rejected: "danger",
  converted: "brand",
  cancelled: "neutral",
};

interface DraftLine {
  itemId: string;
  itemCode: string;
  itemName: string;
  itemUnit: string;
  requestedQty: number;
}

function CreateModal({ onClose }: { onClose: () => void }) {
  const projects = useProjects();
  const create = useCreateMaterialRequest();

  const [projectId, setProjectId] = useState("");
  const [notes, setNotes] = useState("");
  const [lines, setLines] = useState<DraftLine[]>([]);
  const [itemQuery, setItemQuery] = useState("");
  const [pickedItemId, setPickedItemId] = useState("");
  const [error, setError] = useState<string | null>(null);

  const items = useItemSearch(useDebounce(itemQuery, 250));

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
        requestedQty: 1,
      },
    ]);
    setPickedItemId("");
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    try {
      await create.mutateAsync({
        projectId,
        notes,
        lines: lines.map((line) => ({
          itemId: line.itemId,
          requestedQty: line.requestedQty,
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
      title={t.materialRequests.createTitle}
      footer={
        <>
          <Button
            type="submit"
            form="mr-form"
            isLoading={create.isPending}
            disabled={projectId === "" || lines.length === 0}
          >
            {t.common.save}
          </Button>
          <Button variant="ghost" onClick={onClose}>
            {t.common.cancel}
          </Button>
        </>
      }
    >
      <form id="mr-form" onSubmit={handleSubmit} className="flex flex-col gap-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <FormField label={t.materialRequests.project} required>
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

          <FormField label={t.settingsPage.description}>
            {(id) => (
              <Input id={id} value={notes} onChange={(e) => setNotes(e.target.value)} />
            )}
          </FormField>
        </div>

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

        {lines.length === 0 ? (
          <EmptyState title={t.materialRequests.pickItem} />
        ) : (
          <ul className="divide-border divide-y">
            {lines.map((line) => (
              <li key={line.itemId} className="flex items-center gap-3 py-2.5">
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
                  className="h-8 w-28"
                  aria-label={t.materialRequests.requestedQty}
                  value={String(line.requestedQty)}
                  onChange={(e) =>
                    setLines(
                      lines.map((l) =>
                        l.itemId === line.itemId
                          ? { ...l, requestedQty: Number(e.target.value) }
                          : l,
                      ),
                    )
                  }
                />
                <span className="text-content-muted text-xs">{line.itemUnit}</span>
                <Button
                  variant="ghost"
                  size="sm"
                  aria-label={t.common.delete}
                  onClick={() =>
                    setLines(lines.filter((l) => l.itemId !== line.itemId))
                  }
                  startIcon={<Trash2 aria-hidden className="text-danger size-4" />}
                />
              </li>
            ))}
          </ul>
        )}

        {error !== null && (
          <p role="alert" className="text-danger text-sm">
            {error}
          </p>
        )}
      </form>
    </Modal>
  );
}

function LinesTable({ lines }: { lines: readonly MaterialRequestLineDto[] }) {
  const columns: readonly Column<MaterialRequestLineDto>[] = [
    {
      key: "item",
      header: t.limits.item,
      render: (row) => (
        <span className="flex flex-col">
          <span className="text-content text-sm">{row.itemName}</span>
          <span className="text-content-muted font-mono text-[11px]">
            {row.itemCode}
          </span>
        </span>
      ),
    },
    {
      key: "requested",
      header: t.materialRequests.requestedQty,
      numeric: true,
      render: (row) => `${formatNumber(row.requestedQty)} ${row.itemUnit}`,
    },
    {
      key: "max",
      header: t.materialRequests.maxQty,
      numeric: true,
      render: (row) =>
        row.maxQty === null ? (
          <span className="text-content-muted text-xs">
            {t.materialRequests.notLimited}
          </span>
        ) : (
          formatNumber(row.maxQty)
        ),
    },
    {
      key: "prev",
      header: t.materialRequests.prevQty,
      numeric: true,
      render: (row) => formatNumber(row.prevRequestedQty),
    },
    {
      key: "remaining",
      header: t.materialRequests.remaining,
      numeric: true,
      render: (row) =>
        row.remainingBalance === null ? (
          <span className="text-content-muted">—</span>
        ) : row.remainingBalance < 0 ? (
          <Badge tone="danger">{t.materialRequests.overLimit}</Badge>
        ) : (
          <span className="text-success font-medium">
            {formatNumber(row.remainingBalance)}
          </span>
        ),
    },
  ];

  return <DataTable columns={columns} rows={lines} rowKey={(row) => row.id} />;
}

export function MaterialRequestsPage() {
  const requests = useMaterialRequests();
  const approve = useApproveMaterialRequest();
  const reject = useRejectMaterialRequest();
  const generate = useGeneratePurchaseRequest();

  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [selected, setSelected] = useState<ReadonlySet<string>>(new Set());
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const rows = requests.data ?? [];
  const approvedRows = rows.filter((row) => row.status === "approved");

  function toggle(id: string, checked: boolean) {
    setSelected((previous) => {
      const next = new Set(previous);
      if (checked) next.add(id);
      else next.delete(id);
      return next;
    });
  }

  async function handleGenerate() {
    setMessage(null);
    setError(null);
    try {
      const result = await generate.mutateAsync([...selected]);
      setMessage(
        `${t.materialRequests.generated} ${result.purchaseRequestId.slice(0, 8)}`,
      );
      setSelected(new Set());
    } catch (e) {
      setError(errorMessage(e));
    }
  }

  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-6">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-content text-xl font-extrabold">
            {t.materialRequests.title}
          </h1>
          <p className="text-content-muted mt-1 text-sm">
            {t.materialRequests.subtitle}
          </p>
        </div>

        <span className="flex gap-2">
          <PermissionGate permission="purchase.manage">
            <Button
              variant="outline"
              onClick={() => void handleGenerate()}
              disabled={selected.size === 0}
              isLoading={generate.isPending}
              startIcon={<ShoppingCart aria-hidden className="size-4" />}
            >
              {t.materialRequests.generatePurchase}
            </Button>
          </PermissionGate>

          <PermissionGate permission="material_request.create">
            <Button
              onClick={() => setIsCreateOpen(true)}
              startIcon={<ClipboardList aria-hidden className="size-4" />}
            >
              {t.materialRequests.add}
            </Button>
          </PermissionGate>
        </span>
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

      {approvedRows.length > 0 && (
        <p className="text-content-muted text-xs">
          {t.materialRequests.selectApproved} · {t.materialRequests.generateHint}
        </p>
      )}

      {requests.isError && (
        <Card>
          <EmptyState
            title={t.common.error}
            description={errorMessage(requests.error)}
          />
        </Card>
      )}

      {!requests.isError && rows.length === 0 && (
        <Card>
          <EmptyState title={t.materialRequests.empty} />
        </Card>
      )}

      {rows.map((request) => (
        <Card
          key={request.id}
          title={
            <span className="flex items-center gap-2">
              {request.status === "approved" && (
                <Checkbox
                  label=""
                  checked={selected.has(request.id)}
                  onChange={(e) => toggle(request.id, e.target.checked)}
                  aria-label={`${t.materialRequests.no} ${request.no}`}
                />
              )}
              <span className="tabular font-mono">#{request.no}</span>
              <span>{request.projectName}</span>
              <Badge tone={STATUS_TONES[request.status]}>
                {STATUS_LABELS[request.status]}
              </Badge>
            </span>
          }
          actions={
            request.status === "draft" || request.status === "submitted" ? (
              <PermissionGate permission="material_request.approve">
                <span className="flex gap-1">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => approve.mutate(request.id)}
                    startIcon={
                      <CheckCircle2 aria-hidden className="text-success size-4" />
                    }
                  >
                    {t.materialRequests.approve}
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => reject.mutate(request.id)}
                    startIcon={<XCircle aria-hidden className="text-danger size-4" />}
                  >
                    {t.materialRequests.reject}
                  </Button>
                </span>
              </PermissionGate>
            ) : undefined
          }
        >
          <LinesTable lines={request.lines} />
        </Card>
      ))}

      {isCreateOpen && <CreateModal onClose={() => setIsCreateOpen(false)} />}
    </div>
  );
}
