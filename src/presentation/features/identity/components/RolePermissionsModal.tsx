/**
 * مصفوفة صلاحيات الدور، مجمّعة حسب الوحدة.
 * الحفظ يستبدل صلاحيات الدور بالكامل بما هو محدَّد.
 */
import { useMemo, useState } from "react";
import type { PermissionDto, RoleDto } from "@application/modules/identity/dtos";
import { Button } from "@presentation/shared/ui/Button";
import { Checkbox } from "@presentation/shared/ui/Checkbox";
import { Modal } from "@presentation/shared/ui/Modal";
import { Spinner } from "@presentation/shared/ui/Spinner";
import { errorMessage } from "@presentation/shared/lib/query";
import { usePermissionsCatalog, useSetRolePermissions } from "../hooks/useIdentity";
import { t } from "@i18n/index";

const MODULE_LABELS: Record<string, string> = {
  core: "النظام",
  identity: "الهوية والموظفون",
  projects: "المشاريع",
};

export interface RolePermissionsModalProps {
  isOpen: boolean;
  onClose: () => void;
  role: RoleDto;
}

export function RolePermissionsModal({
  isOpen,
  onClose,
  role,
}: RolePermissionsModalProps) {
  const catalog = usePermissionsCatalog();
  const save = useSetRolePermissions();

  /**
   * التحديد مشتقّ لا مُزامَن: الأساس هو صلاحيات الدور الحالية، وفوقه
   * تعديلات المستخدم. هكذا يعمل بمجرد وصول القائمة بلا useEffect.
   */
  const [changes, setChanges] = useState<ReadonlyMap<string, boolean>>(new Map());
  const [error, setError] = useState<string | null>(null);

  const permissions = useMemo(() => catalog.data ?? [], [catalog.data]);

  const selectedIds = useMemo(() => {
    const ids = new Set(
      permissions
        .filter((permission) => role.permissionKeys.includes(permission.key))
        .map((permission) => permission.id),
    );
    for (const [id, isChecked] of changes) {
      if (isChecked) ids.add(id);
      else ids.delete(id);
    }
    return ids;
  }, [permissions, role, changes]);

  const grouped = useMemo(() => {
    const map = new Map<string, PermissionDto[]>();
    for (const permission of permissions) {
      const list = map.get(permission.module) ?? [];
      list.push(permission);
      map.set(permission.module, list);
    }
    return [...map.entries()];
  }, [permissions]);

  function toggle(id: string, checked: boolean) {
    setChanges((previous) => new Map(previous).set(id, checked));
  }

  async function handleSave() {
    setError(null);
    try {
      await save.mutateAsync({
        roleId: role.id,
        permissionIds: [...selectedIds],
      });
      onClose();
    } catch (e) {
      setError(errorMessage(e));
    }
  }

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={t.roles.editPermissionsFor}
      description={role.name}
      footer={
        <>
          <Button onClick={() => void handleSave()} isLoading={save.isPending}>
            {t.common.save}
          </Button>
          <Button variant="ghost" onClick={onClose}>
            {t.common.cancel}
          </Button>
        </>
      }
    >
      {catalog.isPending ? (
        <Spinner />
      ) : (
        <div className="flex flex-col gap-5">
          {grouped.map(([module, items]) => (
            <section key={module}>
              <h3 className="text-content mb-2 text-sm font-bold">
                {MODULE_LABELS[module] ?? module}
              </h3>
              <div className="grid gap-2 sm:grid-cols-2">
                {items.map((permission) => (
                  <Checkbox
                    key={permission.id}
                    label={permission.description}
                    hint={permission.key}
                    checked={selectedIds.has(permission.id)}
                    onChange={(e) => toggle(permission.id, e.target.checked)}
                  />
                ))}
              </div>
            </section>
          ))}
        </div>
      )}

      {error !== null && (
        <p role="alert" className="text-danger mt-3 text-sm">
          {error}
        </p>
      )}
    </Modal>
  );
}
