import { useState, type FormEvent } from "react";
import type { ProjectStatus } from "@core/modules/projects/entities/Project";
import type { ProjectDto } from "@application/modules/projects/dtos";
import { Button } from "@presentation/shared/ui/Button";
import { Input } from "@presentation/shared/ui/Input";
import { Select } from "@presentation/shared/ui/Select";
import { FormField } from "@presentation/shared/ui/FormField";
import { Modal } from "@presentation/shared/ui/Modal";
import { errorMessage } from "@presentation/shared/lib/query";
import { useProfiles } from "@presentation/features/identity/hooks/useIdentity";
import { useAppSettings } from "@presentation/app/providers/settings-context";
import { useCreateProject, useUpdateProject } from "../hooks/useProjects";
import { t } from "@i18n/index";

const STATUS_OPTIONS = [
  { value: "draft", label: t.projects.statusDraft },
  { value: "active", label: t.projects.statusActive },
  { value: "suspended", label: t.projects.statusSuspended },
  { value: "completed", label: t.projects.statusCompleted },
  { value: "cancelled", label: t.projects.statusCancelled },
] as const;

export interface ProjectFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  /** null = إضافة مشروع جديد. */
  project: ProjectDto | null;
}

// يُركَّب بـ key يتغيّر مع المشروع المعروض، فتُهيَّأ الحقول من الخصائص مباشرة.

export function ProjectFormModal({ isOpen, onClose, project }: ProjectFormModalProps) {
  const isEditing = project !== null;
  const createProject = useCreateProject();
  const updateProject = useUpdateProject();
  const profiles = useProfiles();
  const { currency } = useAppSettings();

  const [code, setCode] = useState(project?.code ?? "");
  const [name, setName] = useState(project?.name ?? "");
  const [ownerEntity, setOwnerEntity] = useState(project?.ownerEntity ?? "");
  const [contractValue, setContractValue] = useState(
    String(project?.contractValue ?? 0),
  );
  const [receivedAt, setReceivedAt] = useState(project?.receivedAt ?? "");
  const [managerId, setManagerId] = useState(project?.managerId ?? "");
  const [extractsOfficerId, setExtractsOfficerId] = useState(
    project?.extractsOfficerId ?? "",
  );
  const [status, setStatus] = useState<ProjectStatus>(project?.status ?? "active");
  const [error, setError] = useState<string | null>(null);

  const staffOptions = (profiles.data ?? []).map((profile) => ({
    value: profile.id,
    label: profile.fullName,
  }));

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

    const payload = {
      code,
      name,
      ownerEntity: ownerEntity.trim() === "" ? null : ownerEntity,
      contractValue: Number(contractValue),
      receivedAt: receivedAt === "" ? null : receivedAt,
      managerId: managerId === "" ? null : managerId,
      extractsOfficerId: extractsOfficerId === "" ? null : extractsOfficerId,
      status,
    };

    try {
      if (isEditing) {
        await updateProject.mutateAsync({ ...payload, id: project.id });
      } else {
        await createProject.mutateAsync(payload);
      }
      onClose();
    } catch (e) {
      setError(errorMessage(e));
    }
  }

  const isPending = createProject.isPending || updateProject.isPending;

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={isEditing ? t.projects.editTitle : t.projects.createTitle}
      footer={
        <>
          <Button type="submit" form="project-form" isLoading={isPending}>
            {t.common.save}
          </Button>
          <Button variant="ghost" onClick={onClose}>
            {t.common.cancel}
          </Button>
        </>
      }
    >
      <form
        id="project-form"
        onSubmit={handleSubmit}
        className="grid gap-4 sm:grid-cols-2"
      >
        <FormField label={t.projects.code} required>
          {(id) => (
            <Input
              id={id}
              dir="ltr"
              value={code}
              onChange={(e) => setCode(e.target.value)}
              required
            />
          )}
        </FormField>

        <FormField label={t.projects.name} required>
          {(id) => (
            <Input
              id={id}
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
            />
          )}
        </FormField>

        <FormField label={t.projects.ownerEntity}>
          {(id) => (
            <Input
              id={id}
              value={ownerEntity}
              onChange={(e) => setOwnerEntity(e.target.value)}
            />
          )}
        </FormField>

        <FormField label={`${t.projects.contractValue} (${currency})`}>
          {(id) => (
            <Input
              id={id}
              type="number"
              min="0"
              step="0.01"
              dir="ltr"
              value={contractValue}
              onChange={(e) => setContractValue(e.target.value)}
            />
          )}
        </FormField>

        <FormField label={t.projects.receivedAt}>
          {(id) => (
            <Input
              id={id}
              type="date"
              value={receivedAt}
              onChange={(e) => setReceivedAt(e.target.value)}
            />
          )}
        </FormField>

        <FormField label={t.projects.state} required>
          {(id) => (
            <Select
              id={id}
              options={STATUS_OPTIONS}
              value={status}
              onChange={(e) => setStatus(e.target.value as ProjectStatus)}
            />
          )}
        </FormField>

        <FormField label={t.projects.manager}>
          {(id) => (
            <Select
              id={id}
              options={staffOptions}
              placeholder={t.projects.none}
              value={managerId}
              onChange={(e) => setManagerId(e.target.value)}
            />
          )}
        </FormField>

        <FormField label={t.projects.extractsOfficer}>
          {(id) => (
            <Select
              id={id}
              options={staffOptions}
              placeholder={t.projects.none}
              value={extractsOfficerId}
              onChange={(e) => setExtractsOfficerId(e.target.value)}
            />
          )}
        </FormField>

        {error !== null && (
          <p role="alert" className="text-danger text-sm sm:col-span-2">
            {error}
          </p>
        )}
      </form>
    </Modal>
  );
}
