/**
 * طلبات الدفع — ضغط «تم التحويل» يُسجّل التحويل ثم يُطلق قيد الصرف آليًا:
 * ذمم المورّد ومصاريف البنك مدينة مقابل البنك دائنًا [المشتريات 4].
 */
import { useState } from "react";
import { Banknote } from "lucide-react";
import type { PaymentRequestDto } from "@application/modules/procurement/dtos";
import { Card } from "@presentation/shared/ui/Card";
import { Badge, type BadgeTone } from "@presentation/shared/ui/Badge";
import { Button } from "@presentation/shared/ui/Button";
import { Input } from "@presentation/shared/ui/Input";
import { FormField } from "@presentation/shared/ui/FormField";
import { Modal } from "@presentation/shared/ui/Modal";
import { DataTable, type Column } from "@presentation/shared/ui/DataTable";
import { EmptyState } from "@presentation/shared/ui/EmptyState";
import { PermissionGate } from "@presentation/shared/ui/PermissionGate";
import { formatMoney } from "@presentation/shared/lib/formatters";
import { errorMessage } from "@presentation/shared/lib/query";
import { useAppSettings } from "@presentation/app/providers/settings-context";
import { usePaymentRequests, useTransferPayment } from "../hooks/useProcurement";
import { t } from "@i18n/index";

const STATUS_LABELS: Record<PaymentRequestDto["status"], string> = {
  pending: t.payments.statusPending,
  approved: t.payments.statusApproved,
  transferred: t.payments.statusTransferred,
  cancelled: t.payments.statusCancelled,
};

const STATUS_TONES: Record<PaymentRequestDto["status"], BadgeTone> = {
  pending: "warning",
  approved: "info",
  transferred: "success",
  cancelled: "neutral",
};

