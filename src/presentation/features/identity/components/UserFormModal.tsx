/**
 * نموذج إضافة/تعديل موظف.
 * الإضافة تمرّ عبر Edge Function تملك service_role — المتصفّح لا ينشئ مستخدمين.
 *
 * التصنيف لا يُكتب هنا: الموظف يرث قسمه وتصنيفه وصلاحياته من **وظيفته**،
 * والنموذج يعرض ما سيرثه قبل الحفظ. وتغيير الوظيفة يمنح صلاحيات، فيُقفل
 * لمن لا يملك إسناد الأدوار — والقاعدة ترفضه له كذلك.
 */
import { useState, type FormEvent } from "react";
import { ShieldAlert } from "lucide-react";
import type { ProfileDto } from "@application/modules/identity/dtos";
import { Button } from "@presentation/shared/ui/Button";
import { Input } from "@presentation/shared/ui/Input";
import { Combobox } from "@presentation/shared/ui/Combobox";
import { FormField } from "@presentation/shared/ui/FormField";
import { Modal } from "@presentation/shared/ui/Modal";
import { useAuth } from "@presentation/app/providers/auth-context";
import { useCreateUser, useUpdateProfile } from "../hooks/useIdentity";
import { useDepartments } from "@presentation/features/organization/hooks/useOrganization";
import {
  findJob,
  jobOptions,
} from "@presentation/features/organization/lib/org-options";
import { errorMessage } from "@presentation/shared/lib/query";
import { employeeTypeLabel } from "@presentation/shared/lib/employee-type";
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
  const departments = useDepartments();
  const { user } = useAuth();
  const canAssignJob = user?.can("user.assign_role") ?? false;

  const [fullName, setFullName] = useState(profile?.fullName ?? "");
  const [code, setCode] = useState(profile?.code ?? "");
  const [jobId, setJobId] = useState(profile?.jobId ?? "");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);

  const selected = jobId === "" ? null : findJob(departments.data ?? [], jobId);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    const nextJobId = jobId === "" ? null : jobId;

    try {
      if (isEditing) {
        // الوظيفة تُرسَل حين تتغيّر وحدها: إرسالها كما هي يستدعي حارس الصلاحية بلا داعٍ
        const jobChanged = nextJobId !== profile.jobId;
        await updateProfile.mutateAsync({
          id: profile.id,
          fullName,
          code: code.trim() === "" ? null : code,
          ...(jobChanged ? { jobId: nextJobId } : {}),
        });
      } else {
        await createUser.mutateAsync({
          email,
          password,
          fullName,
          jobId: canAssignJob ? nextJobId : null,
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

        <FormField
          label={t.users.job}
          hint={canAssignJob ? t.users.jobHint : t.users.jobLockedHint}
        >
          {(id) => (
            <Combobox
              id={id}
              options={jobOptions(departments.data ?? [])}
              value={jobId}
              onChange={setJobId}
              placeholder={
                canAssignJob ? t.users.jobSearchPlaceholder : t.users.jobPlaceholder
              }
              emptyOptionLabel={t.users.jobPlaceholder}
              noMatchesText={t.common.noSearchMatches}
              disabled={!canAssignJob}
            />
          )}
        </FormField>

        {selected !== null ? (
          <dl className="bg-surface-sunken grid gap-2 rounded-[var(--radius-control)] p-3 text-xs sm:grid-cols-3">
            <div>
              <dt className="text-content-muted">{t.users.derivedDepartment}</dt>
              <dd className="text-content font-medium">{selected.department.name}</dd>
            </div>
            <div>
              <dt className="text-content-muted">{t.users.type}</dt>
              <dd className="text-content font-medium">
                {employeeTypeLabel(selected.department.classification)}
              </dd>
            </div>
            <div>
              <dt className="text-content-muted">{t.users.derivedPermissions}</dt>
              <dd className="text-content font-medium">{selected.job.roleName}</dd>
            </div>
          </dl>
        ) : (
          <p className="text-warning bg-warning-soft flex items-start gap-2 rounded-[var(--radius-control)] p-2 text-xs">
            <ShieldAlert aria-hidden className="mt-0.5 size-4 shrink-0" />
            {t.users.noJobWarning}
          </p>
        )}

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
