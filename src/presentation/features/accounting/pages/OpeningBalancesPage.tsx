/**
 * الأرصدة الافتتاحية — معيار قبول المرحلة الثانية الثاني:
 * اعتماد الرصيد يُطلق قيدًا آليًا عبر محرّك الترحيل بلا أي إدخال بشري.
 */
import { useState, type FormEvent } from "react";
import { CheckCircle2, PlusCircle, Trash2 } from "lucide-react";
import type { OpeningBalanceDto } from "@application/modules/accounting/dtos";
import { Card } from "@presentation/shared/ui/Card";
import { Badge } from "@presentation/shared/ui/Badge";
import { Button } from "@presentation/shared/ui/Button";
import { Input } from "@presentation/shared/ui/Input";
import { Select } from "@presentation/shared/ui/Select";
import { FormField } from "@presentation/shared/ui/FormField";
import { Modal } from "@presentation/shared/ui/Modal";
import { DataTable, type Column } from "@presentation/shared/ui/DataTable";
import { EmptyState } from "@presentation/shared/ui/EmptyState";
import { PermissionGate } from "@presentation/shared/ui/PermissionGate";
import { formatDate, formatMoney } from "@presentation/shared/lib/formatters";
import { errorMessage } from "@presentation/shared/lib/query";
import { useAppSettings } from "@presentation/app/providers/settings-context";
import { useProjects } from "@presentation/features/projects/hooks/useProjects";
import {
  useAccounts,
  useApproveOpeningBalance,
  useCreateOpeningBalance,
  useDeleteOpeningBalance,
  useOpeningBalances,
} from "../hooks/useAccounting";
import { t } from "@i18n/index";

function CreateModal({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) {
  const accounts = useAccounts(true);
  const projects = useProjects();
  const createBalance = useCreateOpeningBalance();
  const { currency } = useAppSettings();

  const [accountId, setAccountId] = useState("");
  const [projectId, setProjectId] = useState("");
  const [amount, setAmount] = useState("");
  const [asOf, setAsOf] = useState(new Date().toISOString().slice(0, 10));
  const [notes, setNotes] = useState("");
  const [error, setError] = useState<string | null>(null);

  const accountOptions = (accounts.data ?? []).map((account) => ({
    value: account.id,
    label: `${account.code} — ${account.name}`,
  }));

  const projectOptions = (projects.data ?? []).map((project) => ({
    value: project.id,
    label: `${project.code} — ${project.name}`,
  }));

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

    try {
      await createBalance.mutateAsync({
        accountId,
        projectId: projectId === "" ? null : projectId,
        amount: Number(amount),
        asOf,
        notes,
      });
      onClose();
    } catch (e) {
      setError(errorMessage(e));
    }
  }

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={t.openingBalances.createTitle}
      footer={
        <>
          <Button
            type="submit"
            form="opening-balance-form"
            isLoading={createBalance.isPending}
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
        id="opening-balance-form"
        onSubmit={handleSubmit}
        className="grid gap-4 sm:grid-cols-2"
      >
        <FormField label={t.openingBalances.account} required className="sm:col-span-2">
          {(id) => (
            <Select
              id={id}
              options={accountOptions}
              placeholder={t.openingBalances.account}
              value={accountId}
              onChange={(e) => setAccountId(e.target.value)}
              required
            />
          )}
        </FormField>

        <FormField
          label={`${t.openingBalances.amount} (${currency})`}
          required
          hint={t.openingBalances.amountHint}
        >
          {(id) => (
            <Input
              id={id}
              type="number"
              step="0.01"
              dir="ltr"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              required
            />
          )}
        </FormField>

        <FormField label={t.openingBalances.asOf} required>
          {(id) => (
            <Input
              id={id}
              type="date"
              value={asOf}
              onChange={(e) => setAsOf(e.target.value)}
              required
            />
          )}
        </FormField>

        <FormField label={t.openingBalances.project}>
          {(id) => (
            <Select
              id={id}
              options={projectOptions}
              placeholder={t.openingBalances.noProject}
              value={projectId}
              onChange={(e) => setProjectId(e.target.value)}
            />
          )}
        </FormField>

        <FormField label={t.openingBalances.notes}>
          {(id) => (
            <Input id={id} value={notes} onChange={(e) => setNotes(e.target.value)} />
          )}
        </FormField>

        {error !== null && (
          <p role="alert" className="text-danger text-sm sm:col-span-2">
            {error}
          </p>
        )}
      </form>
    </Modal>
  );
}

