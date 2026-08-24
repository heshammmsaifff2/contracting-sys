/**
 * العهد وفواتيرها.
 * الصورة تُمسح في المتصفّح (Tesseract) فتملأ الرقم والقيمة، ثم يحكم الخادم
 * بالتكرار بعد الحفظ ويُبلّغ صاحب صلاحية المراجعة — لا مُدخِل الفاتورة
 * [الحسابات 29]. المكرّرة تُرتجع إلى العهدة الحمراء [30].
 */
import { useState, type FormEvent } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  Copy,
  ScanLine,
  Trash2,
  Undo2,
  Wallet,
} from "lucide-react";
import type {
  CustodyDto,
  CustodyInvoiceDto,
} from "@application/modules/accounting/dtos/documents";
import type { CustodyStatus } from "@core/modules/accounting/entities/Custody";
import type { StoredFile } from "@application/shared/ports/file-storage";
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
import { formatDate, formatMoney } from "@presentation/shared/lib/formatters";
import { errorMessage } from "@presentation/shared/lib/query";
import { useAppSettings } from "@presentation/app/providers/settings-context";
import { STORAGE_ROOT } from "@config/app";
import {
  useProjects,
  useProjectMembers,
} from "@presentation/features/projects/hooks/useProjects";
import { useSupplierSearch } from "@presentation/features/procurement/hooks/useProcurement";
import {
  useApproveCustody,
  useCustodies,
  useInvoiceScanner,
  useRemoveInvoice,
  useRescanDuplicates,
  useReturnInvoice,
  useReviewDuplicate,
  useSaveCustody,
  useSaveInvoice,
} from "../hooks/useAccountingDocs";
import { t } from "@i18n/index";

const STATUS_LABELS: Record<CustodyStatus, string> = {
  open: t.custodies.statusOpen,
  submitted: t.custodies.statusSubmitted,
  approved: t.custodies.statusApproved,
  closed: t.custodies.statusClosed,
  cancelled: t.custodies.statusCancelled,
};

const STATUS_TONES: Record<CustodyStatus, BadgeTone> = {
  open: "info",
  submitted: "warning",
  approved: "success",
  closed: "neutral",
  cancelled: "danger",
};

