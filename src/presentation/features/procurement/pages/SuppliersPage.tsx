import { useState, type FormEvent } from "react";
import { Landmark, Pencil, Search, Trash2, Truck } from "lucide-react";
import type {
  SupplierBankAccountDto,
  SupplierDto,
} from "@application/modules/procurement/dtos";
import { Card } from "@presentation/shared/ui/Card";
import { Badge } from "@presentation/shared/ui/Badge";
import { Button } from "@presentation/shared/ui/Button";
import { Input } from "@presentation/shared/ui/Input";
import { Checkbox } from "@presentation/shared/ui/Checkbox";
import { FormField } from "@presentation/shared/ui/FormField";
import { Modal } from "@presentation/shared/ui/Modal";
import { DataTable, type Column } from "@presentation/shared/ui/DataTable";
import { EmptyState } from "@presentation/shared/ui/EmptyState";
import { PermissionGate } from "@presentation/shared/ui/PermissionGate";
import { useDebounce } from "@presentation/shared/hooks/useDebounce";
import { formatNumber } from "@presentation/shared/lib/formatters";
import { errorMessage } from "@presentation/shared/lib/query";
import {
  useAddSupplierBankAccount,
  useRemoveSupplierBankAccount,
  useSaveSupplier,
  useSupplierBankAccounts,
  useSupplierSearch,
} from "../hooks/useProcurement";
import { t } from "@i18n/index";

