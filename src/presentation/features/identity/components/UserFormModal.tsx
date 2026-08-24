/**
 * نموذج إضافة/تعديل موظف.
 * الإضافة تمرّ عبر Edge Function تملك service_role — المتصفّح لا ينشئ مستخدمين.
 */
import { useState, type FormEvent } from "react";
import type { EmployeeType } from "@core/modules/identity/entities/Profile";
import type { ProfileDto } from "@application/modules/identity/dtos";
import { Button } from "@presentation/shared/ui/Button";
import { Input } from "@presentation/shared/ui/Input";
import { Select } from "@presentation/shared/ui/Select";
import { FormField } from "@presentation/shared/ui/FormField";
import { Modal } from "@presentation/shared/ui/Modal";
import { useCreateUser, useUpdateProfile } from "../hooks/useIdentity";
import { errorMessage } from "@presentation/shared/lib/query";
import { EMPLOYEE_TYPE_OPTIONS } from "@presentation/shared/lib/employee-type";
import { t } from "@i18n/index";

export interface UserFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  /** null = إضافة موظف جديد. */
  profile: ProfileDto | null;
}

// ملاحظة: يُركَّب هذا المكوّن بـ key يتغيّر مع الموظف المعروض،
// فتُهيَّأ الحقول من الخصائص مباشرة بلا مزامنة عبر useEffect.

export function UserFormModal({ isOpen, onClose, profile }: UserFormModalProps) {
  const isEditing = profile !== null;
  const createUser = useCreateUser();
  const updateProfile = useUpdateProfile();

  const [fullName, setFullName] = useState(profile?.fullName ?? "");
  const [code, setCode] = useState(profile?.code ?? "");
  const [employeeType, setEmployeeType] = useState<EmployeeType>(
    profile?.employeeType ?? "admin",
  );
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

    try {
      if (isEditing) {
        await updateProfile.mutateAsync({
          id: profile.id,
          fullName,
          code: code.trim() === "" ? null : code,
          employeeType,
        });
      } else {
        await createUser.mutateAsync({
          email,
          password,
          fullName,
          employeeType,
          code: code.trim() === "" ? null : code,
        });
      }
      onClose();
    } catch (e) {
      setError(errorMessage(e));
    }
  }

  const isPending = createUser.isPending || updateProfile.isPending;

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={isEditing ? t.users.editTitle : t.users.createTitle}
      footer={
        <>
          <Button type="submit" form="user-form" isLoading={isPending}>
            {t.common.save}
          </Button>
          <Button variant="ghost" onClick={onClose}>
            {t.common.cancel}
          </Button>
        </>
      }
    >
      <form id="user-form" onSubmit={handleSubmit} className="flex flex-col gap-4">
        <FormField label={t.users.name} required>
          {(id) => (
            <Input
              id={id}
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              required
            />
          )}
        </FormField>

        <FormField label={t.users.code} hint="حروف إنجليزية وأرقام">
          {(id) => (
            <Input
              id={id}
              dir="ltr"
              value={code}
              onChange={(e) => setCode(e.target.value)}
            />
          )}
        </FormField>

        <FormField label={t.users.type} hint={t.users.typeHint} required>
          {(id) => (
            <Select
              id={id}
              options={EMPLOYEE_TYPE_OPTIONS}
              value={employeeType}
              onChange={(e) => setEmployeeType(e.target.value as EmployeeType)}
            />
          )}
        </FormField>

        {!isEditing && (
          <>
            <FormField label={t.users.email} required>
              {(id) => (
                <Input
                  id={id}
                  type="email"
                  dir="ltr"
                  autoComplete="off"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                />
              )}
            </FormField>

            <FormField label={t.auth.password} required hint={t.users.passwordHint}>
              {(id) => (
                <Input
                  id={id}
                  type="password"
                  dir="ltr"
                  autoComplete="new-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                />
              )}
            </FormField>
          </>
        )}

        {error !== null && (
          <p role="alert" className="text-danger text-sm">
            {error}
          </p>
        )}
      </form>
    </Modal>
  );
}
