/**
 * وظائف المشروع.
 *
 * المشروع يُبنى بالوظائف: تُضاف خانة «مدير مشروع» أو «مهندس»، ويملؤها أحد
 * **شاغلي** الوظيفة — والقائمة لا تعرض غيرهم. شاغلٌ وحيد يُختار تلقائيًّا،
 * والخانة تُضاف شاغرةً إن لم يُعرف شاغلها بعد.
 *
 * الخانة المملوءة هي ما يفتح للموظف رؤية المشروع (RLS) ويُوصل له مراحل
 * «وظيفة داخل المشروع»؛ وحق التوقيع منفصل عنها.
 */
import { useState } from "react";
import { Info, Plus, Trash2 } from "lucide-react";
import type {
  ProjectAssignmentDto,
  ProjectDto,
} from "@application/modules/projects/dtos";
import type { ProfileDto } from "@application/modules/identity/dtos";
import { Button } from "@presentation/shared/ui/Button";
import { Checkbox } from "@presentation/shared/ui/Checkbox";
import { Combobox } from "@presentation/shared/ui/Combobox";
import { DataTable, type Column } from "@presentation/shared/ui/DataTable";
import { FormField } from "@presentation/shared/ui/FormField";
import { Modal } from "@presentation/shared/ui/Modal";
import { errorMessage } from "@presentation/shared/lib/query";
import { useProfiles } from "@presentation/features/identity/hooks/useIdentity";
import { useDepartments } from "@presentation/features/organization/hooks/useOrganization";
import { jobOptions } from "@presentation/features/organization/lib/org-options";
import {
  useAssignUserToProject,
  useProjectAssignments,
  useRemoveAssignment,
  useSetAssignmentCanSign,
  useSetAssignmentHolder,
} from "../hooks/useProjects";
import { t } from "@i18n/index";

export interface ProjectAssignmentsModalProps {
  isOpen: boolean;
  onClose: () => void;
  project: ProjectDto;
}

/** الاسم والكود في سطر واحد: الكود يفرّق بين اسمين متشابهين. */
function holderOption(profile: ProfileDto) {
  return {
    value: profile.id,
    label:
      profile.code === null
        ? profile.fullName
        : `${profile.fullName} (${profile.code})`,
  };
}

