/**
 * إضافة/تعديل وظيفة. الوظيفة تحمل دور الصلاحيات، فتعديل دورها أو قسمها
 * يسري على كل شاغليها فورًا — والنافذة تقول ذلك قبل الحفظ لا بعده.
 */
import { useState, type FormEvent } from "react";
import { AlertTriangle } from "lucide-react";
import type { DepartmentDto, JobDto } from "@application/modules/organization/dtos";
import { Button } from "@presentation/shared/ui/Button";
import { FormField } from "@presentation/shared/ui/FormField";
import { Input } from "@presentation/shared/ui/Input";
import { Modal } from "@presentation/shared/ui/Modal";
import { Combobox } from "@presentation/shared/ui/Combobox";
import { errorMessage } from "@presentation/shared/lib/query";
import { useRoles } from "@presentation/features/identity/hooks/useIdentity";
import { useSaveJob } from "../hooks/useOrganization";
import { departmentOptions } from "../lib/org-options";
import { t } from "@i18n/index";

export function JobModal({
  job,
  departmentId: initialDepartmentId,
  departments,
  onClose,
}: {
  job: JobDto | null;
  departmentId: string;
  departments: readonly DepartmentDto[];
  onClose: () => void;
}) {
  const save = useSaveJob();
  const roles = useRoles();

  const [departmentId, setDepartmentId] = useState(
    job?.departmentId ?? initialDepartmentId,
  );
  const [name, setName] = useState(job?.name ?? "");
  const [roleId, setRoleId] = useState(job?.roleId ?? "");
  const [description, setDescription] = useState(job?.description ?? "");
  const [error, setError] = useState<string | null>(null);

  const holders = job?.holderCount ?? 0;
  const roleChanged = job !== null && roleId !== job.roleId;
  const departmentChanged = job !== null && departmentId !== job.departmentId;

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    const siblings = departments.find((d) => d.id === departmentId)?.jobs.length ?? 0;
    try {
      await save.mutateAsync({
        id: job?.id ?? null,
        departmentId,
        name,
        roleId,
        description,
        sortOrder: job !== null && !departmentChanged ? job.sortOrder : siblings + 1,
      });
      onClose();
    } catch (e) {
      setError(errorMessage(e));
    }
  }

  return (
    <Modal
      isOpen
      onClose={onClose}
      title={job === null ? t.org.addJob : t.org.editJob}
      footer={
        <>
          <Button type="submit" form="job-form" isLoading={save.isPending}>
            {t.common.save}
          </Button>
          <Button variant="ghost" onClick={onClose}>
            {t.common.cancel}
          </Button>
        </>
      }
    >
      <form id="job-form" onSubmit={handleSubmit} className="flex flex-col gap-4">
        <FormField label={t.org.department} required>
          {(id) => (
            <Combobox
              id={id}
              options={departmentOptions(departments)}
              value={departmentId}
              onChange={setDepartmentId}
              placeholder={t.org.searchDepartment}
              noMatchesText={t.common.noSearchMatches}
            />
          )}
        </FormField>

        <FormField label={t.org.jobName} required>
          {(id) => (
            <Input
              id={id}
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={t.org.jobNamePlaceholder}
              required
            />
          )}
        </FormField>

        <FormField label={t.org.jobRole} hint={t.org.jobRoleHint} required>
          {(id) => (
            <Combobox
              id={id}
              options={(roles.data ?? []).map((role) => ({
                value: role.id,
                label: `${role.name} — ${t.users.permissionCount(role.permissionKeys.length)}`,
              }))}
              value={roleId}
              onChange={setRoleId}
              placeholder={t.org.chooseRole}
              noMatchesText={t.common.noSearchMatches}
            />
          )}
        </FormField>

        <FormField label={t.org.description}>
          {(id) => (
            <Input
              id={id}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          )}
        </FormField>

        {holders > 0 && (roleChanged || departmentChanged) && (
          <p className="text-warning bg-warning-soft flex items-start gap-2 rounded-[var(--radius-control)] p-3 text-xs">
            <AlertTriangle aria-hidden className="mt-0.5 size-4 shrink-0" />
            <span>
              {roleChanged && t.org.roleChangeWarning(holders)}
              {roleChanged && departmentChanged && " "}
              {departmentChanged && t.org.departmentChangeWarning(holders)}
            </span>
          </p>
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
