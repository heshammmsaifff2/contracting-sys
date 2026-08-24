/**
 * طلبات الاستلام — تأكيد الاستلام يزيد مخزون الموقع ويُطلق قيد:
 * مخزون المشروع + الضريبة مقابل ذمم المورّد، بلا أي إدخال محاسبي.
 */
import { useState } from "react";
import { PackageCheck } from "lucide-react";
import type { ReceiptRequestDto } from "@application/modules/procurement/dtos";
import { Card } from "@presentation/shared/ui/Card";
import { Badge, type BadgeTone } from "@presentation/shared/ui/Badge";
import { Button } from "@presentation/shared/ui/Button";
import { DataTable, type Column } from "@presentation/shared/ui/DataTable";
import { EmptyState } from "@presentation/shared/ui/EmptyState";
import { PermissionGate } from "@presentation/shared/ui/PermissionGate";
import {
  formatDate,
  formatMoney,
  formatNumber,
} from "@presentation/shared/lib/formatters";
import { errorMessage } from "@presentation/shared/lib/query";
import { useAppSettings } from "@presentation/app/providers/settings-context";
import { useConfirmReceipt, useReceiptRequests } from "../hooks/useProcurement";
import { t } from "@i18n/index";

const STATUS_LABELS: Record<ReceiptRequestDto["status"], string> = {
  draft: t.receipts.statusDraft,
  received: t.receipts.statusReceived,
  cancelled: t.receipts.statusCancelled,
};

const STATUS_TONES: Record<ReceiptRequestDto["status"], BadgeTone> = {
  draft: "warning",
  received: "success",
  cancelled: "neutral",
};

export function ReceiptsPage() {
  const receipts = useReceiptRequests();
  const confirm = useConfirmReceipt();
  const { currency } = useAppSettings();

  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleConfirm(receipt: ReceiptRequestDto) {
    if (!window.confirm(t.receipts.confirmHint)) return;
    setMessage(null);
    setError(null);
    try {
      const result = await confirm.mutateAsync(receipt.id);
      setMessage(`${t.receipts.confirmed} ${result.entryId.slice(0, 8)}`);
    } catch (e) {
      setError(errorMessage(e));
    }
  }

  const columns: readonly Column<ReceiptRequestDto>[] = [
    {
      key: "no",
      header: t.receipts.no,
      render: (row) => (
        <span className="tabular text-content-muted font-mono text-xs">#{row.no}</span>
      ),
    },
    {
      key: "order",
      header: t.receipts.order,
      render: (row) => (
        <span className="tabular text-content-muted font-mono text-xs">
          #{row.supplyOrderNo}
        </span>
      ),
    },
    {
      key: "supplier",
      header: t.receipts.supplier,
      render: (row) => <span className="text-content text-sm">{row.supplierName}</span>,
    },
    {
      key: "project",
      header: t.receipts.project,
      render: (row) => <Badge tone="neutral">{row.projectName}</Badge>,
    },
    {
      key: "items",
      header: t.materialRequests.items,
      numeric: true,
      render: (row) => formatNumber(row.lines.length),
    },
    {
      key: "total",
      header: t.receipts.total,
      numeric: true,
      render: (row) => formatMoney(row.total, currency),
    },
    {
      key: "receivedAt",
      header: t.receipts.receivedAt,
      render: (row) => (
        <span className="tabular text-content-muted text-xs">
          {row.receivedAt === null ? "—" : formatDate(row.receivedAt)}
        </span>
      ),
    },
    {
      key: "status",
      header: t.receipts.status,
      render: (row) => (
        <Badge tone={STATUS_TONES[row.status]}>{STATUS_LABELS[row.status]}</Badge>
      ),
    },
    {
      key: "actions",
      header: "",
      render: (row) =>
        row.status === "draft" ? (
          <span className="flex justify-end">
            <PermissionGate permission="receipt.confirm">
              <Button
                variant="outline"
                size="sm"
                onClick={() => void handleConfirm(row)}
                isLoading={confirm.isPending}
                startIcon={<PackageCheck aria-hidden className="size-4" />}
              >
                {t.receipts.confirm}
              </Button>
            </PermissionGate>
          </span>
        ) : null,
    },
  ];

  return (
    <div className="mx-auto flex max-w-7xl flex-col gap-6">
      <header>
        <h1 className="text-content text-xl font-extrabold">{t.receipts.title}</h1>
        <p className="text-content-muted mt-1 text-sm">{t.receipts.subtitle}</p>
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
        {receipts.isError ? (
          <EmptyState
            title={t.common.error}
            description={errorMessage(receipts.error)}
          />
        ) : (
          <DataTable
            columns={columns}
            rows={receipts.data ?? []}
            rowKey={(row) => row.id}
            isLoading={receipts.isPending}
            emptyTitle={t.receipts.empty}
          />
        )}
      </Card>
    </div>
  );
}
