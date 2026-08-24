/**
 * إسناد الأدوار لموظف. تغيير الأدوار يغيّر صلاحياته فورًا في RLS،
 * فلا حاجة لأي مزامنة يدوية.
 */
import { useState } from "react";
import type { ProfileDto } from "@application/modules/identity/dtos";
import { Button } from "@presentation/shared/ui/Button";
import { Checkbox } from "@presentation/shared/ui/Checkbox";
import { Modal } from "@presentation/shared/ui/Modal";
import { Spinner } from "@presentation/shared/ui/Spinner";
import { errorMessage } from "@presentation/shared/lib/query";
import { useAssignRole, useRemoveRole, useRoles } from "../hooks/useIdentity";
import { t } from "@i18n/index";

export interface UserRolesModalProps {
  isOpen: boolean;
  onClose: () => void;
  profile: ProfileDto;
}

export function UserRolesModal({ isOpen, onClose, profile }: UserRolesModalProps) {
  const roles = useRoles();
  const assignRole = useAssignRole();
  const removeRole = useRemoveRole();
  const [error, setError] = useState<string | null>(null);

  async function toggle(roleId: string, roleKey: string, nextChecked: boolean) {
    setError(null);
    try {
      if (nextChecked) {
        await assignRole.mutateAsync({ userId: profile.id, roleId });
      } else {
        await removeRole.mutateAsync({ userId: profile.id, roleId });
      }
    } catch (e) {
      setError(`${roleKey}: ${errorMessage(e)}`);
    }
  }

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={t.users.manageRolesFor}
      description={profile.fullName}
      size="sm"
      footer={
        <Button variant="ghost" onClick={onClose}>
          {t.common.close}
        </Button>
      }
    >
      {roles.isPending ? (
        <Spinner />
      ) : (
        <div className="flex flex-col gap-3">
          {(roles.data ?? []).map((role) => (
            <Checkbox
              key={role.id}
              label={role.name}
              hint={role.description ?? role.key}
              checked={profile.roleKeys.includes(role.key)}
              onChange={(e) => void toggle(role.id, role.key, e.target.checked)}
            />
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
