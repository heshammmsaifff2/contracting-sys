/**
 * إعداد الاستقطاعات — شاشة صاحب البرنامج عند بدء الاستخدام.
 * النسب والحسابات هنا لا في الكود، وكل مستخلص يُعتمد يأخذ لقطة منها
 * فلا يتأثّر مستخلص معتمَد بتعديل لاحق.
 */
import { useState, type FormEvent } from "react";
import { Percent, Plus, Settings2 } from "lucide-react";
import type { DeductionTypeDto } from "@application/modules/accounting/dtos/documents";
import { Card } from "@presentation/shared/ui/Card";
import { Badge } from "@presentation/shared/ui/Badge";
import { Button } from "@presentation/shared/ui/Button";
import { Input } from "@presentation/shared/ui/Input";
import { Select } from "@presentation/shared/ui/Select";
import { Checkbox } from "@presentation/shared/ui/Checkbox";
import { FormField } from "@presentation/shared/ui/FormField";
import { Modal } from "@presentation/shared/ui/Modal";
import { DataTable, type Column } from "@presentation/shared/ui/DataTable";
import { EmptyState } from "@presentation/shared/ui/EmptyState";
import { PermissionGate } from "@presentation/shared/ui/PermissionGate";
import { formatNumber } from "@presentation/shared/lib/formatters";
import { errorMessage } from "@presentation/shared/lib/query";
import { useAccounts } from "@presentation/features/accounting/hooks/useAccounting";
import { useDeductionTypes, useSaveDeductionType } from "../hooks/useAccountingDocs";
import { t } from "@i18n/index";

