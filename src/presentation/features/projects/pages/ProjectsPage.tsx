import { useState } from "react";
import { FolderPlus, Pencil, Trash2, Users } from "lucide-react";
import type { ProjectDto } from "@application/modules/projects/dtos";
import { Card } from "@presentation/shared/ui/Card";
import { Badge, type BadgeTone } from "@presentation/shared/ui/Badge";
import { Button } from "@presentation/shared/ui/Button";
import { DataTable, type Column } from "@presentation/shared/ui/DataTable";
import { EmptyState } from "@presentation/shared/ui/EmptyState";
import { PermissionGate } from "@presentation/shared/ui/PermissionGate";
import {
  formatDate,
  formatMoney,
  formatNumber,
} from "@presentation/shared/lib/formatters";
import { errorMessage } from "@presentation/shared/lib/query";
import { useAppSettings } from "@presentation/app/providers/settings-context";
import { useAuth } from "@presentation/app/providers/auth-context";
import { useDeleteProject, useProjects } from "../hooks/useProjects";
import { ProjectFormModal } from "../components/ProjectFormModal";
import { ProjectAssignmentsModal } from "../components/ProjectAssignmentsModal";
import { t } from "@i18n/index";

const STATUS_LABELS: Record<ProjectDto["status"], string> = {
  draft: t.projects.statusDraft,
  active: t.projects.statusActive,
  suspended: t.projects.statusSuspended,
  completed: t.projects.statusCompleted,
  cancelled: t.projects.statusCancelled,
};

const STATUS_TONES: Record<ProjectDto["status"], BadgeTone> = {
  draft: "neutral",
  active: "success",
  suspended: "warning",
  completed: "info",
  cancelled: "danger",
};

export function ProjectsPage() {
  const projects = useProjects();
  const deleteProject = useDeleteProject();
  const { currency } = useAppSettings();
  const { user } = useAuth();

  const [editing, setEditing] = useState<ProjectDto | null>(null);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [assignmentsTarget, setAssignmentsTarget] = useState<ProjectDto | null>(null);

  const columns: readonly Column<ProjectDto>[] = [
    {
      key: "code",
      header: t.projects.code,
      render: (row) => (
        <span className="text-content-muted font-mono text-xs">{row.code}</span>
      ),
    },
    {
      key: "name",
      header: t.projects.name,
      render: (row) => <span className="text-content font-medium">{row.name}</span>,
    },
    {
      key: "owner",
      header: t.projects.ownerEntity,
      render: (row) => (
        <span className="text-content-muted text-sm">{row.ownerEntity ?? "—"}</span>
      ),
    },
    {
      key: "value",
      header: t.projects.contractValue,
      numeric: true,
      render: (row) => formatMoney(row.contractValue, currency),
    },
    {
      key: "received",
      header: t.projects.receivedAt,
      render: (row) => (
        <span className="tabular text-content-muted text-sm">
          {row.receivedAt === null ? "—" : formatDate(row.receivedAt)}
        </span>
      ),
    },
    {
      key: "manager",
      header: t.projects.manager,
      render: (row) => (
        <span className="text-content-muted text-sm">{row.managerName ?? "—"}</span>
      ),
    },
    {
      key: "assignees",
      header: t.projects.assignees,
      numeric: true,
      render: (row) => formatNumber(row.assigneeCount),
    },
    {
      key: "status",
      header: t.projects.state,
      render: (row) => (
        <Badge tone={STATUS_TONES[row.status]}>{STATUS_LABELS[row.status]}</Badge>
      ),
    },
    {
      key: "actions",
      header: "",
      render: (row) => (
        <span className="flex items-center justify-end gap-1">
          <PermissionGate permission="project.assign">
            <Button
              variant="ghost"
              size="sm"
              aria-label={t.projects.assignmentsTitle}
              onClick={() => setAssignmentsTarget(row)}
              startIcon={<Users aria-hidden className="size-4" />}
            />
          </PermissionGate>

          <PermissionGate permission="project.update">
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

          <PermissionGate permission="project.delete">
            <Button
              variant="ghost"
              size="sm"
              aria-label={t.common.delete}
              onClick={() => {
                if (window.confirm(t.projects.deleteConfirm)) {
                  deleteProject.mutate(row.id);
                }
              }}
              startIcon={<Trash2 aria-hidden className="text-danger size-4" />}
            />
          </PermissionGate>
        </span>
      ),
    },
  ];

  return (
    <div className="mx-auto flex max-w-7xl flex-col gap-6">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-content text-xl font-extrabold">{t.projects.title}</h1>
          <p className="text-content-muted mt-1 text-sm">
            {user?.seesAllProjects === true ? t.common.all : t.projects.subtitle}
          </p>
        </div>

        <PermissionGate permission="project.create">
          <Button
            onClick={() => {
              setEditing(null);
              setIsFormOpen(true);
            }}
            startIcon={<FolderPlus aria-hidden className="size-4" />}
          >
            {t.projects.add}
          </Button>
        </PermissionGate>
      </header>

      <Card>
        {projects.isError ? (
          <EmptyState
            title={t.common.error}
            description={errorMessage(projects.error)}
          />
        ) : (
          <DataTable
            columns={columns}
            rows={projects.data ?? []}
            rowKey={(row) => row.id}
            isLoading={projects.isPending}
            emptyTitle={t.projects.empty}
            emptyDescription={t.projects.emptyHint}
          />
        )}
      </Card>

      {/* key يُعيد تركيب النموذج فتُهيَّأ حقوله من المشروع المعروض */}
      {isFormOpen && (
        <ProjectFormModal
          key={editing?.id ?? "new"}
          isOpen
          onClose={() => setIsFormOpen(false)}
          project={editing}
        />
      )}

      {assignmentsTarget !== null && (
        <ProjectAssignmentsModal
          isOpen
          onClose={() => setAssignmentsTarget(null)}
          project={assignmentsTarget}
        />
      )}
    </div>
  );
}
