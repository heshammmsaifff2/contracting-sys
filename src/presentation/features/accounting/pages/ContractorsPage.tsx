/**
 * المقاولون وبنود تعاقدهم ومديونيتهم.
 * سعر البند وكميته التعاقدية يُدخلان هنا مرة واحدة، فلا يسألهما مستخلص بعد ذلك.
 */
import { useState, type FormEvent } from "react";
import { HardHat, Pencil, Plus, Scale, Trash2 } from "lucide-react";
import type {
  ContractItemDto,
  ContractorDto,
} from "@application/modules/accounting/dtos/documents";
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
import { useDebounce } from "@presentation/shared/hooks/useDebounce";
import { formatMoney, formatNumber } from "@presentation/shared/lib/formatters";
import { errorMessage } from "@presentation/shared/lib/query";
import { useAppSettings } from "@presentation/app/providers/settings-context";
import { useProjects } from "@presentation/features/projects/hooks/useProjects";
import { useBoqSearch } from "@presentation/features/catalog/hooks/useCatalog";
import {
  useContractItems,
  useContractorBalances,
  useContractorSearch,
  useRemoveContractItem,
  useSaveContractItem,
  useSaveContractor,
} from "../hooks/useAccountingDocs";
import { t } from "@i18n/index";

function ContractorModal({
  initial,
  onClose,
}: {
  initial: ContractorDto | null;
  onClose: () => void;
}) {
  const save = useSaveContractor();
  const [code, setCode] = useState(initial?.code ?? "");
  const [name, setName] = useState(initial?.name ?? "");
  const [phone, setPhone] = useState(initial?.phone ?? "");
  const [email, setEmail] = useState(initial?.email ?? "");
  const [bankName, setBankName] = useState(initial?.bankName ?? "");
  const [accountNo, setAccountNo] = useState(initial?.accountNo ?? "");
  const [iban, setIban] = useState(initial?.iban ?? "");
  const [isActive, setIsActive] = useState(initial?.isActive ?? true);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    try {
      await save.mutateAsync({
        id: initial?.id ?? null,
        code,
        name,
        phone: phone === "" ? null : phone,
        email: email === "" ? null : email,
        bankName: bankName === "" ? null : bankName,
        accountNo: accountNo === "" ? null : accountNo,
        iban: iban === "" ? null : iban,
        isActive,
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
      title={initial === null ? t.contractors.createTitle : t.contractors.editTitle}
      footer={
        <>
          <Button type="submit" form="contractor-form" isLoading={save.isPending}>
            {t.common.save}
          </Button>
          <Button variant="ghost" onClick={onClose}>
            {t.common.cancel}
          </Button>
        </>
      }
    >
      <form
        id="contractor-form"
        onSubmit={handleSubmit}
        className="flex flex-col gap-4"
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <FormField label={t.contractors.code} required>
            {(id) => (
              <Input
                id={id}
                dir="ltr"
                value={code}
                onChange={(e) => setCode(e.target.value)}
                required
              />
            )}
          </FormField>

          <FormField label={t.contractors.name} required>
            {(id) => (
              <Input
                id={id}
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
              />
            )}
          </FormField>

          <FormField label={t.contractors.phone}>
            {(id) => (
              <Input
                id={id}
                dir="ltr"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
              />
            )}
          </FormField>

          <FormField label={t.contractors.email}>
            {(id) => (
              <Input
                id={id}
                type="email"
                dir="ltr"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            )}
          </FormField>

          <FormField label={t.contractors.bankName}>
            {(id) => (
              <Input
                id={id}
                value={bankName}
                onChange={(e) => setBankName(e.target.value)}
              />
            )}
          </FormField>

          <FormField label={t.contractors.accountNo}>
            {(id) => (
              <Input
                id={id}
                dir="ltr"
                value={accountNo}
                onChange={(e) => setAccountNo(e.target.value)}
              />
            )}
          </FormField>

          <FormField label={t.contractors.iban}>
            {(id) => (
              <Input
                id={id}
                dir="ltr"
                value={iban}
                onChange={(e) => setIban(e.target.value)}
              />
            )}
          </FormField>
        </div>

        <Checkbox
          label={t.contractors.active}
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

function ContractItemsModal({
  contractor,
  onClose,
}: {
  contractor: ContractorDto;
  onClose: () => void;
}) {
  const projects = useProjects();
  const { currency } = useAppSettings();
  const [projectId, setProjectId] = useState("");
  const items = useContractItems(contractor.id, projectId === "" ? null : projectId);
  const save = useSaveContractItem();
  const remove = useRemoveContractItem();

  const [boqQuery, setBoqQuery] = useState("");
  const [boqItemId, setBoqItemId] = useState("");
  const [unitPrice, setUnitPrice] = useState("");
  const [maxQty, setMaxQty] = useState("");
  const [error, setError] = useState<string | null>(null);

  const boqItems = useBoqSearch(useDebounce(boqQuery, 250));

  async function handleAdd(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    try {
      await save.mutateAsync({
        id: null,
        projectId,
        contractorId: contractor.id,
        boqItemId,
        unitPrice: Number(unitPrice),
        maxQty: Number(maxQty),
        notes: "",
      });
      setBoqItemId("");
      setUnitPrice("");
      setMaxQty("");
    } catch (e) {
      setError(errorMessage(e));
    }
  }

  async function handleRemove(item: ContractItemDto) {
    if (!window.confirm(t.contractors.deleteItemConfirm)) return;
    setError(null);
    try {
      await remove.mutateAsync(item.id);
    } catch (e) {
      setError(errorMessage(e));
    }
  }

  return (
    <Modal
      isOpen
      onClose={onClose}
      title={`${t.contractors.contractTitle} — ${contractor.name}`}
      footer={
        <Button variant="ghost" onClick={onClose}>
          {t.common.close}
        </Button>
      }
    >
      <div className="flex flex-col gap-5">
        <FormField label={t.extracts.project} required>
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
            />
          )}
        </FormField>

        {projectId !== "" && (
          <PermissionGate permission="contract.manage">
            <form
              onSubmit={handleAdd}
              className="bg-surface-sunken flex flex-col gap-3 rounded-[var(--radius-control)] p-3"
            >
              <Input
                value={boqQuery}
                onChange={(e) => setBoqQuery(e.target.value)}
                placeholder={t.boq.searchPlaceholder}
                aria-label={t.common.search}
              />
              <Select
                options={(boqItems.data ?? []).map((item) => ({
                  value: item.id,
                  label: `${item.code} — ${item.name}`,
                }))}
                placeholder={t.contractors.boqItem}
                value={boqItemId}
                onChange={(e) => setBoqItemId(e.target.value)}
                aria-label={t.contractors.boqItem}
              />
              <div className="flex flex-wrap gap-3">
                <Input
                  type="number"
                  min="0.01"
                  step="0.01"
                  dir="ltr"
                  className="w-36"
                  placeholder={t.contractors.unitPrice}
                  aria-label={t.contractors.unitPrice}
                  value={unitPrice}
                  onChange={(e) => setUnitPrice(e.target.value)}
                />
                <Input
                  type="number"
                  min="0.001"
                  step="0.001"
                  dir="ltr"
                  className="w-36"
                  placeholder={t.contractors.maxQty}
                  aria-label={t.contractors.maxQty}
                  value={maxQty}
                  onChange={(e) => setMaxQty(e.target.value)}
                />
                <Button
                  type="submit"
                  isLoading={save.isPending}
                  disabled={boqItemId === "" || unitPrice === "" || maxQty === ""}
                  startIcon={<Plus aria-hidden className="size-4" />}
                >
                  {t.contractors.addItem}
                </Button>
              </div>
            </form>
          </PermissionGate>
        )}

        <ul className="divide-border divide-y">
          {(items.data ?? []).map((item) => (
            <li key={item.id} className="flex flex-wrap items-center gap-3 py-2.5">
              <span className="min-w-0 flex-1">
                <span className="text-content block text-sm font-medium">
                  {item.boqName}
                </span>
                <span className="text-content-muted font-mono text-xs">
                  {item.boqCode} · {item.projectName}
                </span>
              </span>
              <span className="tabular text-content-muted text-xs">
                {formatMoney(item.unitPrice, currency)} × {formatNumber(item.maxQty)}{" "}
                {item.boqUnit}
              </span>
              <Badge tone={item.executedQty >= item.maxQty ? "success" : "neutral"}>
                {t.contractors.executed}: {formatNumber(item.executedQty)}
              </Badge>
              <PermissionGate permission="contract.manage">
                <Button
                  variant="ghost"
                  size="sm"
                  aria-label={t.common.delete}
                  onClick={() => void handleRemove(item)}
                  startIcon={<Trash2 aria-hidden className="text-danger size-4" />}
                />
              </PermissionGate>
            </li>
          ))}
          {(items.data ?? []).length === 0 && (
            <li className="py-3">
              <EmptyState title={t.contractors.itemsEmpty} />
            </li>
          )}
        </ul>

        {error !== null && (
          <p role="alert" className="text-danger text-sm">
            {error}
          </p>
        )}
      </div>
    </Modal>
  );
}

export function ContractorsPage() {
  const [query, setQuery] = useState("");
  const contractors = useContractorSearch(useDebounce(query, 250));
  const { currency } = useAppSettings();

  const [projectId, setProjectId] = useState("");
  const projects = useProjects();
  const balances = useContractorBalances(projectId === "" ? null : projectId);

  const [editing, setEditing] = useState<ContractorDto | null | "new">(null);
  const [contractFor, setContractFor] = useState<ContractorDto | null>(null);

  const columns: readonly Column<ContractorDto>[] = [
    {
      key: "code",
      header: t.contractors.code,
      render: (row) => <span className="font-mono text-xs">{row.code}</span>,
    },
    {
      key: "name",
      header: t.contractors.name,
      render: (row) => <span className="text-sm font-medium">{row.name}</span>,
    },
    {
      key: "bank",
      header: t.contractors.bankName,
      render: (row) => (
        <span className="text-content-muted text-xs">
          {row.bankName ?? "—"}
          {row.accountNo !== null && (
            <span className="ms-2 font-mono">{row.accountNo}</span>
          )}
        </span>
      ),
    },
    {
      key: "status",
      header: t.common.status,
      render: (row) => (
        <Badge tone={row.isActive ? "success" : "neutral"}>
          {row.isActive ? t.contractors.active : t.status.rejected}
        </Badge>
      ),
    },
    {
      key: "actions",
      header: "",
      render: (row) => (
        <span className="flex gap-1">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setContractFor(row)}
            startIcon={<Scale aria-hidden className="size-4" />}
          >
            {t.contractors.contractItems}
          </Button>
          <PermissionGate permission="contractor.manage">
            <Button
              variant="ghost"
              size="sm"
              aria-label={t.common.edit}
              onClick={() => setEditing(row)}
              startIcon={<Pencil aria-hidden className="size-4" />}
            />
          </PermissionGate>
        </span>
      ),
    },
  ];

  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-6">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-content text-xl font-extrabold">{t.contractors.title}</h1>
          <p className="text-content-muted mt-1 text-sm">{t.contractors.subtitle}</p>
        </div>
        <PermissionGate permission="contractor.manage">
          <Button
            onClick={() => setEditing("new")}
            startIcon={<HardHat aria-hidden className="size-4" />}
          >
            {t.contractors.add}
          </Button>
        </PermissionGate>
      </header>

      <Card>
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={t.contractors.search}
          aria-label={t.common.search}
          className="max-w-sm"
        />
      </Card>

      <Card>
        {contractors.isError ? (
          <EmptyState
            title={t.common.error}
            description={errorMessage(contractors.error)}
          />
        ) : (
          <DataTable
            columns={columns}
            rows={contractors.data ?? []}
            rowKey={(row) => row.id}
            isLoading={contractors.isLoading}
            emptyTitle={t.contractors.empty}
            emptyDescription={t.contractors.emptyHint}
          />
        )}
      </Card>

      <Card
        title={t.contractors.balances}
        actions={
          <div className="w-56">
            <Select
              options={[
                { value: "", label: t.facilities.allProjects },
                ...(projects.data ?? []).map((project) => ({
                  value: project.id,
                  label: project.name,
                })),
              ]}
              value={projectId}
              onChange={(e) => setProjectId(e.target.value)}
              aria-label={t.extracts.project}
            />
          </div>
        }
      >
        <ul className="divide-border divide-y">
          {(balances.data ?? []).map((row) => (
            <li
              key={`${row.contractorId}:${row.projectId}`}
              className="flex flex-wrap items-center justify-between gap-2 py-2.5"
            >
              <span className="min-w-0 flex-1">
                <span className="text-content block text-sm font-medium">
                  {row.contractorName}
                </span>
                <span className="text-content-muted text-xs">{row.projectName}</span>
              </span>
              <span className="tabular text-content-muted text-xs">
                {t.contractors.netTotal}: {formatMoney(row.netTotal, currency)} ·{" "}
                {t.contractors.paidTotal}: {formatMoney(row.paidTotal, currency)}
              </span>
              <Badge tone={row.outstanding > 0 ? "warning" : "success"}>
                {t.contractors.outstanding}: {formatMoney(row.outstanding, currency)}
              </Badge>
            </li>
          ))}
          {(balances.data ?? []).length === 0 && (
            <li className="py-3">
              <EmptyState title={t.warehouseReports.empty} />
            </li>
          )}
        </ul>
      </Card>

      {editing !== null && (
        <ContractorModal
          initial={editing === "new" ? null : editing}
          onClose={() => setEditing(null)}
        />
      )}
      {contractFor !== null && (
        <ContractItemsModal
          contractor={contractFor}
          onClose={() => setContractFor(null)}
        />
      )}
    </div>
  );
}