function CustodyModal({ onClose }: { onClose: () => void }) {
  const projects = useProjects();
  const save = useSaveCustody();

  const [projectId, setProjectId] = useState("");
  const members = useProjectMembers(projectId === "" ? null : projectId);
  const [holderId, setHolderId] = useState("");
  const [openedAt, setOpenedAt] = useState(new Date().toISOString().slice(0, 10));
  const [notes, setNotes] = useState("");
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    try {
      await save.mutateAsync({ id: null, holderId, projectId, openedAt, notes });
      onClose();
    } catch (e) {
      setError(errorMessage(e));
    }
  }

  return (
    <Modal
      isOpen
      onClose={onClose}
      title={t.custodies.createTitle}
      footer={
        <>
          <Button
            type="submit"
            form="custody-form"
            isLoading={save.isPending}
            disabled={projectId === "" || holderId === ""}
          >
            {t.common.save}
          </Button>
          <Button variant="ghost" onClick={onClose}>
            {t.common.cancel}
          </Button>
        </>
      }
    >
      <form id="custody-form" onSubmit={handleSubmit} className="flex flex-col gap-4">
        <FormField label={t.custodies.project} required>
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
                setHolderId("");
              }}
              required
            />
          )}
        </FormField>

        <FormField label={t.custodies.holder} required>
          {(id) => (
            <Select
              id={id}
              options={(members.data ?? []).map((member) => ({
                value: member.userId,
                label: member.fullName,
              }))}
              placeholder={t.custodies.pickHolder}
              value={holderId}
              onChange={(e) => setHolderId(e.target.value)}
              required
            />
          )}
        </FormField>

        <FormField label={t.custodies.openedAt} required>
          {(id) => (
            <Input
              id={id}
              type="date"
              dir="ltr"
              value={openedAt}
              onChange={(e) => setOpenedAt(e.target.value)}
              required
            />
          )}
        </FormField>

        <FormField label={t.custodies.notes}>
          {(id) => (
            <Input id={id} value={notes} onChange={(e) => setNotes(e.target.value)} />
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

function InvoiceModal({
  custody,
  onClose,
}: {
  custody: CustodyDto;
  onClose: () => void;
}) {
  const save = useSaveInvoice();
  const scanner = useInvoiceScanner();
  const [supplierQuery, setSupplierQuery] = useState("");
  const suppliers = useSupplierSearch(useDebounce(supplierQuery, 250));

  const [invoiceNo, setInvoiceNo] = useState("");
  const [invoiceDate, setInvoiceDate] = useState(new Date().toISOString().slice(0, 10));
  const [amount, setAmount] = useState("");
  const [supplierId, setSupplierId] = useState("");
  const [supplierSeqNo, setSupplierSeqNo] = useState("");
  const [note, setNote] = useState("");
  const [image, setImage] = useState<StoredFile | null>(null);
  const [ocrText, setOcrText] = useState("");
  const [scanStatus, setScanStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  /** المسح يملأ الحقول فقط — يبقى للمستخدم مراجعتها قبل الحفظ. */
  async function handleScan(file: File) {
    setError(null);
    setScanStatus(t.custodies.scanning);
    try {
      const result = await scanner.mutateAsync({ file });
      setOcrText(result.text);
      if (result.invoiceNo !== null) setInvoiceNo(result.invoiceNo);
      if (result.amount !== null) setAmount(String(result.amount));
      setScanStatus(
        `${t.custodies.scanned} (${t.custodies.scanConfidence}: ${result.confidence}٪)`,
      );
    } catch (e) {
      setScanStatus(null);
      setError(errorMessage(e));
    }
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    try {
      await save.mutateAsync({
        id: null,
        custodyId: custody.id,
        supplierId: supplierId === "" ? null : supplierId,
        supplierSeqNo,
        invoiceNo,
        invoiceDate,
        amount: Number(amount),
        itemId: null,
        imagePublicId: image?.publicId ?? null,
        imageUrl: image?.url ?? null,
        ocrText,
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
      title={`${t.custodies.invoiceTitle} — ${t.custodies.serial} ${custody.serial}`}
      footer={
        <>
          <Button
            type="submit"
            form="invoice-form"
            isLoading={save.isPending}
            disabled={invoiceNo === "" || amount === ""}
          >
            {t.common.save}
          </Button>
          <Button variant="ghost" onClick={onClose}>
            {t.common.cancel}
          </Button>
        </>
      }
    >
      <form id="invoice-form" onSubmit={handleSubmit} className="flex flex-col gap-4">
        <div className="flex flex-col gap-2">
          <span className="text-content text-sm font-medium">{t.custodies.image}</span>
          <p className="text-content-muted text-xs">{t.custodies.scanHint}</p>
          <FileUpload
            folder={`${STORAGE_ROOT}/${custody.projectId}/invoices`}
            accept="image/*"
            authenticated
            value={image}
            onChange={setImage}
          />
          <label className="text-brand-700 flex cursor-pointer items-center gap-2 text-sm">
            <ScanLine aria-hidden className="size-4" />
            {t.custodies.scan}
            <input
              type="file"
              accept="image/*"
              className="sr-only"
              onChange={(e) => {
                const file = e.target.files?.[0];
                e.target.value = "";
                if (file) void handleScan(file);
              }}
            />
          </label>
          {scanStatus !== null && (
            <p role="status" className="text-info text-xs">
              {scanStatus}
            </p>
          )}
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <FormField label={t.custodies.invoiceNo} required>
            {(id) => (
              <Input
                id={id}
                dir="ltr"
                value={invoiceNo}
                onChange={(e) => setInvoiceNo(e.target.value)}
                required
              />
            )}
          </FormField>

          <FormField label={t.custodies.amount} required>
            {(id) => (
              <Input
                id={id}
                type="number"
                min="0.01"
                step="0.01"
                dir="ltr"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                required
              />
            )}
          </FormField>

          <FormField label={t.custodies.invoiceDate} required>
            {(id) => (
              <Input
                id={id}
                type="date"
                dir="ltr"
                value={invoiceDate}
                onChange={(e) => setInvoiceDate(e.target.value)}
                required
              />
            )}
          </FormField>

          <FormField label={t.custodies.supplierSeqNo}>
            {(id) => (
              <Input
                id={id}
                dir="ltr"
                value={supplierSeqNo}
                onChange={(e) => setSupplierSeqNo(e.target.value)}
              />
            )}
          </FormField>
        </div>

        <FormField label={t.custodies.supplier}>
          {(id) => (
            <div className="flex flex-col gap-2">
              <Input
                value={supplierQuery}
                onChange={(e) => setSupplierQuery(e.target.value)}
                placeholder={t.suppliers.searchPlaceholder}
                aria-label={t.common.search}
              />
              <Select
                id={id}
                options={(suppliers.data ?? []).map((supplier) => ({
                  value: supplier.id,
                  label: `${supplier.code} — ${supplier.name}`,
                }))}
                placeholder={t.common.optional}
                value={supplierId}
                onChange={(e) => setSupplierId(e.target.value)}
              />
            </div>
          )}
        </FormField>

        <FormField label={t.custodies.note}>
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

function InvoiceRow({ invoice }: { invoice: CustodyInvoiceDto }) {
  const { currency } = useAppSettings();
  const review = useReviewDuplicate();
  const returnInvoice = useReturnInvoice();
  const remove = useRemoveInvoice();
  const [error, setError] = useState<string | null>(null);

  async function handleReturn() {
    const reason = window.prompt(t.custodies.returnReason) ?? "";
    if (reason === "") return;
    setError(null);
    try {
      await returnInvoice.mutateAsync({ invoiceId: invoice.id, reason });
    } catch (e) {
      setError(errorMessage(e));
    }
  }

  async function handleRemove() {
    if (!window.confirm(t.custodies.deleteInvoiceConfirm)) return;
    setError(null);
    try {
      await remove.mutateAsync(invoice.id);
    } catch (e) {
      setError(errorMessage(e));
    }
  }

  return (
    <li className="flex flex-wrap items-center gap-3 py-2.5">
      <span className="min-w-0 flex-1">
        <span className="text-content flex flex-wrap items-center gap-2 text-sm font-medium">
          <span className="font-mono">{invoice.invoiceNo}</span>
          {invoice.isDuplicate && (
            <Badge tone={invoice.duplicateReviewed ? "warning" : "danger"}>
              <Copy aria-hidden className="size-3" />
              {invoice.duplicateReviewed
                ? t.custodies.duplicateReviewed
                : t.custodies.duplicate}
            </Badge>
          )}
          {invoice.isReturned && <Badge tone="neutral">{t.custodies.returned}</Badge>}
        </span>
        <span className="text-content-muted block text-xs">
          {formatDate(invoice.invoiceDate)}
          {invoice.supplierName !== "" && ` · ${invoice.supplierName}`}
          {invoice.returnReason !== "" && ` · ${invoice.returnReason}`}
        </span>
      </span>

      {invoice.imageUrl !== null && (
        <a href={invoice.imageUrl} target="_blank" rel="noreferrer">
          <img
            src={invoice.imageUrl}
            alt={invoice.invoiceNo}
            className="border-border size-12 rounded-[var(--radius-control)] border object-cover"
          />
        </a>
      )}

      <span className="tabular text-content text-sm font-medium">
        {formatMoney(invoice.amount, currency)}
      </span>

      <span className="flex gap-1">
        {invoice.isDuplicate && !invoice.duplicateReviewed && !invoice.isReturned && (
          <PermissionGate permission="invoice.review">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => void review.mutateAsync(invoice.id)}
              startIcon={<CheckCircle2 aria-hidden className="size-4" />}
            >
              {t.custodies.review}
            </Button>
          </PermissionGate>
        )}
        {!invoice.isReturned && (
          <PermissionGate permission="custody.manage">
            <Button
              variant="ghost"
              size="sm"
              aria-label={t.custodies.returnInvoice}
              onClick={() => void handleReturn()}
              startIcon={<Undo2 aria-hidden className="size-4" />}
            />
          </PermissionGate>
        )}
        <PermissionGate permission="custody.manage">
          <Button
            variant="ghost"
            size="sm"
            aria-label={t.common.delete}
            onClick={() => void handleRemove()}
            startIcon={<Trash2 aria-hidden className="text-danger size-4" />}
          />
        </PermissionGate>
      </span>

      {error !== null && (
        <p role="alert" className="text-danger w-full text-xs">
          {error}
        </p>
      )}
    </li>
  );
}

function CustodyCard({ custody }: { custody: CustodyDto }) {
  const { currency } = useAppSettings();
  const rescan = useRescanDuplicates();
  const approve = useApproveCustody();
  const [invoiceFor, setInvoiceFor] = useState<CustodyDto | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const isOpen = custody.status === "open" || custody.status === "submitted";

  async function handleRescan() {
    setError(null);
    setMessage(null);
    try {
      const found = await rescan.mutateAsync(custody.id);
      setMessage(
        found > 0 ? `${t.custodies.rescanned} ${found}` : t.custodies.rescanClean,
      );
    } catch (e) {
      setError(errorMessage(e));
    }
  }

  async function handleApprove() {
    if (!window.confirm(t.custodies.approveHint)) return;
    setError(null);
    setMessage(null);
    try {
      const result = await approve.mutateAsync(custody.id);
      setMessage(`${t.custodies.approved} ${result.entryId.slice(0, 8)}`);
    } catch (e) {
      setError(errorMessage(e));
    }
  }

  return (
    <Card
      title={
        <span className="flex flex-wrap items-center gap-2">
          <span className="tabular font-mono">#{custody.serial}</span>
          <span className="text-sm">{custody.holderName}</span>
          <Badge tone={STATUS_TONES[custody.status]}>
            {STATUS_LABELS[custody.status]}
          </Badge>
          {custody.isReturnedBox && (
            <Badge tone="danger">{t.custodies.returnedBox}</Badge>
          )}
        </span>
      }
      description={`${custody.projectName} · ${formatDate(custody.openedAt)} · ${t.custodies.total}: ${formatMoney(custody.totalAmount, currency)}`}
      actions={
        <span className="flex gap-2">
          {isOpen && !custody.isReturnedBox && (
            <>
              <PermissionGate permission="custody.manage">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setInvoiceFor(custody)}
                  startIcon={<Wallet aria-hidden className="size-4" />}
                >
                  {t.custodies.addInvoice}
                </Button>
              </PermissionGate>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => void handleRescan()}
                isLoading={rescan.isPending}
                startIcon={<ScanLine aria-hidden className="size-4" />}
              >
                {t.custodies.rescan}
              </Button>
              <PermissionGate permission="custody.approve">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => void handleApprove()}
                  isLoading={approve.isPending}
                  startIcon={<CheckCircle2 aria-hidden className="size-4" />}
                >
                  {t.custodies.approve}
                </Button>
              </PermissionGate>
            </>
          )}
        </span>
      }
    >
      {custody.invoices.length === 0 ? (
        <EmptyState title={t.custodies.invoicesEmpty} />
      ) : (
        <ul className="divide-border divide-y">
          {custody.invoices.map((invoice) => (
            <InvoiceRow key={invoice.id} invoice={invoice} />
          ))}
        </ul>
      )}

      {custody.invoices.some((i) => i.isDuplicate && !i.duplicateReviewed) && (
        <p className="text-danger mt-3 flex items-center gap-2 text-sm">
          <AlertTriangle aria-hidden className="size-4" />
          {t.custodies.duplicateOf}
        </p>
      )}

      {message !== null && (
        <p role="status" className="text-success mt-2 text-sm">
          {message}
        </p>
      )}
      {error !== null && (
        <p role="alert" className="text-danger mt-2 text-sm">
          {error}
        </p>
      )}

      {invoiceFor !== null && (
        <InvoiceModal custody={invoiceFor} onClose={() => setInvoiceFor(null)} />
      )}
    </Card>
  );
}

export function CustodiesPage() {
  const projects = useProjects();
  const [projectId, setProjectId] = useState("");
  const [showReturned, setShowReturned] = useState(false);
  const [isCreateOpen, setIsCreateOpen] = useState(false);

  const custodies = useCustodies({
    projectId: projectId === "" ? null : projectId,
    includeReturnedBoxes: showReturned,
  });

  const rows = custodies.data ?? [];

  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-6">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-content text-xl font-extrabold">{t.custodies.title}</h1>
          <p className="text-content-muted mt-1 text-sm">{t.custodies.subtitle}</p>
        </div>
        <PermissionGate permission="custody.manage">
          <Button
            onClick={() => setIsCreateOpen(true)}
            startIcon={<Wallet aria-hidden className="size-4" />}
          >
            {t.custodies.add}
          </Button>
        </PermissionGate>
      </header>

      <Card>
        <div className="flex flex-wrap items-center gap-4">
          <div className="min-w-56 flex-1">
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
              aria-label={t.custodies.project}
            />
          </div>
          <Checkbox
            label={t.custodies.showReturnedBoxes}
            checked={showReturned}
            onChange={(e) => setShowReturned(e.target.checked)}
          />
        </div>
      </Card>

      {custodies.isError && (
        <Card>
          <EmptyState
            title={t.common.error}
            description={errorMessage(custodies.error)}
          />
        </Card>
      )}

      {!custodies.isError && rows.length === 0 && (
        <Card>
          <EmptyState title={t.custodies.empty} description={t.custodies.emptyHint} />
        </Card>
      )}

      {rows.map((custody) => (
        <CustodyCard key={custody.id} custody={custody} />
      ))}

      {isCreateOpen && <CustodyModal onClose={() => setIsCreateOpen(false)} />}
    </div>
  );
}
