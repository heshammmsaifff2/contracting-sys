/**
 * خطابات الضمان.
 * المدار هنا هو التاريخ: الأقرب انتهاءً أولًا، وما دخل نطاق التنبيه
 * (guarantee_alert_days من الإعدادات) يُعلَّم ويصل صاحبه إشعار.
 */
import { useState, type FormEvent } from "react";
import { AlertTriangle, ShieldCheck, Trash2 } from "lucide-react";
import type { GuaranteeDto } from "@application/modules/accounting/dtos/documents";
import type {
  GuaranteeKind,
  GuaranteeStatus,
} from "@core/modules/accounting/entities/Guarantee";
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
import {
  formatDate,
  formatMoney,
  formatNumber,
} from "@presentation/shared/lib/formatters";
import { errorMessage } from "@presentation/shared/lib/query";
import { useAppSettings } from "@presentation/app/providers/settings-context";
import { useProjects } from "@presentation/features/projects/hooks/useProjects";
import {
  useContractorSearch,
  useGuarantees,
  useRemoveGuarantee,
  useSaveGuarantee,
} from "../hooks/useAccountingDocs";
import { t } from "@i18n/index";

const KIND_LABELS: Record<GuaranteeKind, string> = {
  initial: t.guarantees.kindInitial,
  final: t.guarantees.kindFinal,
  maintenance: t.guarantees.kindMaintenance,
  advance: t.guarantees.kindAdvance,
};

const STATUS_LABELS: Record<GuaranteeStatus, string> = {
  active: t.guarantees.statusActive,
  released: t.guarantees.statusReleased,
  expired: t.guarantees.statusExpired,
};

/** عتبة التنبيه من الإعدادات لا من الكود. */
const DEFAULT_ALERT_DAYS = 30;

function daysTone(daysLeft: number | null, alertDays: number): BadgeTone {
  if (daysLeft === null) return "neutral";
  if (daysLeft < 0) return "danger";
  if (daysLeft <= alertDays) return "warning";
  return "success";
}

