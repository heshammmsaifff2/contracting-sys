import { useState } from "react";
import { Layers, ListPlus, Pencil, Search } from "lucide-react";
import type { BoqItemDto } from "@application/modules/catalog/dtos";
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
import { useBoqSearch } from "../hooks/useCatalog";
import { BoqFormModal } from "../components/BoqFormModal";
import { BoqCompositionModal } from "../components/BoqCompositionModal";
import { t } from "@i18n/index";

export function BoqPage() {
  const [query, setQuery] = useState("");
  const boqItems = useBoqSearch(useDebounce(query, 250));

  const [editing, setEditing] = useState<BoqItemDto | null>(null);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [compositionTarget, setCompositionTarget] = useState<BoqItemDto | null>(null);

  const columns: readonly Column<BoqItemDto>[] = [
    {
      key: "code",
      header: t.boq.code,
      render: (row) => (
        <span className="text-content-muted font-mono text-xs">{row.code}</span>
      ),
    },
    {
      key: "name",
      header: t.boq.name,
      render: (row) => <span className="text-content font-medium">{row.name}</span>,
    },
    {
      key: "unit",
      header: t.boq.unit,
      render: (row) => <span className="text-content-muted text-sm">{row.unit}</span>,
    },
    {
      key: "components",
      header: t.boq.componentCount,
      numeric: true,
      render: (row) => (
        <Badge tone={row.componentCount > 0 ? "brand" : "neutral"}>
          {formatNumber(row.componentCount)}
        </Badge>
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
          <PermissionGate permission="boq.manage">
            <Button
              variant="ghost"
              size="sm"
              aria-label={t.boq.compositionTitle}
              onClick={() => setCompositionTarget(row)}
              startIcon={<Layers aria-hidden className="size-4" />}
            >
              {t.boq.components}
            </Button>
          </PermissionGate>

          <PermissionGate permission="boq.manage">
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
          <h1 className="text-content text-xl font-extrabold">{t.boq.title}</h1>
          <p className="text-content-muted mt-1 text-sm">{t.boq.subtitle}</p>
        </div>

        <PermissionGate permission="boq.manage">
          <Button
            onClick={() => {
              setEditing(null);
              setIsFormOpen(true);
            }}
            startIcon={<ListPlus aria-hidden className="size-4" />}
          >
            {t.boq.add}
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
            placeholder={t.boq.searchPlaceholder}
            aria-label={t.common.search}
            className="pe-9"
          />
        </div>

        {boqItems.isError ? (
          <EmptyState
            title={t.common.error}
            description={errorMessage(boqItems.error)}
          />
        ) : (
          <DataTable
            columns={columns}
            rows={boqItems.data ?? []}
            rowKey={(row) => row.id}
            isLoading={boqItems.isPending}
            emptyTitle={t.boq.empty}
          />
        )}
      </Card>

      {isFormOpen && (
        <BoqFormModal
          key={editing?.id ?? "new"}
          isOpen
          onClose={() => setIsFormOpen(false)}
          boqItem={editing}
        />
      )}

      {compositionTarget !== null && (
        <BoqCompositionModal
          key={compositionTarget.id}
          isOpen
          onClose={() => setCompositionTarget(null)}
          boqItem={compositionTarget}
        />
      )}
    </div>
  );
}
