/**
 * السلف: يطلبها العامل من خدمته الذاتية، ويبتّ فيها صاحب الصلاحية.
 * الاعتماد يولّد طلب دفع، فيمرّ بالتحويل البنكي نفسه ويُسجَّل قيده
 * (ذمم العامل مدين / البنك دائن) آليًا [القسم 8].
 */
import { useState, type FormEvent } from "react";
import { CheckCircle2, HandCoins, XCircle } from "lucide-react";
import type { LoanDto } from "@application/modules/hr/dtos";
import type { LoanStatus } from "@core/modules/hr/entities/Loan";
import { installmentAmount } from "@core/modules/hr/entities/Loan";
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
  useDecideLoan,
  useLoans,
  useRequestLoan,
  useWorkerSearch,
} from "../hooks/useHr";
import { t } from "@i18n/index";

const STATUS_LABELS: Record<LoanStatus, string> = {
  requested: t.loans.statusRequested,
  approved: t.loans.statusApproved,
  rejected: t.loans.statusRejected,
  paid: t.loans.statusPaid,
  settled: t.loans.statusSettled,
};

const STATUS_TONES: Record<LoanStatus, BadgeTone> = {
  requested: "warning",
  approved: "success",
  rejected: "danger",
  paid: "brand",
  settled: "neutral",
};