function GuaranteeModal({
  initial,
  onClose,
}: {
  initial: GuaranteeDto | null;
  onClose: () => void;
}) {
  const projects = useProjects();
  const [contractorQuery, setContractorQuery] = useState("");
  const contractors = useContractorSearch(useDebounce(contractorQuery, 250));
  const save = useSaveGuarantee();

  const [projectId, setProjectId] = useState(initial?.projectId ?? "");
  const [contractorId, setContractorId] = useState(initial?.contractorId ?? "");
  const [kind, setKind] = useState<GuaranteeKind>(initial?.kind ?? "final");
  const [referenceNo, setReferenceNo] = useState(initial?.referenceNo ?? "");
  const [bankName, setBankName] = useState(initial?.bankName ?? "");
  const [amount, setAmount] = useState(String(initial?.amount ?? ""));
  const [issuedAt, setIssuedAt] = useState(
    initial?.issuedAt ?? new Date().toISOString().slice(0, 10),
  );
  const [expiresAt, setExpiresAt] = useState(initial?.expiresAt ?? "");
  const [status, setStatus] = useState<GuaranteeStatus>(initial?.status ?? "active");
  const [note, setNote] = useState(initial?.note ?? "");
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    try {
      await save.mutateAsync({
        id: initial?.id ?? null,
        projectId,
        contractorId: contractorId === "" ? null : contractorId,
        kind,
        referenceNo,
        bankName,
        amount: Number(amount),
        issuedAt,
        expiresAt,
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
      title={t.guarantees.createTitle}
      footer={
        <>
          <Button
            type="submit"
            form="guarantee-form"
            isLoading={save.isPending}
            disabled={projectId === "" || amount === "" || expiresAt === ""}
          >
            {t.common.save}
          </Button>
          <Button variant="ghost" onClick={onClose}>
            {t.common.cancel}
          </Button>
        </>
      }
    >
      <form id="guarantee-form" onSubmit={handleSubmit} className="flex flex-col gap-4">
        <FormField label={t.guarantees.project} required>
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

        <FormField label={t.guarantees.contractor}>
          {(id) => (
            <div className="flex flex-col gap-2">
              <Input
                value={contractorQuery}
                onChange={(e) => setContractorQuery(e.target.value)}
                placeholder={t.contractors.search}
                aria-label={t.common.search}
              />
              <Select
                id={id}
                options={(contractors.data ?? []).map((c) => ({
                  value: c.id,
                  label: `${c.code} — ${c.name}`,
                }))}
                placeholder={t.common.optional}
                value={contractorId}
                onChange={(e) => setContractorId(e.target.value)}
              />
            </div>
          )}
        </FormField>

        <div className="grid gap-4 sm:grid-cols-2">
          <FormField label={t.guarantees.kind}>
            {(id) => (
              <Select
                id={id}
                options={(Object.keys(KIND_LABELS) as GuaranteeKind[]).map((key) => ({
                  value: key,
                  label: KIND_LABELS[key],
                }))}
                value={kind}
                onChange={(e) => setKind(e.target.value as GuaranteeKind)}
              />
            )}
          </FormField>

          <FormField label={t.guarantees.status}>
            {(id) => (
              <Select
                id={id}
                options={(Object.keys(STATUS_LABELS) as GuaranteeStatus[]).map(
                  (key) => ({
                    value: key,
                    label: STATUS_LABELS[key],
                  }),
                )}
                value={status}
                onChange={(e) => setStatus(e.target.value as GuaranteeStatus)}
              />
            )}
          </FormField>

          <FormField label={t.guarantees.referenceNo}>
            {(id) => (
              <Input
                id={id}
                dir="ltr"
                value={referenceNo}
                onChange={(e) => setReferenceNo(e.target.value)}
              />
            )}
          </FormField>

          <FormField label={t.guarantees.bankName}>
            {(id) => (
              <Input
                id={id}
                value={bankName}
                onChange={(e) => setBankName(e.target.value)}
              />
            )}
          </FormField>

          <FormField label={t.guarantees.amount} required>
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

          <FormField label={t.guarantees.issuedAt} required>
            {(id) => (
              <Input
                id={id}
                type="date"
                dir="ltr"
                value={issuedAt}
                onChange={(e) => setIssuedAt(e.target.value)}
                required
              />
            )}
          </FormField>

          <FormField label={t.guarantees.expiresAt} required>
            {(id) => (
              <Input
                id={id}
                type="date"
                dir="ltr"
                value={expiresAt}
                onChange={(e) => setExpiresAt(e.target.value)}
                required
              />
            )}
          </FormField>
        </div>

        <FormField label={t.guarantees.note}>
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

export function GuaranteesPage() {
  const projects = useProjects();
  const { currency } = useAppSettings();
  const [projectId, setProjectId] = useState("");
  const guarantees = useGuarantees(projectId === "" ? null : projectId);
  const remove = useRemoveGuarantee();

  const [editing, setEditing] = useState<GuaranteeDto | null | "new">(null);
  const [error, setError] = useState<string | null>(null);

  const alertDays = DEFAULT_ALERT_DAYS;

  async function handleRemove(row: GuaranteeDto) {
    if (!window.confirm(t.guarantees.deleteConfirm)) return;
    setError(null);
    try {
      await remove.mutateAsync(row.id);
    } catch (e) {
      setError(errorMessage(e));
    }
  }

  const columns: readonly Column<GuaranteeDto>[] = [
    {
      key: "reference",
      header: t.guarantees.referenceNo,
      render: (row) => (
        <span>
          <span className="text-content block font-mono text-xs">
            {row.referenceNo === "" ? "—" : row.referenceNo}
          </span>
          <span className="text-content-muted text-xs">{row.bankName}</span>
        </span>
      ),
    },
    {
      key: "project",
      header: t.guarantees.project,
      render: (row) => (
        <span>
          <span className="text-content block text-sm">{row.projectName}</span>
          <span className="text-content-muted text-xs">{row.contractorName}</span>
        </span>
      ),
    },
    {
      key: "kind",
      header: t.guarantees.kind,
      render: (row) => <Badge tone="neutral">{KIND_LABELS[row.kind]}</Badge>,
    },
    {
      key: "amount",
      header: t.guarantees.amount,
      numeric: true,
      render: (row) => (
        <span className="tabular font-medium">{formatMoney(row.amount, currency)}</span>
      ),
    },
    {
      key: "expiry",
      header: t.guarantees.expiresAt,
      render: (row) => (
        <span className="tabular text-xs">{formatDate(row.expiresAt)}</span>
      ),
    },
    {
      key: "daysLeft",
      header: t.guarantees.daysLeft,
      numeric: true,
      render: (row) => (
        <Badge tone={daysTone(row.daysLeft, alertDays)}>
          {row.daysLeft !== null && row.daysLeft < 0 ? (
            <>
              <AlertTriangle aria-hidden className="size-3" />
              {t.guarantees.expired}
            </>
          ) : (
            formatNumber(row.daysLeft ?? 0)
          )}
        </Badge>
      ),
    },
    {
      key: "actions",
      header: "",
      render: (row) => (
        <PermissionGate permission="guarantee.manage">
          <span className="flex gap-1">
            <Button
              variant="ghost"
              size="sm"
              aria-label={t.common.edit}
              onClick={() => setEditing(row)}
              startIcon={<ShieldCheck aria-hidden className="size-4" />}
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
          <h1 className="text-content text-xl font-extrabold">{t.guarantees.title}</h1>
          <p className="text-content-muted mt-1 text-sm">{t.guarantees.subtitle}</p>
        </div>
        <PermissionGate permission="guarantee.manage">
          <Button
            onClick={() => setEditing("new")}
            startIcon={<ShieldCheck aria-hidden className="size-4" />}
          >
            {t.guarantees.add}
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
            aria-label={t.guarantees.project}
          />
        </div>
      </Card>

      {error !== null && (
        <p role="alert" className="text-danger text-sm">
          {error}
        </p>
      )}

      <Card>
        {guarantees.isError ? (
          <EmptyState
            title={t.common.error}
            description={errorMessage(guarantees.error)}
          />
        ) : (
          <DataTable
            columns={columns}
            rows={guarantees.data ?? []}
            rowKey={(row) => row.id}
            isLoading={guarantees.isLoading}
            emptyTitle={t.guarantees.empty}
            emptyDescription={t.guarantees.emptyHint}
          />
        )}
      </Card>

      {editing !== null && (
        <GuaranteeModal
          initial={editing === "new" ? null : editing}
          onClose={() => setEditing(null)}
        />
      )}
    </div>
  );
}
