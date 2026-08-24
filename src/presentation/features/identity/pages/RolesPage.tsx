import { useState } from "react";
import { Pencil } from "lucide-react";
import type { RoleDto } from "@application/modules/identity/dtos";
import { Card } from "@presentation/shared/ui/Card";
import { Badge } from "@presentation/shared/ui/Badge";
import { Button } from "@presentation/shared/ui/Button";
import { DataTable, type Column } from "@presentation/shared/ui/DataTable";
import { EmptyState } from "@presentation/shared/ui/EmptyState";
import { PermissionGate } from "@presentation/shared/ui/PermissionGate";
import { formatNumber } from "@presentation/shared/lib/formatters";
import { errorMessage } from "@presentation/shared/lib/query";
import { useRoles } from "../hooks/useIdentity";
import { RolePermissionsModal } from "../components/RolePermissionsModal";
import { t } from "@i18n/index";

export function RolesPage() {
  const roles = useRoles();
  const [editing, setEditing] = useState<RoleDto | null>(null);

  const columns: readonly Column<RoleDto>[] = [
    {
      key: "name",
      header: t.roles.role,
      render: (row) => (
        <span className="flex items-center gap-2">
          <span className="text-content font-medium">{row.name}</span>
          {row.isSystem && <Badge tone="neutral">{t.roles.systemRole}</Badge>}
        </span>
      ),
    },
    {
      key: "key",
      header: t.roles.key,
      render: (row) => (
        <span className="text-content-muted font-mono text-xs">{row.key}</span>
      ),
    },
    {
      key: "description",
      header: t.roles.description,
      render: (row) => (
        <span className="text-content-muted text-sm">{row.description ?? "—"}</span>
      ),
    },
    {
      key: "count",
      header: t.roles.permissionCount,
      numeric: true,
      render: (row) => formatNumber(row.permissionKeys.length),
    },
    {
      key: "actions",
      header: "",
      render: (row) => (
        <span className="flex justify-end">
          <PermissionGate permission="role.manage">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setEditing(row)}
              startIcon={<Pencil aria-hidden className="size-4" />}
            >
              {t.roles.editPermissions}
            </Button>
          </PermissionGate>
        </span>
      ),
    },
  ];

  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-6">
      <header>
        <h1 className="text-content text-xl font-extrabold">{t.roles.title}</h1>
        <p className="text-content-muted mt-1 text-sm">{t.roles.subtitle}</p>
      </header>

      <Card>
        {roles.isError ? (
          <EmptyState title={t.common.error} description={errorMessage(roles.error)} />
        ) : (
          <DataTable
            columns={columns}
            rows={roles.data ?? []}
            rowKey={(row) => row.id}
            isLoading={roles.isPending}
            emptyTitle={t.roles.empty}
          />
        )}
      </Card>

      {editing !== null && (
        <RolePermissionsModal isOpen onClose={() => setEditing(null)} role={editing} />
      )}
    </div>
  );
}