function TransferModal({
  payment,
  onClose,
  onDone,
}: {
  payment: PaymentRequestDto;
  onClose: () => void;
  onDone: (entryId: string) => void;
}) {
  const transfer = useTransferPayment();
  const { currency } = useAppSettings();

  const [feeCompany, setFeeCompany] = useState(String(payment.bankFeeCompany));
  const [feeClient, setFeeClient] = useState(String(payment.bankFeeClient));
  const [error, setError] = useState<string | null>(null);

  async function handleTransfer() {
    setError(null);
    try {
      const result = await transfer.mutateAsync({
        id: payment.id,
        bankFeeCompany: Number(feeCompany),
        bankFeeClient: Number(feeClient),
      });
      onDone(result.entryId);
      onClose();
    } catch (e) {
      setError(errorMessage(e));
    }
  }

  return (
    <Modal
      isOpen
      onClose={onClose}
      title={t.payments.transferTitle}
      description={`${payment.partyName} — ${formatMoney(payment.amount, currency)}`}
      footer={
        <>
          <Button
            onClick={() => void handleTransfer()}
            isLoading={transfer.isPending}
            startIcon={<Banknote aria-hidden className="size-4" />}
          >
            {t.payments.transfer}
          </Button>
          <Button variant="ghost" onClick={onClose}>
            {t.common.cancel}
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        <dl className="bg-surface-sunken grid gap-3 rounded-[var(--radius-control)] p-3 sm:grid-cols-2">
          <div>
            <dt className="text-content-muted text-xs">{t.payments.bank}</dt>
            <dd className="text-content mt-0.5 text-sm font-medium">
              {payment.bankName ?? t.payments.noBankAccount}
            </dd>
          </div>
          <div>
            <dt className="text-content-muted text-xs">{t.payments.accountNo}</dt>
            <dd dir="ltr" className="text-content mt-0.5 font-mono text-sm">
              {payment.accountNo ?? "—"}
            </dd>
          </div>
        </dl>

        <div className="grid gap-4 sm:grid-cols-2">
          <FormField label={t.payments.feeCompany} hint={t.payments.transferHint}>
            {(id) => (
              <Input
                id={id}
                type="number"
                min="0"
                step="0.01"
                dir="ltr"
                value={feeCompany}
                onChange={(e) => setFeeCompany(e.target.value)}
              />
            )}
          </FormField>

          <FormField label={t.payments.feeClient}>
            {(id) => (
              <Input
                id={id}
                type="number"
                min="0"
                step="0.01"
                dir="ltr"
                value={feeClient}
                onChange={(e) => setFeeClient(e.target.value)}
              />
            )}
          </FormField>
        </div>

        {error !== null && (
          <p role="alert" className="text-danger text-sm">
            {error}
          </p>
        )}
      </div>
    </Modal>
  );
}

export function PaymentsPage() {
  const payments = usePaymentRequests();
  const { currency } = useAppSettings();

  const [target, setTarget] = useState<PaymentRequestDto | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const columns: readonly Column<PaymentRequestDto>[] = [
    {
      key: "no",
      header: t.payments.no,
      render: (row) => (
        <span className="tabular text-content-muted font-mono text-xs">#{row.no}</span>
      ),
    },
    {
      key: "party",
      header: t.payments.party,
      render: (row) => (
        <span className="text-content font-medium">{row.partyName}</span>
      ),
    },
    {
      key: "bank",
      header: t.payments.bank,
      render: (row) =>
        row.bankName === null ? (
          <Badge tone="danger">{t.payments.noBankAccount}</Badge>
        ) : (
          <span className="flex flex-col">
            <span className="text-content text-sm">{row.bankName}</span>
            <span dir="ltr" className="text-content-muted font-mono text-[11px]">
              {row.accountNo ?? "—"}
            </span>
          </span>
        ),
    },
    {
      key: "project",
      header: t.payments.project,
      render: (row) => (
        <span className="text-content-muted text-sm">{row.projectName ?? "—"}</span>
      ),
    },
    {
      key: "amount",
      header: t.payments.amount,
      numeric: true,
      render: (row) => formatMoney(row.amount, currency),
    },
    {
      key: "fee",
      header: t.payments.feeCompany,
      numeric: true,
      render: (row) =>
        row.bankFeeCompany > 0 ? formatMoney(row.bankFeeCompany, currency) : "—",
    },
    {
      key: "status",
      header: t.payments.status,
      render: (row) => (
        <Badge tone={STATUS_TONES[row.status]}>{STATUS_LABELS[row.status]}</Badge>
      ),
    },
    {
      key: "actions",
      header: "",
      render: (row) =>
        row.status !== "transferred" && row.status !== "cancelled" ? (
          <span className="flex justify-end">
            <PermissionGate permission="payment.transfer">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setTarget(row)}
                disabled={row.bankAccountId === null}
                startIcon={<Banknote aria-hidden className="size-4" />}
              >
                {t.payments.transfer}
              </Button>
            </PermissionGate>
          </span>
        ) : null,
    },
  ];

  return (
    <div className="mx-auto flex max-w-7xl flex-col gap-6">
      <header>
        <h1 className="text-content text-xl font-extrabold">{t.payments.title}</h1>
        <p className="text-content-muted mt-1 text-sm">{t.payments.subtitle}</p>
      </header>

      {message !== null && (
        <p role="status" className="text-success text-sm">
          {message}
        </p>
      )}

      <Card>
        {payments.isError ? (
          <EmptyState
            title={t.common.error}
            description={errorMessage(payments.error)}
          />
        ) : (
          <DataTable
            columns={columns}
            rows={payments.data ?? []}
            rowKey={(row) => row.id}
            isLoading={payments.isPending}
            emptyTitle={t.payments.empty}
          />
        )}
      </Card>

      {target !== null && (
        <TransferModal
          key={target.id}
          payment={target}
          onClose={() => setTarget(null)}
          onDone={(entryId) =>
            setMessage(`${t.payments.transferred} ${entryId.slice(0, 8)}`)
          }
        />
      )}
    </div>
  );
}
