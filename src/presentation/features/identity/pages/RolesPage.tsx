import { useState } from "react";
import { Plus, Pencil, Trash2, AlertTriangle, ShieldCheck } from "lucide-react";
import type { RoleDto } from "@application/modules/identity/dtos";
import { Card } from "@presentation/shared/ui/Card";
import { Badge } from "@presentation/shared/ui/Badge";
import { Button } from "@presentation/shared/ui/Button";
import { Modal } from "@presentation/shared/ui/Modal";
import { DataTable, type Column } from "@presentation/shared/ui/DataTable";
import { EmptyState } from "@presentation/shared/ui/EmptyState";
import { PermissionGate } from "@presentation/shared/ui/PermissionGate";
import { formatNumber } from "@presentation/shared/lib/formatters";
import { errorMessage } from "@presentation/shared/lib/query";
import { useRoles, useDeleteRole } from "../hooks/useIdentity";
import { RoleFormModal } from "../components/RoleFormModal";
import { t } from "@i18n/index";

export function RolesPage() {
  const roles = useRoles();
  const deleteRole = useDeleteRole();

  const [formModalOpen, setFormModalOpen] = useState(false);
  const [selectedRole, setSelectedRole] = useState<RoleDto | null>(null);
  const [deletingRole, setDeletingRole] = useState<RoleDto | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  function handleOpenCreate() {
    setSelectedRole(null);
    setFormModalOpen(true);
  }

  function handleOpenEdit(role: RoleDto) {
    setSelectedRole(role);
    setFormModalOpen(true);
  }

  function handleOpenDelete(role: RoleDto) {
    setDeleteError(null);
    setDeletingRole(role);
  }

  async function handleConfirmDelete() {
    if (!deletingRole) return;
    setDeleteError(null);

    try {
      await deleteRole.mutateAsync({ id: deletingRole.id });
      setDeletingRole(null);
    } catch (e) {
      setDeleteError(errorMessage(e));
    }
  }

  const columns: readonly Column<RoleDto>[] = [
    {
      key: "name",
      header: t.roles.role,
      render: (row) => (
        <span className="flex items-center gap-2">
          <span className="text-content font-medium">{row.name}</span>
          {row.isSystem ? (
            <Badge tone="neutral">{t.roles.systemRole}</Badge>
          ) : (
            <Badge tone="brand">{t.roles.customRole}</Badge>
          )}
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
      render: (row) => (
        <span className="flex items-center justify-end gap-1.5 font-medium">
          <ShieldCheck className="text-brand-600 size-4 opacity-70" />
          {formatNumber(row.permissionKeys.length)}
        </span>
      ),
    },
    {
      key: "actions",
      header: "",
      render: (row) => (
        <div className="flex justify-end gap-1">
          <PermissionGate permission="role.manage">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => handleOpenEdit(row)}
              startIcon={<Pencil aria-hidden className="size-4" />}
            >
              {t.roles.editRole}
            </Button>

            {!row.isSystem && (
              <Button
                variant="ghost"
                size="sm"
                className="text-danger hover:bg-danger/10 hover:text-danger"
                onClick={() => handleOpenDelete(row)}
                startIcon={<Trash2 aria-hidden className="size-4" />}
              >
                {t.roles.deleteRole}
              </Button>
            )}
          </PermissionGate>
        </div>
      ),
    },
  ];

  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-6">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-content text-xl font-extrabold">{t.roles.title}</h1>
          <p className="text-content-muted mt-1 text-sm">{t.roles.subtitle}</p>
        </div>

        <PermissionGate permission="role.manage">
          <Button
            variant="primary"
            onClick={handleOpenCreate}
            startIcon={<Plus aria-hidden className="size-4" />}
          >
            {t.roles.add}
          </Button>
        </PermissionGate>
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

      {/* نافذة إضافة أو تعديل الدور والصلاحيات */}
      {formModalOpen && (
        <RoleFormModal
          isOpen={formModalOpen}
          onClose={() => setFormModalOpen(false)}
          role={selectedRole}
        />
      )}

      {/* نافذة تأكيد حذف الدور */}
      {deletingRole !== null && (
        <Modal
          isOpen={deletingRole !== null}
          onClose={() => setDeletingRole(null)}
          title={t.roles.deleteConfirmTitle}
          size="sm"
          footer={
            <>
              <Button
                variant="danger"
                onClick={() => void handleConfirmDelete()}
                isLoading={deleteRole.isPending}
              >
                {t.roles.deleteRole}
              </Button>
              <Button
                variant="ghost"
                onClick={() => setDeletingRole(null)}
                disabled={deleteRole.isPending}
              >
                {t.common.cancel}
              </Button>
            </>
          }
        >
          <div className="flex flex-col gap-4">
            <div className="flex items-start gap-3">
              <div className="bg-danger/10 text-danger grid size-10 shrink-0 place-items-center rounded-full">
                <AlertTriangle className="size-5" />
              </div>
              <p className="text-content text-sm leading-relaxed">
                {t.roles.deleteConfirmMessage.replace("{name}", deletingRole.name)}
              </p>
            </div>

            {deleteError !== null && (
              <p role="alert" className="text-danger bg-danger/10 rounded-lg p-3 text-sm">
                {deleteError}
              </p>
            )}
          </div>
        </Modal>
      )}
    </div>
  );
}
