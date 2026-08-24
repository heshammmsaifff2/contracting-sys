/**
 * مسارات سير العمل ومراحلها + تقرير المدد المعدّلة.
 * التوزيع الآلي [المراسلات 23] يُضبط هنا: كل معاملات النوع تذهب لموظف بعينه
 * بدل تجميعها على المدير.
 */
import { useState, type FormEvent } from "react";
import { GitBranch, Pencil, Plus, Trash2 } from "lucide-react";
import type {
  DurationChangeDto,
  WorkflowDefinitionDto,
  WorkflowStepDto,
} from "@application/modules/workflow/dtos";
import { Card } from "@presentation/shared/ui/Card";
import { Badge } from "@presentation/shared/ui/Badge";
import { Button } from "@presentation/shared/ui/Button";
import { Input } from "@presentation/shared/ui/Input";
import { Select } from "@presentation/shared/ui/Select";
import { Checkbox } from "@presentation/shared/ui/Checkbox";
import { FormField } from "@presentation/shared/ui/FormField";
import { Modal } from "@presentation/shared/ui/Modal";
import { DataTable, type Column } from "@presentation/shared/ui/DataTable";
import { EmptyState } from "@presentation/shared/ui/EmptyState";
import { PermissionGate } from "@presentation/shared/ui/PermissionGate";
import { formatDateTime, formatDuration } from "@presentation/shared/lib/formatters";
import { errorMessage } from "@presentation/shared/lib/query";
import {
  useProfiles,
  useRoles,
} from "@presentation/features/identity/hooks/useIdentity";
import {
  useDurationChanges,
  useRemoveWorkflowStep,
  useSaveWorkflowDefinition,
  useSaveWorkflowStep,
  useWorkflowDefinitions,
} from "../hooks/useWorkflow";
import { t } from "@i18n/index";

