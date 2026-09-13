/**
 * الأقسام والوظائف.
 *
 *   التصنيف (إداري · تشغيلي) ← القسم ← الوظيفة (تحمل الصلاحيات) ← الموظف
 *
 * الحذف الممنوع لا يُخفى زرّه: يُضغط فيقول **لماذا** — زرٌّ يختفي بلا تفسير
 * يترك المستخدم يبحث عن مكانه.
 */
import { useState } from "react";
import {
  Briefcase,
  Building2,
  Lock,
  Pencil,
  Plus,
  ShieldCheck,
  Trash2,
  Users,
} from "lucide-react";
import type {
  Classification,
  DepartmentDto,
  JobDto,
} from "@application/modules/organization/dtos";
import {
  departmentDeleteBlock,
  jobDeleteBlock,
} from "@application/modules/organization/use-cases/OrganizationUseCases";
import { Badge } from "@presentation/shared/ui/Badge";
import { Button } from "@presentation/shared/ui/Button";
import { Card } from "@presentation/shared/ui/Card";
import { EmptyState } from "@presentation/shared/ui/EmptyState";
import { Spinner } from "@presentation/shared/ui/Spinner";
import { useConfirm } from "@presentation/shared/ui/useConfirm";
import { errorMessage } from "@presentation/shared/lib/query";
import { employeeTypeLabel } from "@presentation/shared/lib/employee-type";
import {
  useDeleteDepartment,
  useDeleteJob,
  useDepartments,
} from "../hooks/useOrganization";
import { CLASSIFICATIONS, sortDepartments } from "../lib/org-options";
import { DepartmentModal } from "../components/DepartmentModal";
import { JobModal } from "../components/JobModal";
import { t } from "@i18n/index";

type DepartmentForm = {
  department: DepartmentDto | null;
  classification: Classification;
};
type JobForm = { job: JobDto | null; departmentId: string };

export function OrganizationPage() {
  const departments = useDepartments();
  const deleteDepartment = useDeleteDepartment();
  const deleteJob = useDeleteJob();
  const { ask, dialog } = useConfirm();

  const [departmentForm, setDepartmentForm] = useState<DepartmentForm | null>(null);
  const [jobForm, setJobForm] = useState<JobForm | null>(null);

  const all = sortDepartments(departments.data ?? []);

  function askDeleteDepartment(department: DepartmentDto) {
    const blocked = departmentDeleteBlock(department);
    ask({
      title: t.org.deleteDepartment,
      ...(blocked === null
        ? {
            description: t.org.deleteDepartmentConfirm(department.name),
            confirmLabel: t.org.deleteDepartment,
          }
        : { blockedReason: blocked }),
      onConfirm: () => deleteDepartment.mutateAsync(department.id),
    });
  }

  function askDeleteJob(job: JobDto) {
    const blocked = jobDeleteBlock(job);
    ask({
      title: t.org.deleteJob,
      ...(blocked === null
        ? {
            description: t.org.deleteJobConfirm(job.name),
            confirmLabel: t.org.deleteJob,
          }
        : { blockedReason: blocked }),
      onConfirm: () => deleteJob.mutateAsync(job.id),
    });
  }

  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-6">
      <header>
        <h1 className="text-content text-xl font-extrabold">{t.org.title}</h1>
        <p className="text-content-muted mt-1 text-sm">{t.org.subtitle}</p>
        <ol className="text-content-muted mt-3 flex flex-wrap items-center gap-2 text-xs">
          {t.org.chain.map((step, i) => (
            <li key={step} className="flex items-center gap-2">
              {i > 0 && <span aria-hidden>←</span>}
              <span className="bg-surface-sunken border-border rounded-full border px-2.5 py-0.5">
                {step}
              </span>
            </li>
          ))}
        </ol>
      </header>

      {departments.isPending ? (
        <Card>
          <Spinner />
        </Card>
      ) : departments.isError ? (
        <Card>
          <EmptyState
            title={t.common.error}
            description={errorMessage(departments.error)}
          />
        </Card>
      ) : (
        <div className="grid gap-6 lg:grid-cols-2">
          {CLASSIFICATIONS.map((classification) => {
            const inClass = all.filter((d) => d.classification === classification);
            return (
              <section key={classification} className="flex flex-col gap-3">
                <div className="flex items-center justify-between gap-3">
                  <h2 className="text-content flex items-center gap-2 text-base font-bold">
                    <Building2 aria-hidden className="text-brand-600 size-5" />
                    {employeeTypeLabel(classification)}
                    <Badge tone="neutral">
                      {t.org.departmentsCount(inClass.length)}
                    </Badge>
                  </h2>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() =>
                      setDepartmentForm({ department: null, classification })
                    }
                    startIcon={<Plus aria-hidden className="size-4" />}
                  >
                    {t.org.addDepartment}
                  </Button>
                </div>

                {inClass.length === 0 ? (
                  <Card>
                    <EmptyState title={t.org.noDepartments} />
                  </Card>
                ) : (
                  inClass.map((department) => (
                    <DepartmentCard
                      key={department.id}
                      department={department}
                      onEdit={() =>
                        setDepartmentForm({
                          department,
                          classification: department.classification,
                        })
                      }
                      onDelete={() => askDeleteDepartment(department)}
                      onAddJob={() =>
                        setJobForm({ job: null, departmentId: department.id })
                      }
                      onEditJob={(job) =>
                        setJobForm({ job, departmentId: department.id })
                      }
                      onDeleteJob={askDeleteJob}
                    />
                  ))
                )}
              </section>
            );
          })}
        </div>
      )}

      {departmentForm !== null && (
        <DepartmentModal
          key={departmentForm.department?.id ?? `new-${departmentForm.classification}`}
          department={departmentForm.department}
          defaultClassification={departmentForm.classification}
          departments={all}
          onClose={() => setDepartmentForm(null)}
        />
      )}

      {jobForm !== null && (
        <JobModal
          key={jobForm.job?.id ?? `new-${jobForm.departmentId}`}
          job={jobForm.job}
          departmentId={jobForm.departmentId}
          departments={all}
          onClose={() => setJobForm(null)}
        />
      )}

      {dialog}
    </div>
  );
}