export function OpeningBalancesPage() {
  const balances = useOpeningBalances();
  const approve = useApproveOpeningBalance();
  const remove = useDeleteOpeningBalance();
  const { currency } = useAppSettings();

  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleApprove(row: OpeningBalanceDto) {
    if (!window.confirm(t.openingBalances.approveConfirm)) return;
    setMessage(null);
    setError(null);

    try {
      const result = await approve.mutateAsync(row.id);
      setMessage(`${t.openingBalances.approved_message} ${result.entryId.slice(0, 8)}`);
    } catch (e) {
      setError(errorMessage(e));
    }
  }

  const columns: readonly Column<OpeningBalanceDto>[] = [
    {
      key: "account",
      header: t.openingBalances.account,
      render: (row) => (
        <span className="flex flex-col">
          <span className="text-content text-sm font-medium">{row.accountName}</span>
          <span className="text-content-muted font-mono text-[11px]">
            {row.accountCode}
          </span>
        </span>
      ),
    },
    {
      key: "project",
      header: t.openingBalances.project,
      render: (row) => (
        <span className="text-content-muted text-sm">
          {row.projectName ?? t.openingBalances.noProject}
        </span>
      ),
    },
    {
      key: "amount",
      header: t.openingBalances.amount,
      numeric: true,
      render: (row) => (
        <span className={row.amount < 0 ? "text-danger" : "text-content"}>
          {formatMoney(row.amount, currency)}
        </span>
      ),
    },
    {
      key: "asOf",
      header: t.openingBalances.asOf,
      render: (row) => (
        <span className="tabular text-content-muted text-sm">
          {formatDate(row.asOf)}
        </span>
      ),
    },
    {
      key: "status",
      header: t.openingBalances.status,
      render: (row) => (
        <Badge tone={row.status === "approved" ? "success" : "neutral"}>
          {row.status === "approved"
            ? t.openingBalances.approved
            : t.openingBalances.draft}
        </Badge>
      ),
    },
    {
      key: "actions",
      header: "",
      render: (row) => (
        <span className="flex items-center justify-end gap-1">
          {row.status === "draft" && (
            <PermissionGate permission="opening_balance.manage">
              <Button
                variant="outline"
                size="sm"
                onClick={() => void handleApprove(row)}
                isLoading={approve.isPending}
                startIcon={<CheckCircle2 aria-hidden className="size-4" />}
              >
                {t.openingBalances.approve}
              </Button>
            </PermissionGate>
          )}

          {row.status === "draft" && (
            <PermissionGate permission="opening_balance.manage">
              <Button
                variant="ghost"
                size="sm"
                aria-label={t.common.delete}
                onClick={() => remove.mutate(row.id)}
                startIcon={<Trash2 aria-hidden className="text-danger size-4" />}
              />
            </PermissionGate>
          )}
        </span>
      ),
    },
  ];

  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-6">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-content text-xl font-extrabold">
            {t.openingBalances.title}
          </h1>
          <p className="text-content-muted mt-1 text-sm">
            {t.openingBalances.subtitle}
          </p>
        </div>

        <PermissionGate permission="opening_balance.manage">
          <Button
            onClick={() => setIsCreateOpen(true)}
            startIcon={<PlusCircle aria-hidden className="size-4" />}
          >
            {t.openingBalances.add}
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
        {balances.isError ? (
          <EmptyState
            title={t.common.error}
            description={errorMessage(balances.error)}
          />
        ) : (
          <DataTable
            columns={columns}
            rows={balances.data ?? []}
            rowKey={(row) => row.id}
            isLoading={balances.isPending}
            emptyTitle={t.openingBalances.empty}
            emptyDescription={t.openingBalances.emptyHint}
          />
        )}
      </Card>

      {isCreateOpen && <CreateModal isOpen onClose={() => setIsCreateOpen(false)} />}
    </div>
  );
}