function DeductionModal({
  initial,
  onClose,
}: {
  initial: DeductionTypeDto | null;
  onClose: () => void;
}) {
  const accounts = useAccounts();
  const save = useSaveDeductionType();

  const [key, setKey] = useState(initial?.key ?? "");
  const [name, setName] = useState(initial?.name ?? "");
  const [rate, setRate] = useState(String(initial?.rate ?? 0));
  const [appliesTo, setAppliesTo] = useState<"extract" | "advance">(
    initial?.appliesTo ?? "extract",
  );
  const [accountCode, setAccountCode] = useState(initial?.accountCode ?? "");
  const [isActive, setIsActive] = useState(initial?.isActive ?? true);
  const [sortOrder, setSortOrder] = useState(String(initial?.sortOrder ?? 100));
  const [description, setDescription] = useState(initial?.description ?? "");
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    try {
      await save.mutateAsync({
        id: initial?.id ?? null,
        key,
        name,
        rate: Number(rate),
        appliesTo,
        accountCode,
        isActive,
        sortOrder: Number(sortOrder),
        description,
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
      title={initial === null ? t.deductions.createTitle : t.deductions.editTitle}
      footer={
        <>
          <Button type="submit" form="deduction-form" isLoading={save.isPending}>
            {t.common.save}
          </Button>
          <Button variant="ghost" onClick={onClose}>
            {t.common.cancel}
          </Button>
        </>
      }
    >
      <form id="deduction-form" onSubmit={handleSubmit} className="flex flex-col gap-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <FormField label={t.deductions.key} hint={t.deductions.keyHint} required>
            {(id) => (
              <Input
                id={id}
                dir="ltr"
                value={key}
                onChange={(e) => setKey(e.target.value)}
                disabled={initial !== null}
                required
              />
            )}
          </FormField>

          <FormField label={t.deductions.name} required>
            {(id) => (
              <Input
                id={id}
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
              />
            )}
          </FormField>

          <FormField label={t.deductions.rate} required>
            {(id) => (
              <Input
                id={id}
                type="number"
                min="0"
                max="100"
                step="0.001"
                dir="ltr"
                value={rate}
                onChange={(e) => setRate(e.target.value)}
                required
              />
            )}
          </FormField>

          <FormField label={t.deductions.appliesTo}>
            {(id) => (
              <Select
                id={id}
                options={[
                  { value: "extract", label: t.deductions.appliesExtract },
                  { value: "advance", label: t.deductions.appliesAdvance },
                ]}
                value={appliesTo}
                onChange={(e) =>
                  setAppliesTo(e.target.value === "advance" ? "advance" : "extract")
                }
              />
            )}
          </FormField>

          <FormField label={t.deductions.account} required>
            {(id) => (
              <Select
                id={id}
                options={(accounts.data ?? [])
                  .filter((account) => account.isPostable)
                  .map((account) => ({
                    value: account.code,
                    label: `${account.code} — ${account.name}`,
                  }))}
                placeholder={t.accounts.title}
                value={accountCode}
                onChange={(e) => setAccountCode(e.target.value)}
                required
              />
            )}
          </FormField>

          <FormField label={t.deductions.sortOrder}>
            {(id) => (
              <Input
                id={id}
                type="number"
                dir="ltr"
                value={sortOrder}
                onChange={(e) => setSortOrder(e.target.value)}
              />
            )}
          </FormField>
        </div>

        <FormField label={t.deductions.description}>
          {(id) => (
            <Input
              id={id}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          )}
        </FormField>

        <Checkbox
          label={t.deductions.active}
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

export function DeductionsPage() {
  const deductions = useDeductionTypes();
  const [editing, setEditing] = useState<DeductionTypeDto | null | "new">(null);

  const columns: readonly Column<DeductionTypeDto>[] = [
    {
      key: "name",
      header: t.deductions.name,
      render: (row) => (
        <span>
          <span className="text-content block text-sm font-medium">{row.name}</span>
          <span className="text-content-muted font-mono text-xs">{row.key}</span>
        </span>
      ),
    },
    {
      key: "rate",
      header: t.deductions.rate,
      numeric: true,
      render: (row) => (
        <span className="tabular font-medium">{formatNumber(row.rate)}٪</span>
      ),
    },
    {
      key: "account",
      header: t.deductions.account,
      render: (row) => (
        <span className="text-sm">
          <span className="font-mono text-xs">{row.accountCode}</span>
          <span className="text-content-muted ms-2">{row.accountName}</span>
        </span>
      ),
    },
    {
      key: "appliesTo",
      header: t.deductions.appliesTo,
      render: (row) => (
        <Badge tone="neutral">
          {row.appliesTo === "advance"
            ? t.deductions.appliesAdvance
            : t.deductions.appliesExtract}
        </Badge>
      ),
    },
    {
      key: "status",
      header: t.common.status,
      render: (row) => (
        <Badge tone={row.isActive && row.rate > 0 ? "success" : "neutral"}>
          {row.isActive ? t.deductions.active : t.status.rejected}
        </Badge>
      ),
    },
    {
      key: "actions",
      header: "",
      render: (row) => (
        <PermissionGate permission="deduction.manage">
          <Button
            variant="ghost"
            size="sm"
            aria-label={t.common.edit}
            onClick={() => setEditing(row)}
            startIcon={<Settings2 aria-hidden className="size-4" />}
          />
        </PermissionGate>
      ),
    },
  ];

  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-6">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-content text-xl font-extrabold">{t.deductions.title}</h1>
          <p className="text-content-muted mt-1 text-sm">{t.deductions.subtitle}</p>
        </div>
        <PermissionGate permission="deduction.manage">
          <Button
            onClick={() => setEditing("new")}
            startIcon={<Plus aria-hidden className="size-4" />}
          >
            {t.deductions.add}
          </Button>
        </PermissionGate>
      </header>

      <Card>
        {deductions.isError ? (
          <EmptyState
            title={t.common.error}
            description={errorMessage(deductions.error)}
          />
        ) : (
          <DataTable
            columns={columns}
            rows={deductions.data ?? []}
            rowKey={(row) => row.id}
            isLoading={deductions.isLoading}
            emptyTitle={t.deductions.empty}
            emptyDescription={t.deductions.emptyHint}
          />
        )}
      </Card>

      <p className="text-content-muted flex items-center gap-2 text-xs">
        <Percent aria-hidden className="size-4" />
        {t.deductions.snapshotHint}
      </p>

      {editing !== null && (
        <DeductionModal
          initial={editing === "new" ? null : editing}
          onClose={() => setEditing(null)}
        />
      )}
    </div>
  );
}
