import { useState } from "react";
import { CheckCircle2, PackageCheck, Wallet } from "lucide-react";
import type { SupplyOrderDto } from "@application/modules/procurement/dtos";
import { Card } from "@presentation/shared/ui/Card";
import { Badge, type BadgeTone } from "@presentation/shared/ui/Badge";
import { Button } from "@presentation/shared/ui/Button";
import { EmptyState } from "@presentation/shared/ui/EmptyState";
import { PermissionGate } from "@presentation/shared/ui/PermissionGate";
import { formatMoney, formatNumber } from "@presentation/shared/lib/formatters";
import { errorMessage } from "@presentation/shared/lib/query";
import { useAppSettings } from "@presentation/app/providers/settings-context";
import {
  useApproveSupplyOrder,
  useGeneratePaymentRequest,
  useGenerateReceiptRequests,
  useSupplyOrders,
} from "../hooks/useProcurement";
import { t } from "@i18n/index";

const STATUS_LABELS: Record<SupplyOrderDto["status"], string> = {
  draft: t.supplyOrders.statusDraft,
  approved: t.supplyOrders.statusApproved,
  received: t.supplyOrders.statusReceived,
  cancelled: t.supplyOrders.statusCancelled,
};

const STATUS_TONES: Record<SupplyOrderDto["status"], BadgeTone> = {
  draft: "neutral",
  approved: "info",
  received: "success",
  cancelled: "danger",
};

export function SupplyOrdersPage() {
  const orders = useSupplyOrders();
  const approve = useApproveSupplyOrder();
  const generateReceipts = useGenerateReceiptRequests();
  const generatePayment = useGeneratePaymentRequest();
  const { currency } = useAppSettings();

  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleReceipts(order: SupplyOrderDto) {
    setMessage(null);
    setError(null);
    try {
      const result = await generateReceipts.mutateAsync(order.id);
      setMessage(`${t.supplyOrders.receiptsGenerated} ${formatNumber(result.created)}`);
    } catch (e) {
      setError(errorMessage(e));
    }
  }

  async function handlePayment(order: SupplyOrderDto) {
    setMessage(null);
    setError(null);
    try {
      await generatePayment.mutateAsync(order.id);
      setMessage(t.supplyOrders.paymentGenerated);
    } catch (e) {
      setError(errorMessage(e));
    }
  }

  const rows = orders.data ?? [];

  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-6">
      <header>
        <h1 className="text-content text-xl font-extrabold">{t.supplyOrders.title}</h1>
        <p className="text-content-muted mt-1 text-sm">{t.supplyOrders.subtitle}</p>
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

      {orders.isError && (
        <Card>
          <EmptyState title={t.common.error} description={errorMessage(orders.error)} />
        </Card>
      )}

      {!orders.isError && rows.length === 0 && (
        <Card>
          <EmptyState title={t.supplyOrders.empty} />
        </Card>
      )}

      {rows.map((order) => (
        <Card
          key={order.id}
          title={
            <span className="flex flex-wrap items-center gap-2">
              <span className="tabular font-mono">#{order.no}</span>
              <span>{order.supplierName}</span>
              <Badge tone={STATUS_TONES[order.status]}>
                {STATUS_LABELS[order.status]}
              </Badge>
              {[...new Set(order.lines.map((line) => line.projectId))].length > 1 && (
                <Badge tone="warning">{t.supplyOrders.multiProject}</Badge>
              )}
            </span>
          }
          actions={
            <span className="flex flex-wrap gap-1">
              {order.status === "draft" && (
                <PermissionGate permission="supply_order.approve">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => approve.mutate(order.id)}
                    startIcon={
                      <CheckCircle2 aria-hidden className="text-success size-4" />
                    }
                  >
                    {t.supplyOrders.approve}
                  </Button>
                </PermissionGate>
              )}

              {order.status === "approved" && (
                <PermissionGate permission="receipt.confirm">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => void handleReceipts(order)}
                    startIcon={<PackageCheck aria-hidden className="size-4" />}
                  >
                    {t.supplyOrders.generateReceipts}
                  </Button>
                </PermissionGate>
              )}

              {(order.status === "approved" || order.status === "received") && (
                <PermissionGate permission="payment.manage">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => void handlePayment(order)}
                    startIcon={<Wallet aria-hidden className="size-4" />}
                  >
                    {t.supplyOrders.generatePayment}
                  </Button>
                </PermissionGate>
              )}
            </span>
          }
        >
          <div className="flex flex-col gap-3">
            <ul className="divide-border divide-y">
              {order.lines.map((line) => (
                <li
                  key={line.id}
                  className="flex flex-wrap items-center justify-between gap-2 py-2"
                >
                  <span className="text-content text-sm">
                    {line.itemName}
                    <span className="text-content-muted ms-2 font-mono text-xs">
                      {line.itemCode}
                    </span>
                  </span>
                  <span className="flex items-center gap-3">
                    <Badge tone="neutral">{line.projectName}</Badge>
                    <span className="tabular text-content-muted text-xs">
                      {formatNumber(line.qty)} {line.itemUnit} ×{" "}
                      {formatMoney(line.unitPrice, currency)}
                    </span>
                    <span className="tabular text-content text-sm font-medium">
                      {formatMoney(line.qty * line.unitPrice, currency)}
                    </span>
                  </span>
                </li>
              ))}
            </ul>

            {/* الضريبة بند منفصل قبل السداد [المشتريات 12] */}
            <dl className="bg-surface-sunken grid gap-2 rounded-[var(--radius-control)] p-3 sm:grid-cols-3">
              <div>
                <dt className="text-content-muted text-xs">
                  {t.supplyOrders.subtotal}
                </dt>
                <dd className="tabular text-content mt-0.5 text-sm font-medium">
                  {formatMoney(order.subtotal, currency)}
                </dd>
              </div>
              <div>
                <dt className="text-content-muted text-xs">
                  {t.supplyOrders.vat} ({formatNumber(order.vatRate)}٪)
                </dt>
                <dd className="tabular text-content mt-0.5 text-sm font-medium">
                  {formatMoney(order.vatAmount, currency)}
                </dd>
              </div>
              <div>
                <dt className="text-content-muted text-xs">{t.supplyOrders.total}</dt>
                <dd className="tabular text-content mt-0.5 text-sm font-bold">
                  {formatMoney(order.total, currency)}
                </dd>
              </div>
            </dl>
          </div>
        </Card>
      ))}
    </div>
  );
}