export function ProjectAssignmentsModal({
  isOpen,
  onClose,
  project,
}: ProjectAssignmentsModalProps) {
  const assignments = useProjectAssignments(project.id);
  const profiles = useProfiles();
  const departments = useDepartments();
  const assign = useAssignUserToProject(project.id);
  const setCanSign = useSetAssignmentCanSign(project.id);
  const setHolder = useSetAssignmentHolder(project.id);
  const remove = useRemoveAssignment(project.id);

  const [jobId, setJobId] = useState("");
  /** null = لم يختر المستخدم بعد، فيُقترح الشاغل الوحيد إن وُجد. */
  const [userId, setUserId] = useState<string | null>(null);
  const [canSign, setCanSignValue] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const rows = assignments.data ?? [];
  const takenIds = new Set(rows.flatMap((a) => (a.userId === null ? [] : [a.userId])));

  /** شاغلو الوظيفة غير المسنَدين على المشروع — ومعهم شاغل الخانة نفسها. */
  function holdersOf(job: string, keep: string | null): ProfileDto[] {
    return (profiles.data ?? []).filter(
      (p) => p.isActive && p.jobId === job && (p.id === keep || !takenIds.has(p.id)),
    );
  }

  const candidates = jobId === "" ? [] : holdersOf(jobId, null);
  const effectiveUserId =
    userId ?? (candidates.length === 1 ? (candidates[0]?.id ?? "") : "");
  const holderHint =
    jobId === ""
      ? null
      : candidates.length === 0
        ? t.projects.noHolders
        : candidates.length === 1 && userId === null
          ? t.projects.onlyHolder
          : null;

  async function run(action: () => Promise<unknown>) {
    setError(null);
    try {
      await action();
    } catch (e) {
      setError(errorMessage(e));
    }
  }

  async function handleAdd() {
    if (jobId === "") return;
    await run(async () => {
      await assign.mutateAsync({
        projectId: project.id,
        jobId,
        userId: effectiveUserId === "" ? null : effectiveUserId,
        canSign,
      });
      setJobId("");
      setUserId(null);
      setCanSignValue(false);
    });
  }

  const columns: readonly Column<ProjectAssignmentDto>[] = [
    {
      key: "job",
      header: t.projects.job,
      render: (row) => (
        <span className="flex flex-col">
          <span className="text-content font-medium">{row.jobName}</span>
          <span className="text-content-muted text-xs">
            {row.departmentName ?? "—"}
          </span>
        </span>
      ),
    },
    {
      key: "holder",
      header: t.projects.holder,
      render: (row) => (
        <Combobox
          aria-label={t.projects.holder}
          options={holdersOf(row.jobId, row.userId).map(holderOption)}
          value={row.userId ?? ""}
          onChange={(next) =>
            void run(() =>
              setHolder.mutateAsync({ id: row.id, userId: next === "" ? null : next }),
            )
          }
          placeholder={t.projects.vacant}
          emptyOptionLabel={t.projects.vacant}
          noMatchesText={t.common.noSearchMatches}
          hasWarning={row.userId === null}
          className="min-w-48"
        />
      ),
    },
    {
      key: "canSign",
      header: t.projects.canSign,
      render: (row) => (
        <Checkbox
          label=""
          aria-label={t.projects.canSign}
          checked={row.canSign}
          onChange={(e) =>
            void run(() =>
              setCanSign.mutateAsync({ id: row.id, canSign: e.target.checked }),
            )
          }
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
            title={t.projects.removeAssignment}
            onClick={() => void run(() => remove.mutateAsync(row.id))}
            startIcon={<Trash2 aria-hidden className="text-danger size-4" />}
          />
        </span>
      ),
    },
  ];

  const vacant = rows.filter((r) => r.userId === null).length;

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={t.projects.assignmentsTitle}
      description={`${project.code} — ${project.name}`}
      size="lg"
      footer={
        <Button variant="ghost" onClick={onClose}>
          {t.common.close}
        </Button>
      }
    >
      <div className="flex flex-col gap-4">
        <p className="text-content-muted bg-surface-sunken flex items-start gap-2 rounded-[var(--radius-control)] p-3 text-xs leading-relaxed">
          <Info aria-hidden className="mt-0.5 size-4 shrink-0" />
          {t.projects.assignmentsHint}
        </p>

        <div className="border-border grid gap-3 rounded-[var(--radius-control)] border p-3 sm:grid-cols-2">
          <FormField label={t.projects.job} required>
            {(id) => (
              <Combobox
                id={id}
                options={jobOptions(departments.data ?? [])}
                value={jobId}
                onChange={(next) => {
                  setJobId(next);
                  setUserId(null);
                }}
                placeholder={t.projects.jobPlaceholder}
                noMatchesText={t.common.noSearchMatches}
              />
            )}
          </FormField>

          <FormField
            label={t.projects.holder}
            {...(holderHint === null ? {} : { hint: holderHint })}
          >
            {(id) => (
              <Combobox
                id={id}
                options={candidates.map(holderOption)}
                value={effectiveUserId}
                onChange={setUserId}
                placeholder={
                  jobId !== "" && candidates.length === 0
                    ? t.projects.leaveVacant
                    : t.projects.holderPlaceholder
                }
                emptyOptionLabel={t.projects.leaveVacant}
                noMatchesText={t.common.noSearchMatches}
                disabled={jobId === ""}
              />
            )}
          </FormField>

          <Checkbox
            label={t.projects.canSign}
            hint={t.projects.canSignHint}
            checked={canSign}
            onChange={(e) => setCanSignValue(e.target.checked)}
          />

          <div className="flex items-end justify-end">
            <Button
              onClick={() => void handleAdd()}
              disabled={jobId === ""}
              isLoading={assign.isPending}
              startIcon={<Plus aria-hidden className="size-4" />}
            >
              {t.projects.addJob}
            </Button>
          </div>
        </div>

        {vacant > 0 && (
          <p className="text-warning bg-warning-soft rounded-[var(--radius-control)] p-2 text-xs">
            {t.projects.vacantWarning(vacant)}
          </p>
        )}

        {error !== null && (
          <p role="alert" className="text-danger text-sm">
            {error}
          </p>
        )}

        <DataTable
          columns={columns}
          rows={rows}
          rowKey={(row) => row.id}
          isLoading={assignments.isPending}
          emptyTitle={t.projects.noAssignees}
        />
      </div>
    </Modal>
  );
}
