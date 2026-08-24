/**
 * طلبات الشراء والتسعير والمقارنة.
 * المشتريات لا تُدخل إلا كود المورّد وسعره [المشتريات 3]؛ الكميات والأصناف
 * كلها مستدعاة من طلب الشراء المولَّد آليًا.
 */
import { useMemo, useState } from "react";
import { FileText, Scale, Send } from "lucide-react";
import type {
  PriceComparisonRowDto,
  PurchaseRequestDto,
} from "@application/modules/procurement/dtos";
import { Card } from "@presentation/shared/ui/Card";
import { Badge } from "@presentation/shared/ui/Badge";
import { Button } from "@presentation/shared/ui/Button";
import { Input } from "@presentation/shared/ui/Input";
import { Select } from "@presentation/shared/ui/Select";
import { Modal } from "@presentation/shared/ui/Modal";
import { DataTable, type Column } from "@presentation/shared/ui/DataTable";
import { EmptyState } from "@presentation/shared/ui/EmptyState";
import { PermissionGate } from "@presentation/shared/ui/PermissionGate";
import { useDebounce } from "@presentation/shared/hooks/useDebounce";
import { formatMoney, formatNumber } from "@presentation/shared/lib/formatters";
import { errorMessage } from "@presentation/shared/lib/query";
import { useAppSettings } from "@presentation/app/providers/settings-context";
import {
  useGenerateSupplyOrder,
  usePriceComparison,
  usePurchaseRequests,
  useSaveQuote,
  useSupplierSearch,
} from "../hooks/useProcurement";
import { t } from "@i18n/index";