function RequestModal({ onClose }: { onClose: () => void }) {
  const projects = useProjects();
  const [workerQuery, setWorkerQuery] = useState("");
  const workers = useWorkerSearch(useDebounce(workerQuery, 250));
  const request = useRequestLoan();

  const [workerId, setWorkerId] = useState("");
  const [projectId, setProjectId] = useState("");
  const [amount, setAmount] = useState("");
  const [installments, setInstallments] = useState("1");
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    try {
      await request.mutateAsync({
        workerId,
        projectId: projectId === "" ? null : projectId,
        amount: Number(amount),
        installments: Number(installments),
        reason,
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
      title={t.loans.requestTitle}
      footer={
        <>
          <Button
            type="submit"
            form="loan-form"
            isLoading={request.isPending}
            disabled={workerId === "" || amount === ""}
          >
            {t.common.save}
          </Button>
          <Button variant="ghost" onClick={onClose}>
            {t.common.cancel}
          </Button>
        </>
      }
    >
      <form id="loan-form" onSubmit={handleSubmit} className="flex flex-col gap-4">
        <FormField label={t.loans.worker} required>
          {(id) => (
            <div className="flex flex-col gap-2">
              <Input
                value={workerQuery}
                onChange={(e) => setWorkerQuery(e.target.value)}
                placeholder={t.workers.search}
                aria-label={t.common.search}
              />
              <Select
                id={id}
                options={(workers.data ?? []).map((worker) => ({
                  value: worker.id,
                  label: worker.fullName,
                }))}
                placeholder={t.attendance.pickWorker}
                value={workerId}
                onChange={(e) => setWorkerId(e.target.value)}
                required
              />
            </div>
          )}
        </FormField>

        <FormField label={t.loans.project}>
          {(id) => (
            <Select
              id={id}
              options={(projects.data ?? []).map((project) => ({
                value: project.id,
                label: `${project.code} — ${project.name}`,
              }))}
              placeholder={t.common.optional}
              value={projectId}
              onChange={(e) => setProjectId(e.target.value)}
            />
          )}
        </FormField>

        <div className="grid gap-4 sm:grid-cols-2">
          <FormField label={t.loans.amount} required>
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

          <FormField label={t.loans.installments} required>
            {(id) => (
              <Input
                id={id}
                type="number"
                min="1"
                step="1"
                dir="ltr"
                value={installments}
                onChange={(e) => setInstallments(e.target.value)}
                required
              />
            )}
          </FormField>
        </div>

        <FormField label={t.loans.reason}>
          {(id) => (
            <Input id={id} value={reason} onChange={(e) => setReason(e.target.value)} />
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

export function LoansPage() {
  const { currency } = useAppSettings();
  const loans = useLoans(null);
  const decide = useDecideLoan();

  const [isRequestOpen, setIsRequestOpen] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleDecide(loan: LoanDto, approve: boolean) {
    const note = window.prompt(t.loans.decisionNote) ?? "";
    setError(null);
    setMessage(null);
    try {
      await decide.mutateAsync({ id: loan.id, approve, note });
      setMessage(t.loans.decided);
    } catch (e) {
      setError(errorMessage(e));
    }
  }

  const columns: readonly Column<LoanDto>[] = [
    {
      key: "no",
      header: t.extracts.seq,
      render: (row) => <span className="tabular font-mono text-xs">#{row.no}</span>,
    },
    {
      key: "worker",
      header: t.loans.worker,
      render: (row) => (
        <span>
          <span className="text-content block text-sm font-medium">
            {row.workerName}
          </span>
          <span className="text-content-muted text-xs">{row.reason}</span>
        </span>
      ),
    },
    {
      key: "amount",
      header: t.loans.amount,
      numeric: true,
      render: (row) => (
        <span>
          <span className="tabular block font-medium">
            {formatMoney(row.amount, currency)}
          </span>
          <span className="text-content-muted tabular block text-xs">
            {formatNumber(row.installments)} ×{" "}
            {formatMoney(installmentAmount(row.amount, row.installments), currency)}
          </span>
        </span>
      ),
    },
    {
      key: "project",
      header: t.loans.project,
      render: (row) => (
        <span className="text-sm">
          {row.projectName === "" ? "—" : row.projectName}
        </span>
      ),
    },
    {
      key: "status",
      header: t.loans.status,
      render: (row) => (
        <span>
          <Badge tone={STATUS_TONES[row.status]}>{STATUS_LABELS[row.status]}</Badge>
          {row.decisionNote !== "" && (
            <span className="text-content-muted mt-1 block text-xs">
              {row.decisionNote}
            </span>
          )}
        </span>
      ),
    },
    {
      key: "date",
      header: t.attendance.date,
      render: (row) => (
        <span className="text-content-muted tabular text-xs">
          {formatDate(row.createdAt)}
        </span>
      ),
    },
    {
      key: "actions",
      header: "",
      render: (row) =>
        row.status === "requested" ? (
          <PermissionGate permission="loan.approve">
            <span className="flex gap-1">
              <Button
                variant="ghost"
                size="sm"
                aria-label={t.loans.approve}
                onClick={() => void handleDecide(row, true)}
                startIcon={<CheckCircle2 aria-hidden className="text-success size-4" />}
              />
              <Button
                variant="ghost"
                size="sm"
                aria-label={t.loans.reject}
                onClick={() => void handleDecide(row, false)}
                startIcon={<XCircle aria-hidden className="text-danger size-4" />}
              />
            </span>
          </PermissionGate>
        ) : null,
    },
  ];

  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-6">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-content text-xl font-extrabold">{t.loans.title}</h1>
          <p className="text-content-muted mt-1 text-sm">{t.loans.subtitle}</p>
        </div>
        <PermissionGate permission="loan.approve">
          <Button
            onClick={() => setIsRequestOpen(true)}
            startIcon={<HandCoins aria-hidden className="size-4" />}
          >
            {t.loans.request}
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

      <Card>
        {loans.isError ? (
          <EmptyState title={t.common.error} description={errorMessage(loans.error)} />
        ) : (
          <DataTable
            columns={columns}
            rows={loans.data ?? []}
            rowKey={(row) => row.id}
            isLoading={loans.isLoading}
            emptyTitle={t.loans.empty}
            emptyDescription={t.loans.emptyHint}
          />
        )}
      </Card>

      {isRequestOpen && <RequestModal onClose={() => setIsRequestOpen(false)} />}
    </div>
  );
}
