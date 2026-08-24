/**
 * إدارة اعتماد الموظفين على المشروع.
 * الاعتماد هو ما يفتح للموظف رؤية المشروع (RLS)، وحق التوقيع منفصل عنه
 * تطبيقًا لقاعدة: ممنوع التوقيع على مستند يخص مشروعًا غير معتمد عليه.
 */
import { useState } from "react";
import { Trash2, UserPlus } from "lucide-react";
import type {
  ProjectDto,
  ProjectAssignmentDto,
} from "@application/modules/projects/dtos";
import { Button } from "@presentation/shared/ui/Button";
import { Checkbox } from "@presentation/shared/ui/Checkbox";
import { Modal } from "@presentation/shared/ui/Modal";
import { Select } from "@presentation/shared/ui/Select";
import { DataTable, type Column } from "@presentation/shared/ui/DataTable";
import { errorMessage } from "@presentation/shared/lib/query";
import { useProfiles } from "@presentation/features/identity/hooks/useIdentity";
import {
  useAssignUserToProject,
  useProjectAssignments,
  useRemoveAssignment,
  useSetAssignmentCanSign,
} from "../hooks/useProjects";
import { t } from "@i18n/index";

export interface ProjectAssignmentsModalProps {
  isOpen: boolean;
  onClose: () => void;
  project: ProjectDto;
}

export function ProjectAssignmentsModal({
  isOpen,
  onClose,
  project,
}: ProjectAssignmentsModalProps) {
  const assignments = useProjectAssignments(project.id);
  const profiles = useProfiles();
  const assign = useAssignUserToProject(project.id);
  const setCanSign = useSetAssignmentCanSign(project.id);
  const remove = useRemoveAssignment(project.id);

  const [userId, setUserId] = useState("");
  const [canSign, setCanSignValue] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const assignedIds = new Set((assignments.data ?? []).map((a) => a.userId));
  const availableStaff = (profiles.data ?? [])
    .filter((profile) => profile.isActive && !assignedIds.has(profile.id))
    .map((profile) => ({ value: profile.id, label: profile.fullName }));

  async function handleAssign() {
    if (userId === "") return;
    setError(null);
    try {
      await assign.mutateAsync({ projectId: project.id, userId, canSign });
      setUserId("");
      setCanSignValue(false);
    } catch (e) {
      setError(errorMessage(e));
    }
  }

  const columns: readonly Column<ProjectAssignmentDto>[] = [
    {
      key: "name",
      header: t.users.name,
      render: (row) => <span className="text-content font-medium">{row.userName}</span>,
    },
    {
      key: "code",
      header: t.users.code,
      render: (row) => (
        <span className="text-content-muted font-mono text-xs">
          {row.userCode ?? "—"}
        </span>
      ),
    },
    {
      key: "canSign",
      header: t.projects.canSign,
      render: (row) => (
        <Checkbox
          label=""
          checked={row.canSign}
          onChange={(e) => setCanSign.mutate({ id: row.id, canSign: e.target.checked })}
        />
      ),
    },
    {
      key: "actions",
      header: "",
      render: (row) => (
        <span className="flex justify-end">
          <Button
            variant="ghost"
            size="sm"
            aria-label={t.projects.removeAssignment}
            onClick={() => remove.mutate(row.id)}
            startIcon={<Trash2 aria-hidden className="text-danger size-4" />}
          />
        </span>
      ),
    },
  ];

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={t.projects.assignmentsTitle}
      description={`${project.code} — ${project.name}`}
      footer={
        <Button variant="ghost" onClick={onClose}>
          {t.common.close}
        </Button>
      }
    >
      <div className="flex flex-col gap-4">
        <div className="bg-surface-sunken flex flex-wrap items-end gap-3 rounded-[var(--radius-control)] p-3">
          <div className="min-w-48 flex-1">
            <Select
              options={availableStaff}
              placeholder={t.projects.assignUser}
              value={userId}
              onChange={(e) => setUserId(e.target.value)}
              aria-label={t.projects.assignUser}
            />
          </div>

          <Checkbox
            label={t.projects.canSign}
            hint={t.projects.canSignHint}
            checked={canSign}
            onChange={(e) => setCanSignValue(e.target.checked)}
          />

          <Button
            onClick={() => void handleAssign()}
            disabled={userId === ""}
            isLoading={assign.isPending}
            startIcon={<UserPlus aria-hidden className="size-4" />}
          >
            {t.common.add}
          </Button>
        </div>

        {error !== null && (
          <p role="alert" className="text-danger text-sm">
            {error}
          </p>
        )}

        <DataTable
          columns={columns}
          rows={assignments.data ?? []}
          rowKey={(row) => row.id}
          isLoading={assignments.isPending}
          emptyTitle={t.projects.noAssignees}
        />
      </div>
    </Modal>
  );
}
