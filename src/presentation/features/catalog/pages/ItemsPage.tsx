/**
 * شاشة الأصناف — معيار قبول المرحلة الثانية: بحث فوري بأي كلمة.
 * الاستعلام يُمرَّر كما هو إلى دالة Postgres التي تطبّع الحروف العربية،
 * فلا يوجد أي منطق بحث أو فلترة في المتصفّح.
 */
import { useState } from "react";
import { PackagePlus, Pencil, Search, Trash2 } from "lucide-react";
import type { ItemDto } from "@application/modules/catalog/dtos";
import { Card } from "@presentation/shared/ui/Card";
import { Badge } from "@presentation/shared/ui/Badge";
import { Button } from "@presentation/shared/ui/Button";
import { Input } from "@presentation/shared/ui/Input";
import { DataTable, type Column } from "@presentation/shared/ui/DataTable";
import { EmptyState } from "@presentation/shared/ui/EmptyState";
import { PermissionGate } from "@presentation/shared/ui/PermissionGate";
import { useDebounce } from "@presentation/shared/hooks/useDebounce";
import { formatNumber } from "@presentation/shared/lib/formatters";
import { errorMessage } from "@presentation/shared/lib/query";
import { useDeleteItem, useItemSearch } from "../hooks/useCatalog";
import { ItemFormModal } from "../components/ItemFormModal";
import { t } from "@i18n/index";

export function ItemsPage() {
  const [query, setQuery] = useState("");
  // نؤخّر الاستعلام قليلًا فلا نُرسل طلبًا مع كل حرف
  const debouncedQuery = useDebounce(query, 250);

  const items = useItemSearch(debouncedQuery);
  const deleteItem = useDeleteItem();

  const [editing, setEditing] = useState<ItemDto | null>(null);
  const [isFormOpen, setIsFormOpen] = useState(false);

  const columns: readonly Column<ItemDto>[] = [
    {
      key: "code",
      header: t.items.code,
      render: (row) => (
        <span className="text-content-muted font-mono text-xs">{row.code}</span>
      ),
    },
    {
      key: "name",
      header: t.items.name,
      render: (row) => <span className="text-content font-medium">{row.name}</span>,
    },
    {
      key: "unit",
      header: t.items.unit,
      render: (row) => <span className="text-content-muted text-sm">{row.unit}</span>,
    },
    {
      key: "category",
      header: t.items.category,
      render: (row) =>
        row.category === null ? (
          <span className="text-content-muted text-xs">—</span>
        ) : (
          <Badge tone="neutral">{row.category}</Badge>
        ),
    },
    {
      key: "state",
      header: t.items.state,
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
          <PermissionGate permission="item.update">
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

          <PermissionGate permission="item.delete">
            <Button
              variant="ghost"
              size="sm"
              aria-label={t.common.delete}
              onClick={() => {
                if (window.confirm(t.items.deleteConfirm)) deleteItem.mutate(row.id);
              }}
              startIcon={<Trash2 aria-hidden className="text-danger size-4" />}
            />
          </PermissionGate>
        </span>
      ),
    },
  ];

  const results = items.data ?? [];

  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-6">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-content text-xl font-extrabold">{t.items.title}</h1>
          <p className="text-content-muted mt-1 text-sm">{t.items.subtitle}</p>
        </div>

        <PermissionGate permission="item.create">
          <Button
            onClick={() => {
              setEditing(null);
              setIsFormOpen(true);
            }}
            startIcon={<PackagePlus aria-hidden className="size-4" />}
          >
            {t.items.add}
          </Button>
        </PermissionGate>
      </header>

      <Card>
        <div className="mb-4 flex flex-col gap-1.5">
          <div className="relative">
            <Search
              aria-hidden
              className="text-content-muted pointer-events-none absolute end-3 top-1/2 size-4 -translate-y-1/2"
            />
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={t.items.searchPlaceholder}
              aria-label={t.common.search}
              className="pe-9"
            />
          </div>
          <p className="text-content-muted text-xs">
            {t.items.searchHint}
            {!items.isPending && (
              <span className="tabular ms-2">
                · {formatNumber(results.length)} {t.items.resultCount}
              </span>
            )}
          </p>
        </div>

        {items.isError ? (
          <EmptyState title={t.common.error} description={errorMessage(items.error)} />
        ) : (
          <DataTable
            columns={columns}
            rows={results}
            rowKey={(row) => row.id}
            isLoading={items.isPending}
            emptyTitle={t.items.empty}
            emptyDescription={t.items.emptyHint}
          />
        )}
      </Card>

      {isFormOpen && (
        <ItemFormModal
          key={editing?.id ?? "new"}
          isOpen
          onClose={() => setIsFormOpen(false)}
          item={editing}
        />
      )}
    </div>
  );
}