function DepartmentCard({
  department,
  onEdit,
  onDelete,
  onAddJob,
  onEditJob,
  onDeleteJob,
}: {
  department: DepartmentDto;
  onEdit: () => void;
  onDelete: () => void;
  onAddJob: () => void;
  onEditJob: (job: JobDto) => void;
  onDeleteJob: (job: JobDto) => void;
}) {
  return (
    <article className="border-border bg-surface rounded-[var(--radius-card)] border shadow-sm">
      <header className="border-border flex items-start justify-between gap-3 border-b px-4 py-3">
        <div className="min-w-0">
          <h3 className="text-content flex flex-wrap items-center gap-2 font-bold">
            {department.name}
            {department.restrictAttachments && (
              <Badge tone="warning">
                <Lock aria-hidden className="size-3" />
                {t.org.hiddenBadge}
              </Badge>
            )}
          </h3>
          {department.description !== "" && (
            <p className="text-content-muted mt-0.5 text-xs">
              {department.description}
            </p>
          )}
          <p className="text-content-muted mt-1 flex items-center gap-1.5 text-xs">
            <Users aria-hidden className="size-3.5" />
            {t.org.jobsCount(department.jobs.length)} ·{" "}
            {t.org.employeesCount(department.employeeCount)}
          </p>
        </div>
        <div className="flex shrink-0 gap-1">
          <Button
            variant="ghost"
            size="sm"
            aria-label={t.org.editDepartment}
            title={t.org.editDepartment}
            onClick={onEdit}
            startIcon={<Pencil aria-hidden className="size-4" />}
          />
          <Button
            variant="ghost"
            size="sm"
            aria-label={t.org.deleteDepartment}
            title={departmentDeleteBlock(department) ?? t.org.deleteDepartment}
            onClick={onDelete}
            startIcon={<Trash2 aria-hidden className="text-danger size-4" />}
          />
        </div>
      </header>

      <ul className="divide-border divide-y">
        {department.jobs.map((job) => (
          <li
            key={job.id}
            className="flex items-center justify-between gap-3 px-4 py-2.5"
          >
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <Briefcase aria-hidden className="text-content-muted size-4" />
                <span className="text-content text-sm font-medium">{job.name}</span>
                <Badge tone="brand" title={t.org.jobRole}>
                  <ShieldCheck aria-hidden className="size-3" />
                  {job.roleName}
                </Badge>
              </div>
              <p className="text-content-muted mt-0.5 text-xs">
                {t.org.holders(job.holderCount)}
                {job.description !== "" && ` · ${job.description}`}
              </p>
            </div>
            <div className="flex shrink-0 gap-1">
              <Button
                variant="ghost"
                size="sm"
                aria-label={t.org.editJob}
                title={t.org.editJob}
                onClick={() => onEditJob(job)}
                startIcon={<Pencil aria-hidden className="size-4" />}
              />
              <Button
                variant="ghost"
                size="sm"
                aria-label={t.org.deleteJob}
                title={jobDeleteBlock(job) ?? t.org.deleteJob}
                onClick={() => onDeleteJob(job)}
                startIcon={<Trash2 aria-hidden className="text-danger size-4" />}
              />
            </div>
          </li>
        ))}
        {department.jobs.length === 0 && (
          <li className="text-content-muted px-4 py-3 text-xs">{t.org.noJobs}</li>
        )}
      </ul>

      <footer className="border-border border-t px-4 py-2">
        <Button
          variant="ghost"
          size="sm"
          onClick={onAddJob}
          startIcon={<Plus aria-hidden className="size-4" />}
        >
          {t.org.addJob}
        </Button>
      </footer>
    </article>
  );
}