function QuoteModal({
  request,
  onClose,
}: {
  request: PurchaseRequestDto;
  onClose: () => void;
}) {
  const [supplierQuery, setSupplierQuery] = useState("");
  const suppliers = useSupplierSearch(useDebounce(supplierQuery, 250));
  const saveQuote = useSaveQuote(request.id);

  const [supplierId, setSupplierId] = useState("");
  const [prices, setPrices] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);

  /** الأصناف المطلوبة مجمّعة — الصنف الواحد قد يتكرّر لمشاريع مختلفة. */
  const items = useMemo(() => {
    const byItem = new Map<
      string,
      {
        itemId: string;
        itemCode: string;
        itemName: string;
        itemUnit: string;
        qty: number;
      }
    >();
    for (const line of request.lines) {
      const existing = byItem.get(line.itemId);
      byItem.set(line.itemId, {
        itemId: line.itemId,
        itemCode: line.itemCode,
        itemName: line.itemName,
        itemUnit: line.itemUnit,
        qty: (existing?.qty ?? 0) + line.qty,
      });
    }
    return [...byItem.values()];
  }, [request.lines]);

  async function handleSave() {
    setError(null);
    try {
      await saveQuote.mutateAsync({
        purchaseRequestId: request.id,
        supplierId,
        lines: items.map((item) => ({
          itemId: item.itemId,
          unitPrice: Number(prices[item.itemId] ?? 0),
        })),
      });
      onClose();
    } catch (e) {
      setError(errorMessage(e));
    }
  }

  const allPriced = items.every(
    (item) => prices[item.itemId] !== undefined && prices[item.itemId] !== "",
  );

  return (
    <Modal
      isOpen
      onClose={onClose}
      title={t.purchase.addQuote}
      description={`${t.purchase.quoteFor} ${request.no}`}
      footer={
        <>
          <Button
            onClick={() => void handleSave()}
            isLoading={saveQuote.isPending}
            disabled={supplierId === "" || !allPriced}
          >
            {t.common.save}
          </Button>
          <Button variant="ghost" onClick={onClose}>
            {t.common.cancel}
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        <div className="bg-surface-sunken rounded-[var(--radius-control)] p-3">
          <Input
            value={supplierQuery}
            onChange={(e) => setSupplierQuery(e.target.value)}
            placeholder={t.suppliers.searchPlaceholder}
            aria-label={t.common.search}
            className="mb-2"
          />
          <Select
            options={(suppliers.data ?? [])
              .filter((supplier) => supplier.isActive)
              .map((supplier) => ({
                value: supplier.id,
                label: `${supplier.code} — ${supplier.name}`,
              }))}
            placeholder={t.purchase.supplier}
            value={supplierId}
            onChange={(e) => setSupplierId(e.target.value)}
            aria-label={t.purchase.supplier}
          />
        </div>

        <ul className="divide-border divide-y">
          {items.map((item) => (
            <li key={item.itemId} className="flex items-center gap-3 py-2.5">
              <span className="min-w-0 flex-1">
                <span className="text-content block text-sm font-medium">
                  {item.itemName}
                </span>
                <span className="text-content-muted font-mono text-xs">
                  {item.itemCode} · {formatNumber(item.qty)} {item.itemUnit}
                </span>
              </span>
              <Input
                type="number"
                min="0"
                step="0.01"
                dir="ltr"
                className="h-8 w-32"
                aria-label={`${t.purchase.unitPrice}: ${item.itemCode}`}
                value={prices[item.itemId] ?? ""}
                onChange={(e) =>
                  setPrices({ ...prices, [item.itemId]: e.target.value })
                }
              />
            </li>
          ))}
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

function ComparisonModal({
  request,
  onClose,
}: {
  request: PurchaseRequestDto;
  onClose: () => void;
}) {
  const comparison = usePriceComparison(request.id);
  const generate = useGenerateSupplyOrder();
  const { currency } = useAppSettings();

  const [supplierId, setSupplierId] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // useMemo حتى لا يتغيّر المرجع في كل تصيير فتُعاد قائمة الموردين بلا داعٍ
  const rows = useMemo(() => comparison.data ?? [], [comparison.data]);

  const supplierOptions = useMemo(() => {
    const seen = new Map<string, string>();
    for (const row of rows) {
      seen.set(row.supplierId, `${row.supplierCode} — ${row.supplierName}`);
    }
    return [...seen.entries()].map(([value, label]) => ({ value, label }));
  }, [rows]);

  async function handleGenerate() {
    setMessage(null);
    setError(null);
    try {
      const result = await generate.mutateAsync({
        purchaseRequestId: request.id,
        supplierId,
      });
      setMessage(`${t.purchase.orderGenerated} ${result.supplyOrderId.slice(0, 8)}`);
    } catch (e) {
      setError(errorMessage(e));
    }
  }

  const columns: readonly Column<PriceComparisonRowDto>[] = [
    {
      key: "item",
      header: t.limits.item,
      render: (row) => (
        <span className="flex flex-col">
          <span className="text-content text-sm">{row.itemName}</span>
          <span className="text-content-muted font-mono text-[11px]">
            {row.itemCode}
          </span>
        </span>
      ),
    },
    {
      key: "supplier",
      header: t.purchase.supplier,
      render: (row) => (
        <span className="flex items-center gap-2">
          <span className="text-content text-sm">{row.supplierName}</span>
          {row.priceRank === 1 && <Badge tone="success">{t.purchase.cheapest}</Badge>}
        </span>
      ),
    },
    {
      key: "price",
      header: t.purchase.unitPrice,
      numeric: true,
      render: (row) => formatMoney(row.unitPrice, currency),
    },
    {
      key: "qty",
      header: t.purchase.requiredQty,
      numeric: true,
      render: (row) => `${formatNumber(row.requiredQty)} ${row.itemUnit}`,
    },
    {
      key: "total",
      header: t.purchase.lineTotal,
      numeric: true,
      render: (row) => formatMoney(row.lineTotal, currency),
    },
  ];

  return (
    <Modal
      isOpen
      onClose={onClose}
      title={t.purchase.comparison}
      description={`${t.purchase.no} ${request.no}`}
      size="lg"
      footer={
        <>
          <PermissionGate permission="supply_order.manage">
            <Button
              onClick={() => void handleGenerate()}
              disabled={supplierId === ""}
              isLoading={generate.isPending}
              startIcon={<Send aria-hidden className="size-4" />}
            >
              {t.purchase.generateOrder}
            </Button>
          </PermissionGate>
          <Button variant="ghost" onClick={onClose}>
            {t.common.close}
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        {rows.length > 0 && (
          <div className="bg-surface-sunken flex flex-wrap items-end gap-3 rounded-[var(--radius-control)] p-3">
            <div className="min-w-56 flex-1">
              <Select
                options={supplierOptions}
                placeholder={t.purchase.pickSupplier}
                value={supplierId}
                onChange={(e) => setSupplierId(e.target.value)}
                aria-label={t.purchase.pickSupplier}
              />
            </div>
          </div>
        )}

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

        <DataTable
          columns={columns}
          rows={rows}
          rowKey={(row) => `${row.itemId}-${row.supplierId}`}
          isLoading={comparison.isPending}
          emptyTitle={t.purchase.noQuotes}
        />
      </div>
    </Modal>
  );
}

export function PurchaseRequestsPage() {
  const requests = usePurchaseRequests();
  const [quoteTarget, setQuoteTarget] = useState<PurchaseRequestDto | null>(null);
  const [comparisonTarget, setComparisonTarget] = useState<PurchaseRequestDto | null>(
    null,
  );

  const rows = requests.data ?? [];

  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-6">
      <header>
        <h1 className="text-content text-xl font-extrabold">{t.purchase.title}</h1>
        <p className="text-content-muted mt-1 text-sm">{t.purchase.subtitle}</p>
      </header>

      {requests.isError && (
        <Card>
          <EmptyState
            title={t.common.error}
            description={errorMessage(requests.error)}
          />
        </Card>
      )}

      {!requests.isError && rows.length === 0 && (
        <Card>
          <EmptyState
            title={t.purchase.empty}
            description={t.materialRequests.generateHint}
          />
        </Card>
      )}

      {rows.map((request) => (
        <Card
          key={request.id}
          title={
            <span className="flex items-center gap-2">
              <span className="tabular font-mono">#{request.no}</span>
              <Badge tone={request.status === "ordered" ? "success" : "neutral"}>
                {request.status}
              </Badge>
              <Badge tone="brand">
                {formatNumber(request.quotedSupplierIds.length)} {t.purchase.quotes}
              </Badge>
            </span>
          }
          actions={
            <span className="flex gap-1">
              <PermissionGate permission="purchase.manage">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setQuoteTarget(request)}
                  startIcon={<FileText aria-hidden className="size-4" />}
                >
                  {t.purchase.addQuote}
                </Button>
              </PermissionGate>
              <PermissionGate permission="purchase.manage">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setComparisonTarget(request)}
                  startIcon={<Scale aria-hidden className="size-4" />}
                >
                  {t.purchase.comparison}
                </Button>
              </PermissionGate>
            </span>
          }
        >
          <ul className="divide-border divide-y">
            {request.lines.map((line) => (
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
                  <span className="tabular text-content text-sm font-medium">
                    {formatNumber(line.qty)} {line.itemUnit}
                  </span>
                </span>
              </li>
            ))}
          </ul>
        </Card>
      ))}

      {quoteTarget !== null && (
        <QuoteModal
          key={quoteTarget.id}
          request={quoteTarget}
          onClose={() => setQuoteTarget(null)}
        />
      )}

      {comparisonTarget !== null && (
        <ComparisonModal
          key={comparisonTarget.id}
          request={comparisonTarget}
          onClose={() => setComparisonTarget(null)}
        />
      )}
    </div>
  );
}