function SupplierFormModal({
  onClose,
  supplier,
}: {
  onClose: () => void;
  supplier: SupplierDto | null;
}) {
  const save = useSaveSupplier();
  const [code, setCode] = useState(supplier?.code ?? "");
  const [name, setName] = useState(supplier?.name ?? "");
  const [phone, setPhone] = useState(supplier?.phone ?? "");
  const [email, setEmail] = useState(supplier?.email ?? "");
  const [address, setAddress] = useState(supplier?.address ?? "");
  const [isActive, setIsActive] = useState(supplier?.isActive ?? true);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    try {
      await save.mutateAsync({
        id: supplier?.id ?? null,
        code,
        name,
        phone: phone.trim() === "" ? null : phone,
        email: email.trim() === "" ? null : email,
        address: address.trim() === "" ? null : address,
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
      title={supplier === null ? t.suppliers.createTitle : t.suppliers.editTitle}
      footer={
        <>
          <Button type="submit" form="supplier-form" isLoading={save.isPending}>
            {t.common.save}
          </Button>
          <Button variant="ghost" onClick={onClose}>
            {t.common.cancel}
          </Button>
        </>
      }
    >
      <form
        id="supplier-form"
        onSubmit={handleSubmit}
        className="grid gap-4 sm:grid-cols-2"
      >
        <FormField label={t.suppliers.code} required>
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

        <FormField label={t.suppliers.name} required>
          {(id) => (
            <Input
              id={id}
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
            />
          )}
        </FormField>

        <FormField label={t.suppliers.phone}>
          {(id) => (
            <Input
              id={id}
              dir="ltr"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
            />
          )}
        </FormField>

        <FormField label={t.suppliers.email}>
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

        <FormField label={t.suppliers.address} className="sm:col-span-2">
          {(id) => (
            <Input
              id={id}
              value={address}
              onChange={(e) => setAddress(e.target.value)}
            />
          )}
        </FormField>

        <div className="sm:col-span-2">
          <Checkbox
            label={t.items.active}
            checked={isActive}
            onChange={(e) => setIsActive(e.target.checked)}
          />
        </div>

        {error !== null && (
          <p role="alert" className="text-danger text-sm sm:col-span-2">
            {error}
          </p>
        )}
      </form>
    </Modal>
  );
}

function BankAccountsModal({
  supplier,
  onClose,
}: {
  supplier: SupplierDto;
  onClose: () => void;
}) {
  const accounts = useSupplierBankAccounts(supplier.id);
  const add = useAddSupplierBankAccount(supplier.id);
  const remove = useRemoveSupplierBankAccount(supplier.id);

  const [bankName, setBankName] = useState("");
  const [accountNo, setAccountNo] = useState("");
  const [iban, setIban] = useState("");
  const [isDefault, setIsDefault] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleAdd() {
    setError(null);
    try {
      await add.mutateAsync({
        supplierId: supplier.id,
        bankName,
        accountNo: accountNo.trim() === "" ? null : accountNo,
        iban: iban.trim() === "" ? null : iban,
        isDefault,
      });
      setBankName("");
      setAccountNo("");
      setIban("");
      setIsDefault(false);
    } catch (e) {
      setError(errorMessage(e));
    }
  }

  const columns: readonly Column<SupplierBankAccountDto>[] = [
    {
      key: "bank",
      header: t.suppliers.bankName,
      render: (row) => <span className="text-content font-medium">{row.bankName}</span>,
    },
    {
      key: "account",
      header: t.suppliers.accountNo,
      render: (row) => (
        <span dir="ltr" className="text-content-muted font-mono text-xs">
          {row.accountNo ?? "—"}
        </span>
      ),
    },
    {
      key: "iban",
      header: t.suppliers.iban,
      render: (row) => (
        <span dir="ltr" className="text-content-muted font-mono text-xs">
          {row.iban ?? "—"}
        </span>
      ),
    },
    {
      key: "default",
      header: t.suppliers.isDefault,
      render: (row) =>
        row.isDefault ? <Badge tone="success">{t.common.yes}</Badge> : null,
    },
    {
      key: "actions",
      header: "",
      render: (row) => (
        <span className="flex justify-end">
          <Button
            variant="ghost"
            size="sm"
            aria-label={t.common.delete}
            onClick={() => remove.mutate(row.id)}
            startIcon={<Trash2 aria-hidden className="text-danger size-4" />}
          />
        </span>
      ),
    },
  ];

  return (
    <Modal
      isOpen
      onClose={onClose}
      title={t.suppliers.bankAccountsTitle}
      description={`${supplier.code} — ${supplier.name}`}
      footer={
        <Button variant="ghost" onClick={onClose}>
          {t.common.close}
        </Button>
      }
    >
      <div className="flex flex-col gap-4">
        <div className="bg-surface-sunken grid gap-3 rounded-[var(--radius-control)] p-3 sm:grid-cols-2">
          <FormField label={t.suppliers.bankName} required>
            {(id) => (
              <Input
                id={id}
                value={bankName}
                onChange={(e) => setBankName(e.target.value)}
              />
            )}
          </FormField>
          <FormField label={t.suppliers.accountNo}>
            {(id) => (
              <Input
                id={id}
                dir="ltr"
                value={accountNo}
                onChange={(e) => setAccountNo(e.target.value)}
              />
            )}
          </FormField>
          <FormField label={t.suppliers.iban}>
            {(id) => (
              <Input
                id={id}
                dir="ltr"
                value={iban}
                onChange={(e) => setIban(e.target.value)}
              />
            )}
          </FormField>
          <div className="flex items-end gap-3">
            <Checkbox
              label={t.suppliers.isDefault}
              checked={isDefault}
              onChange={(e) => setIsDefault(e.target.checked)}
            />
            <Button
              onClick={() => void handleAdd()}
              isLoading={add.isPending}
              disabled={bankName.trim() === ""}
            >
              {t.suppliers.addBank}
            </Button>
          </div>
        </div>

        {error !== null && (
          <p role="alert" className="text-danger text-sm">
            {error}
          </p>
        )}

        <DataTable
          columns={columns}
          rows={accounts.data ?? []}
          rowKey={(row) => row.id}
          isLoading={accounts.isPending}
          emptyTitle={t.suppliers.noBanks}
        />
      </div>
    </Modal>
  );
}

export function SuppliersPage() {
  const [query, setQuery] = useState("");
  const suppliers = useSupplierSearch(useDebounce(query, 250));

  const [editing, setEditing] = useState<SupplierDto | null>(null);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [banksTarget, setBanksTarget] = useState<SupplierDto | null>(null);

  const columns: readonly Column<SupplierDto>[] = [
    {
      key: "code",
      header: t.suppliers.code,
      render: (row) => (
        <span className="text-content-muted font-mono text-xs">{row.code}</span>
      ),
    },
    {
      key: "name",
      header: t.suppliers.name,
      render: (row) => <span className="text-content font-medium">{row.name}</span>,
    },
    {
      key: "phone",
      header: t.suppliers.phone,
      render: (row) => (
        <span dir="ltr" className="text-content-muted text-xs">
          {row.phone ?? "—"}
        </span>
      ),
    },
    {
      key: "banks",
      header: t.suppliers.bankCount,
      numeric: true,
      render: (row) => (
        <Badge tone={row.bankAccountCount > 0 ? "success" : "warning"}>
          {formatNumber(row.bankAccountCount)}
        </Badge>
      ),
    },
    {
      key: "state",
      header: t.suppliers.state,
      render: (row) => (
        <Badge tone={row.isActive ? "success" : "neutral"}>
          {row.isActive ? t.items.active : t.items.inactive}
        </Badge>
      ),
    },
    {
      key: "actions",
      header: "",
      render: (row) => (
        <span className="flex items-center justify-end gap-1">
          <PermissionGate permission="supplier.manage">
            <Button
              variant="ghost"
              size="sm"
              aria-label={t.suppliers.banks}
              onClick={() => setBanksTarget(row)}
              startIcon={<Landmark aria-hidden className="size-4" />}
            >
              {t.suppliers.banks}
            </Button>
          </PermissionGate>
          <PermissionGate permission="supplier.manage">
            <Button
              variant="ghost"
              size="sm"
              aria-label={t.common.edit}
              onClick={() => {
                setEditing(row);
                setIsFormOpen(true);
              }}
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
          <h1 className="text-content text-xl font-extrabold">{t.suppliers.title}</h1>
          <p className="text-content-muted mt-1 text-sm">{t.suppliers.subtitle}</p>
        </div>
        <PermissionGate permission="supplier.manage">
          <Button
            onClick={() => {
              setEditing(null);
              setIsFormOpen(true);
            }}
            startIcon={<Truck aria-hidden className="size-4" />}
          >
            {t.suppliers.add}
          </Button>
        </PermissionGate>
      </header>

      <Card>
        <div className="relative mb-4">
          <Search
            aria-hidden
            className="text-content-muted pointer-events-none absolute end-3 top-1/2 size-4 -translate-y-1/2"
          />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={t.suppliers.searchPlaceholder}
            aria-label={t.common.search}
            className="pe-9"
          />
        </div>

        {suppliers.isError ? (
          <EmptyState
            title={t.common.error}
            description={errorMessage(suppliers.error)}
          />
        ) : (
          <DataTable
            columns={columns}
            rows={suppliers.data ?? []}
            rowKey={(row) => row.id}
            isLoading={suppliers.isPending}
            emptyTitle={t.suppliers.empty}
          />
        )}
      </Card>

      {isFormOpen && (
        <SupplierFormModal
          key={editing?.id ?? "new"}
          onClose={() => setIsFormOpen(false)}
          supplier={editing}
        />
      )}

      {banksTarget !== null && (
        <BankAccountsModal
          key={banksTarget.id}
          supplier={banksTarget}
          onClose={() => setBanksTarget(null)}
        />
      )}
    </div>
  );
}