function DefinitionModal({
  definition,
  onClose,
}: {
  definition: WorkflowDefinitionDto | null;
  onClose: () => void;
}) {
  const save = useSaveWorkflowDefinition();
  const [transactionType, setTransactionType] = useState(
    definition?.transactionType ?? "",
  );
  const [name, setName] = useState(definition?.name ?? "");
  const [isActive, setIsActive] = useState(definition?.isActive ?? true);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    try {
      await save.mutateAsync({
        id: definition?.id ?? null,
        transactionType,
        name,
        isActive,
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
      title={
        definition === null ? t.workflowAdmin.createTitle : t.workflowAdmin.editTitle
      }
      footer={
        <>
          <Button type="submit" form="definition-form" isLoading={save.isPending}>
            {t.common.save}
          </Button>
          <Button variant="ghost" onClick={onClose}>
            {t.common.cancel}
          </Button>
        </>
      }
    >
      <form
        id="definition-form"
        onSubmit={handleSubmit}
        className="flex flex-col gap-4"
      >
        <FormField
          label={t.workflowAdmin.transactionType}
          required
          hint="حروف إنجليزية صغيرة وأرقام و _ فقط"
        >
          {(id) => (
            <Input
              id={id}
              dir="ltr"
              value={transactionType}
              onChange={(e) => setTransactionType(e.target.value)}
              required
            />
          )}
        </FormField>

        <FormField label={t.workflowAdmin.name} required>
          {(id) => (
            <Input
              id={id}
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
            />
          )}
        </FormField>

        <Checkbox
          label={t.workflowAdmin.active}
          checked={isActive}
          onChange={(e) => setIsActive(e.target.checked)}
        />

        {error !== null && (
          <p role="alert" className="text-danger text-sm">
            {error}
          </p>
        )}
      </form>
    </Modal>
  );
}

function StepModal({
  definitionId,
  step,
  nextOrder,
  onClose,
}: {
  definitionId: string;
  step: WorkflowStepDto | null;
  nextOrder: number;
  onClose: () => void;
}) {
  const save = useSaveWorkflowStep();
  const roles = useRoles();
  const profiles = useProfiles();

  const [orderNo, setOrderNo] = useState(String(step?.orderNo ?? nextOrder));
  const [name, setName] = useState(step?.name ?? "");
  const [roleId, setRoleId] = useState(step?.roleId ?? "");
  const [defaultAssigneeId, setDefaultAssigneeId] = useState(
    step?.defaultAssigneeId ?? "",
  );
  const [isProgramManager, setIsProgramManager] = useState(
    step?.isProgramManager ?? false,
  );
  const [isArchive, setIsArchive] = useState(step?.isArchive ?? false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    try {
      await save.mutateAsync({
        id: step?.id ?? null,
        definitionId,
        orderNo: Number(orderNo),
        name,
        roleId: roleId === "" ? null : roleId,
        defaultAssigneeId: defaultAssigneeId === "" ? null : defaultAssigneeId,
        isProgramManager,
        isArchive,
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
      title={t.workflowAdmin.stepTitle}
      footer={
        <>
          <Button type="submit" form="step-form" isLoading={save.isPending}>
            {t.common.save}
          </Button>
          <Button variant="ghost" onClick={onClose}>
            {t.common.cancel}
          </Button>
        </>
      }
    >
      <form
        id="step-form"
        onSubmit={handleSubmit}
        className="grid gap-4 sm:grid-cols-2"
      >
        <FormField label={t.workflowAdmin.stepOrder} required>
          {(id) => (
            <Input
              id={id}
              type="number"
              min="1"
              dir="ltr"
              value={orderNo}
              onChange={(e) => setOrderNo(e.target.value)}
              required
            />
          )}
        </FormField>

        <FormField label={t.workflowAdmin.stepName} required>
          {(id) => (
            <Input
              id={id}
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
            />
          )}
        </FormField>

        <FormField label={t.workflowAdmin.role}>
          {(id) => (
            <Select
              id={id}
              options={(roles.data ?? []).map((role) => ({
                value: role.id,
                label: role.name,
              }))}
              placeholder={t.projects.none}
              value={roleId}
              onChange={(e) => setRoleId(e.target.value)}
            />
          )}
        </FormField>

        <FormField
          label={t.workflowAdmin.defaultAssignee}
          hint="التوزيع الآلي بدل تجميع المعاملات على المدير"
        >
          {(id) => (
            <Select
              id={id}
              options={(profiles.data ?? [])
                .filter((profile) => profile.isActive)
                .map((profile) => ({ value: profile.id, label: profile.fullName }))}
              placeholder={t.projects.none}
              value={defaultAssigneeId}
              onChange={(e) => setDefaultAssigneeId(e.target.value)}
            />
          )}
        </FormField>

        <Checkbox
          label={t.workflowAdmin.isProgramManager}
          checked={isProgramManager}
          onChange={(e) => setIsProgramManager(e.target.checked)}
        />
        <Checkbox
          label={t.workflowAdmin.isArchive}
          checked={isArchive}
          onChange={(e) => setIsArchive(e.target.checked)}
        />

        {error !== null && (
          <p role="alert" className="text-danger text-sm sm:col-span-2">
            {error}
          </p>
        )}
      </form>
    </Modal>
  );
}

function DurationChangesCard() {
  const changes = useDurationChanges();

  const columns: readonly Column<DurationChangeDto>[] = [
    {
      key: "transaction",
      header: t.inbox.no,
      render: (row) => (
        <span className="tabular text-content-muted font-mono text-xs">
          #{row.transactionNo}
        </span>
      ),
    },
    {
      key: "step",
      header: t.inbox.step,
      render: (row) => (
        <span className="flex flex-col">
          <span className="text-content text-sm">{row.stepName}</span>
          <span className="text-content-muted text-[11px]">{row.assigneeName}</span>
        </span>
      ),
    },
    {
      key: "old",
      header: t.workflowAdmin.oldMinutes,
      numeric: true,
      render: (row) => (row.oldMinutes === null ? "—" : formatDuration(row.oldMinutes)),
    },
    {
      key: "new",
      header: t.workflowAdmin.newMinutes,
      numeric: true,
      render: (row) => (
        <span className="text-content font-medium">
          {formatDuration(row.newMinutes)}
        </span>
      ),
    },
    {
      key: "reason",
      header: t.transaction.reason,
      render: (row) => (
        <span className="text-content-muted text-sm">{row.reason || "—"}</span>
      ),
    },
    {
      key: "by",
      header: t.workflowAdmin.changedBy,
      render: (row) => (
        <span className="text-content-muted text-sm">{row.changedByName}</span>
      ),
    },
    {
      key: "at",
      header: t.workflowAdmin.changedAt,
      render: (row) => (
        <span className="tabular text-content-muted text-xs">
          {formatDateTime(row.changedAt)}
        </span>
      ),
    },
  ];

  return (
    <Card
      title={t.workflowAdmin.durationChanges}
      description={t.workflowAdmin.durationChangesHint}
    >
      {changes.isError ? (
        <EmptyState title={t.common.error} description={errorMessage(changes.error)} />
      ) : (
        <DataTable
          columns={columns}
          rows={changes.data ?? []}
          rowKey={(row) => row.id}
          isLoading={changes.isPending}
          emptyTitle={t.workflowAdmin.noChanges}
        />
      )}
    </Card>
  );
}

export function WorkflowAdminPage() {
  const definitions = useWorkflowDefinitions();
  const removeStep = useRemoveWorkflowStep();

  const [editingDefinition, setEditingDefinition] =
    useState<WorkflowDefinitionDto | null>(null);
  const [isDefinitionOpen, setIsDefinitionOpen] = useState(false);
  const [stepTarget, setStepTarget] = useState<{
    definitionId: string;
    step: WorkflowStepDto | null;
    nextOrder: number;
  } | null>(null);

  const rows = definitions.data ?? [];

  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-6">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-content text-xl font-extrabold">
            {t.workflowAdmin.title}
          </h1>
          <p className="text-content-muted mt-1 text-sm">{t.workflowAdmin.subtitle}</p>
        </div>

        <PermissionGate permission="workflow.manage">
          <Button
            onClick={() => {
              setEditingDefinition(null);
              setIsDefinitionOpen(true);
            }}
            startIcon={<GitBranch aria-hidden className="size-4" />}
          >
            {t.workflowAdmin.add}
          </Button>
        </PermissionGate>
      </header>

      {definitions.isError && (
        <Card>
          <EmptyState
            title={t.common.error}
            description={errorMessage(definitions.error)}
          />
        </Card>
      )}

      {!definitions.isError && rows.length === 0 && (
        <Card>
          <EmptyState
            title={t.workflowAdmin.empty}
            description={t.workflowAdmin.emptyHint}
          />
        </Card>
      )}

      {rows.map((definition) => (
        <Card
          key={definition.id}
          title={
            <span className="flex flex-wrap items-center gap-2">
              <span>{definition.name}</span>
              <span className="text-content-muted font-mono text-xs">
                {definition.transactionType}
              </span>
              <Badge tone={definition.isActive ? "success" : "neutral"}>
                {definition.isActive ? t.items.active : t.items.inactive}
              </Badge>
            </span>
          }
          actions={
            <PermissionGate permission="workflow.manage">
              <span className="flex gap-1">
                <Button
                  variant="ghost"
                  size="sm"
                  aria-label={t.common.edit}
                  onClick={() => {
                    setEditingDefinition(definition);
                    setIsDefinitionOpen(true);
                  }}
                  startIcon={<Pencil aria-hidden className="size-4" />}
                />
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() =>
                    setStepTarget({
                      definitionId: definition.id,
                      step: null,
                      nextOrder: definition.steps.length + 1,
                    })
                  }
                  startIcon={<Plus aria-hidden className="size-4" />}
                >
                  {t.workflowAdmin.addStep}
                </Button>
              </span>
            </PermissionGate>
          }
        >
          {definition.steps.length === 0 ? (
            <EmptyState title={t.workflowAdmin.noSteps} />
          ) : (
            <ul className="divide-border divide-y">
              {definition.steps.map((step) => (
                <li key={step.id} className="flex flex-wrap items-center gap-3 py-2.5">
                  <span className="bg-surface-sunken text-content grid size-7 shrink-0 place-items-center rounded-full text-xs font-bold">
                    {step.orderNo}
                  </span>

                  <span className="min-w-0 flex-1">
                    <span className="text-content block text-sm font-medium">
                      {step.name}
                    </span>
                    <span className="text-content-muted block text-xs">
                      {step.defaultAssigneeName !== null
                        ? `${t.workflowAdmin.defaultAssignee}: ${step.defaultAssigneeName}`
                        : (step.roleName ?? "—")}
                    </span>
                  </span>

                  {step.isProgramManager && (
                    <Badge tone="brand">{t.workflowAdmin.isProgramManager}</Badge>
                  )}
                  {step.isArchive && (
                    <Badge tone="info">{t.workflowAdmin.isArchive}</Badge>
                  )}

                  <PermissionGate permission="workflow.manage">
                    <span className="flex gap-1">
                      <Button
                        variant="ghost"
                        size="sm"
                        aria-label={t.common.edit}
                        onClick={() =>
                          setStepTarget({
                            definitionId: definition.id,
                            step,
                            nextOrder: step.orderNo,
                          })
                        }
                        startIcon={<Pencil aria-hidden className="size-4" />}
                      />
                      <Button
                        variant="ghost"
                        size="sm"
                        aria-label={t.common.delete}
                        onClick={() => removeStep.mutate(step.id)}
                        startIcon={
                          <Trash2 aria-hidden className="text-danger size-4" />
                        }
                      />
                    </span>
                  </PermissionGate>
                </li>
              ))}
            </ul>
          )}
        </Card>
      ))}

      <PermissionGate permission="duration.manage">
        <DurationChangesCard />
      </PermissionGate>

      {isDefinitionOpen && (
        <DefinitionModal
          key={editingDefinition?.id ?? "new"}
          definition={editingDefinition}
          onClose={() => setIsDefinitionOpen(false)}
        />
      )}

      {stepTarget !== null && (
        <StepModal
          key={stepTarget.step?.id ?? "new-step"}
          definitionId={stepTarget.definitionId}
          step={stepTarget.step}
          nextOrder={stepTarget.nextOrder}
          onClose={() => setStepTarget(null)}
        />
      )}
    </div>
  );
}
