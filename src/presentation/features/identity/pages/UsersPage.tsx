import { useState } from "react";
import { UserPlus, Pencil, ShieldCheck, Power } from "lucide-react";
import type { ProfileDto } from "@application/modules/identity/dtos";
import { Card } from "@presentation/shared/ui/Card";
import { Badge } from "@presentation/shared/ui/Badge";
import { Button } from "@presentation/shared/ui/Button";
import { DataTable, type Column } from "@presentation/shared/ui/DataTable";
import { EmptyState } from "@presentation/shared/ui/EmptyState";
import { PermissionGate } from "@presentation/shared/ui/PermissionGate";
import { errorMessage } from "@presentation/shared/lib/query";
import { useProfiles, useSetProfileActive } from "../hooks/useIdentity";
import { UserFormModal } from "../components/UserFormModal";
import { UserRolesModal } from "../components/UserRolesModal";
import { t } from "@i18n/index";

const TYPE_LABELS: Record<string, string> = {
  admin: t.users.typeAdmin,
  engineer: t.users.typeEngineer,
  supervisor: t.users.typeSupervisor,
};

export function UsersPage() {
  const profiles = useProfiles();
  const setActive = useSetProfileActive();

  const [editing, setEditing] = useState<ProfileDto | null>(null);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [rolesTarget, setRolesTarget] = useState<ProfileDto | null>(null);

  const columns: readonly Column<ProfileDto>[] = [
    {
      key: "name",
      header: t.users.name,
      render: (row) => <span className="text-content font-medium">{row.fullName}</span>,
    },
    {
      key: "code",
      header: t.users.code,
      render: (row) => (
        <span className="text-content-muted font-mono text-xs">{row.code ?? "—"}</span>
      ),
    },
    {
      key: "email",
      header: t.users.email,
      render: (row) => (
        <span dir="ltr" className="text-content-muted text-xs">
          {row.email ?? "—"}
        </span>
      ),
    },
    {
      key: "type",
      header: t.users.type,
      render: (row) => <Badge tone="neutral">{TYPE_LABELS[row.employeeType]}</Badge>,
    },
    {
      key: "roles",
      header: t.users.roles,
      render: (row) =>
        row.roleNames.length === 0 ? (
          <span className="text-content-muted text-xs">{t.users.noRoles}</span>
        ) : (
          <span className="flex flex-wrap gap-1">
            {row.roleNames.map((name) => (
              <Badge key={name} tone="brand">
                {name}
              </Badge>
            ))}
          </span>
        ),
    },
    {
      key: "state",
      header: t.users.state,
      render: (row) => (
        <Badge tone={row.isActive ? "success" : "danger"}>
          {row.isActive ? t.users.active : t.users.inactive}
        </Badge>
      ),
    },
    {
      key: "actions",
      header: "",
      render: (row) => (
        <span className="flex items-center justify-end gap-1">
          <PermissionGate permission="user.update">
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

          <PermissionGate permission="user.assign_role">
            <Button
              variant="ghost"
              size="sm"
              aria-label={t.users.manageRoles}
              onClick={() => setRolesTarget(row)}
              startIcon={<ShieldCheck aria-hidden className="size-4" />}
            />
          </PermissionGate>

          <PermissionGate permission="user.deactivate">
            <Button
              variant="ghost"
              size="sm"
              aria-label={row.isActive ? t.users.deactivate : t.users.activate}
              onClick={() => setActive.mutate({ id: row.id, isActive: !row.isActive })}
              startIcon={
                <Power
                  aria-hidden
                  className={
                    row.isActive ? "text-danger size-4" : "text-success size-4"
                  }
                />
              }
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
          <h1 className="text-content text-xl font-extrabold">{t.users.title}</h1>
          <p className="text-content-muted mt-1 text-sm">{t.users.subtitle}</p>
        </div>

        <PermissionGate permission="user.create">
          <Button
            onClick={() => {
              setEditing(null);
              setIsFormOpen(true);
            }}
            startIcon={<UserPlus aria-hidden className="size-4" />}
          >
            {t.users.add}
          </Button>
        </PermissionGate>
      </header>

      <Card>
        {profiles.isError ? (
          <EmptyState
            title={t.common.error}
            description={errorMessage(profiles.error)}
          />
        ) : (
          <DataTable
            columns={columns}
            rows={profiles.data ?? []}
            rowKey={(row) => row.id}
            isLoading={profiles.isPending}
            emptyTitle={t.users.empty}
          />
        )}
      </Card>

      {/* key يُعيد تركيب النموذج فتُهيَّأ حقوله من الموظف المعروض */}
      {isFormOpen && (
        <UserFormModal
          key={editing?.id ?? "new"}
          isOpen
          onClose={() => setIsFormOpen(false)}
          profile={editing}
        />
      )}

      {rolesTarget !== null && (
        <UserRolesModal
          isOpen
          onClose={() => setRolesTarget(null)}
          profile={rolesTarget}
        />
      )}
    </div>
  );
}
