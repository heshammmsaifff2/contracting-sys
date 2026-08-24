/**
 * الدفعات المقدّمة للمقاولين.
 * اعتمادها يسجّل القيد ويولّد طلب الدفع، واستردادها يجري باستقطاع
 * «advance_recovery» من المستخلصات بعد تفعيله في شاشة الاستقطاعات.
 */
import { useState, type FormEvent } from "react";
import { BadgeDollarSign, CheckCircle2, Plus } from "lucide-react";
import type {
  AdvancePaymentDto,
  AdvanceStatus,
} from "@application/modules/accounting/dtos/documents";
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
import { formatMoney } from "@presentation/shared/lib/formatters";
import { errorMessage } from "@presentation/shared/lib/query";
import { useAppSettings } from "@presentation/app/providers/settings-context";
import { useProjects } from "@presentation/features/projects/hooks/useProjects";
import {
  useAdvances,
  useApproveAdvance,
  useContractorSearch,
  useSaveAdvance,
} from "../hooks/useAccountingDocs";
import { t } from "@i18n/index";

const STATUS_LABELS: Record<AdvanceStatus, string> = {
  draft: t.advances.statusDraft,
  approved: t.advances.statusApproved,
  paid: t.advances.statusPaid,
  cancelled: t.advances.statusCancelled,
};

const STATUS_TONES: Record<AdvanceStatus, BadgeTone> = {
  draft: "neutral",
  approved: "success",
  paid: "brand",
  cancelled: "danger",
};

function AdvanceModal({ onClose }: { onClose: () => void }) {
  const projects = useProjects();
  const [contractorQuery, setContractorQuery] = useState("");
  const contractors = useContractorSearch(useDebounce(contractorQuery, 250));
  const save = useSaveAdvance();

  const [projectId, setProjectId] = useState("");
  const [contractorId, setContractorId] = useState("");
  const [amount, setAmount] = useState("");
  const [notes, setNotes] = useState("");
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    try {
      await save.mutateAsync({
        id: null,
        contractorId,
        projectId,
        boqItemId: null,
        amount: Number(amount),
        notes,
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
      title={t.advances.createTitle}
      footer={
        <>
          <Button
            type="submit"
            form="advance-form"
            isLoading={save.isPending}
            disabled={projectId === "" || contractorId === "" || amount === ""}
          >
            {t.common.save}
          </Button>
          <Button variant="ghost" onClick={onClose}>
            {t.common.cancel}
          </Button>
        </>
      }
    >
      <form id="advance-form" onSubmit={handleSubmit} className="flex flex-col gap-4">
        <FormField label={t.advances.project} required>
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

        <FormField label={t.advances.contractor} required>
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
                placeholder={t.extracts.pickContractor}
                value={contractorId}
                onChange={(e) => setContractorId(e.target.value)}
                required
              />
            </div>
          )}
        </FormField>

        <FormField label={t.advances.amount} required>
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

        <FormField label={t.advances.notes}>
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

export function AdvancesPage() {
  const projects = useProjects();
  const { currency } = useAppSettings();
  const [projectId, setProjectId] = useState("");
  const advances = useAdvances(projectId === "" ? null : projectId);
  const approve = useApproveAdvance(projectId === "" ? null : projectId);

  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleApprove(row: AdvancePaymentDto) {
    if (!window.confirm(t.advances.approveHint)) return;
    setError(null);
    setMessage(null);
    try {
      const result = await approve.mutateAsync(row.id);
      setMessage(`${t.advances.approved} ${result.entryId.slice(0, 8)}`);
    } catch (e) {
      setError(errorMessage(e));
    }
  }

  const columns: readonly Column<AdvancePaymentDto>[] = [
    {
      key: "no",
      header: t.extracts.seq,
      render: (row) => <span className="tabular font-mono text-xs">#{row.no}</span>,
    },
    {
      key: "contractor",
      header: t.advances.contractor,
      render: (row) => (
        <span className="text-sm font-medium">{row.contractorName}</span>
      ),
    },
    {
      key: "project",
      header: t.advances.project,
      render: (row) => <span className="text-sm">{row.projectName}</span>,
    },
    {
      key: "amount",
      header: t.advances.amount,
      numeric: true,
      render: (row) => (
        <span className="tabular font-medium">{formatMoney(row.amount, currency)}</span>
      ),
    },
    {
      key: "status",
      header: t.advances.status,
      render: (row) => (
        <Badge tone={STATUS_TONES[row.status]}>{STATUS_LABELS[row.status]}</Badge>
      ),
    },
    {
      key: "actions",
      header: "",
      render: (row) =>
        row.status === "draft" ? (
          <PermissionGate permission="advance.approve">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => void handleApprove(row)}
              isLoading={approve.isPending}
              startIcon={<CheckCircle2 aria-hidden className="size-4" />}
            >
              {t.advances.approve}
            </Button>
          </PermissionGate>
        ) : null,
    },
  ];

  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-6">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-content text-xl font-extrabold">{t.advances.title}</h1>
          <p className="text-content-muted mt-1 text-sm">{t.advances.subtitle}</p>
        </div>
        <PermissionGate permission="advance.manage">
          <Button
            onClick={() => setIsCreateOpen(true)}
            startIcon={<Plus aria-hidden className="size-4" />}
          >
            {t.advances.add}
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
            aria-label={t.advances.project}
          />
        </div>
      </Card>

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

      <Card>
        {advances.isError ? (
          <EmptyState
            title={t.common.error}
            description={errorMessage(advances.error)}
          />
        ) : (
          <DataTable
            columns={columns}
            rows={advances.data ?? []}
            rowKey={(row) => row.id}
            isLoading={advances.isLoading}
            emptyTitle={t.advances.empty}
            emptyDescription={t.advances.emptyHint}
          />
        )}
      </Card>

      {isCreateOpen && <AdvanceModal onClose={() => setIsCreateOpen(false)} />}

      <p className="text-content-muted flex items-center gap-2 text-xs">
        <BadgeDollarSign aria-hidden className="size-4" />
        {t.advances.subtitle}
      </p>
    </div>
  );
}
