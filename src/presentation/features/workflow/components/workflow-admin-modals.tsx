/**
 * نوافذ تحرير تعريف المسار — مشتركة بين العرض القائمي ومحرّر الخريطة.
 *
 * اُنتزعت من `WorkflowAdminPage` حين صار للتعريف عرضان: النافذة نفسها تُفتح
 * من سطر في قائمة أو من عقدة على لوحة، ونسختان منها كانتا ستتباعدان عند أول
 * حقل يُضاف إلى إحداهما.
 */
import { useState, type FormEvent } from "react";
import type {
  ConflictPolicy,
  JoinPolicy,
  ParticipantKind,
  StageRequirementDto,
  WorkflowActionDto,
  WorkflowDefinitionDto,
  WorkflowStageDto,
} from "@application/modules/workflow/dtos";
import type { CompletionPolicy } from "@core/modules/workflow/entities/StageInstance";
import type {
  ClaimPolicy,
  RequirementKind,
  RequirementScope,
} from "@core/modules/workflow/entities/WorkflowGovernance";
import type { ActionKind } from "@core/modules/workflow/entities/WorkflowAction";
import {
  actionCarriesRoutes,
  actionSupportsReturnMinutes,
} from "@core/modules/workflow/entities/WorkflowAction";
import {
  describeCondition,
  type ConditionOp,
  type WorkflowCondition,
} from "@core/modules/workflow/entities/WorkflowCondition";
import { Button } from "@presentation/shared/ui/Button";
import { Input } from "@presentation/shared/ui/Input";
import { Select } from "@presentation/shared/ui/Select";
import { Checkbox } from "@presentation/shared/ui/Checkbox";
import { FormField } from "@presentation/shared/ui/FormField";
import { Modal } from "@presentation/shared/ui/Modal";
import { errorMessage } from "@presentation/shared/lib/query";
import {
  useProfiles,
  useRoles,
} from "@presentation/features/identity/hooks/useIdentity";
import {
  useSaveActionRoute,
  useSaveStageRequirement,
  useSaveStageParticipant,
  useSaveWorkflowAction,
  useSaveWorkflowDefinition,
  useSaveWorkflowStage,
} from "../hooks/useWorkflow";
import {
  ACTION_KIND_OPTIONS,
  CLAIM_OPTIONS,
  CONFLICT_OPTIONS,
  JOIN_OPTIONS,
  KIND_OPTIONS,
  OP_OPTIONS,
  POLICY_OPTIONS,
} from "./workflow-admin-options";
import { t } from "@i18n/index";

export function DefinitionModal({
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
        <FormField label={t.workflowAdmin.transactionType} required>
          {(id) => (
            <Input
              id={id}
              dir="ltr"
              value={transactionType}
              onChange={(e) => setTransactionType(e.target.value)}
              disabled={definition !== null}
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

        {/*
          «مفعّل» صفةُ المنشور وحده: المسار الجديد يُبنى مسودّةً ثم يُنشر
          فيصير حيًّا. وعرضُ مربّعٍ لا أثر له يُعلّم المستخدم تجاهل المربّعات.
        */}
        {definition === null || definition.status !== "published" ? (
          <p className="border-border bg-surface-sunken text-content-muted rounded-[var(--radius-control)] border p-2 text-xs">
            {t.governance.newIsDraft}
          </p>
        ) : (
          <Checkbox
            label={t.workflowAdmin.active}
            hint={t.governance.activeHint}
            checked={isActive}
            onChange={(e) => setIsActive(e.target.checked)}
          />
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

export function StageModal({
  definitionId,
  stage,
  siblings,
  nextOrder,
  onClose,
}: {
  definitionId: string;
  stage: WorkflowStageDto | null;
  /** بقيّة مراحل المسار — لاختيار «المرحلة التالية». */
  siblings: readonly WorkflowStageDto[];
  nextOrder: number;
  onClose: () => void;
}) {
  const save = useSaveWorkflowStage();

  const [stageKey, setStageKey] = useState(stage?.stageKey ?? "");
  const [name, setName] = useState(stage?.name ?? "");
  const [sortOrder, setSortOrder] = useState(String(stage?.sortOrder ?? nextOrder));
  const [completionPolicy, setCompletionPolicy] = useState<CompletionPolicy>(
    stage?.completionPolicy ?? "all",
  );
  const [quorumCount, setQuorumCount] = useState(String(stage?.quorumCount ?? 2));
  const [slaMinutes, setSlaMinutes] = useState(
    stage?.slaMinutes === null || stage?.slaMinutes === undefined
      ? ""
      : String(stage.slaMinutes),
  );
  const [defaultNextStageId, setDefaultNextStageId] = useState(
    stage?.defaultNextStageId ?? "",
  );
  const [isStart, setIsStart] = useState(stage?.isStart ?? false);
  const [isFinal, setIsFinal] = useState(stage?.isFinal ?? false);
  const [isProgramManager, setIsProgramManager] = useState(
    stage?.isProgramManager ?? false,
  );
  const [isArchive, setIsArchive] = useState(stage?.isArchive ?? false);
  const [requiresReceive, setRequiresReceive] = useState(
    stage?.requiresReceive ?? false,
  );
  const [joinPolicy, setJoinPolicy] = useState<JoinPolicy>(stage?.joinPolicy ?? "none");
  const [conflictPolicy, setConflictPolicy] = useState<ConflictPolicy>(
    stage?.conflictPolicy ?? "backward_wins",
  );
  const [claimPolicy, setClaimPolicy] = useState<ClaimPolicy>(
    stage?.claimPolicy ?? "none",
  );
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    try {
      await save.mutateAsync({
        id: stage?.id ?? null,
        definitionId,
        stageKey,
        name,
        sortOrder: Number(sortOrder),
        completionPolicy,
        quorumCount: completionPolicy === "quorum" ? Number(quorumCount) : null,
        isStart,
        // المرحلة النهائية لا تُوجَّه إلى ما بعدها
        isFinal,
        isArchive,
        isProgramManager,
        requiresReceive,
        slaMinutes: slaMinutes.trim() === "" ? null : Number(slaMinutes),
        defaultNextStageId:
          isFinal || defaultNextStageId === "" ? null : defaultNextStageId,
        joinPolicy,
        conflictPolicy,
        claimPolicy,
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
      title={t.workflowAdmin.stageTitle}
      footer={
        <>
          <Button type="submit" form="stage-form" isLoading={save.isPending}>
            {t.common.save}
          </Button>
          <Button variant="ghost" onClick={onClose}>
            {t.common.cancel}
          </Button>
        </>
      }
    >
      <form
        id="stage-form"
        onSubmit={handleSubmit}
        className="grid gap-4 sm:grid-cols-2"
      >
        <FormField label={t.workflowAdmin.stageName} required>
          {(id) => (
            <Input
              id={id}
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
            />
          )}
        </FormField>

        <FormField
          label={t.workflowAdmin.stageKey}
          hint={t.workflowAdmin.stageKeyHint}
          required
        >
          {(id) => (
            <Input
              id={id}
              dir="ltr"
              value={stageKey}
              onChange={(e) => setStageKey(e.target.value)}
              disabled={stage !== null}
              required
            />
          )}
        </FormField>

        <FormField label={t.workflowAdmin.completionPolicy} required>
          {(id) => (
            <Select
              id={id}
              options={POLICY_OPTIONS}
              value={completionPolicy}
              onChange={(e) => setCompletionPolicy(e.target.value as CompletionPolicy)}
            />
          )}
        </FormField>

        {completionPolicy === "quorum" ? (
          <FormField label={t.workflowAdmin.quorumCount} required>
            {(id) => (
              <Input
                id={id}
                type="number"
                min="1"
                dir="ltr"
                value={quorumCount}
                onChange={(e) => setQuorumCount(e.target.value)}
                required
              />
            )}
          </FormField>
        ) : (
          <FormField label={t.workflowAdmin.stageOrder}>
            {(id) => (
              <Input
                id={id}
                type="number"
                min="1"
                dir="ltr"
                value={sortOrder}
                onChange={(e) => setSortOrder(e.target.value)}
              />
            )}
          </FormField>
        )}

        <FormField label={t.workflowAdmin.slaMinutes} hint={t.workflowAdmin.slaHint}>
          {(id) => (
            <Input
              id={id}
              type="number"
              min="1"
              dir="ltr"
              value={slaMinutes}
              onChange={(e) => setSlaMinutes(e.target.value)}
            />
          )}
        </FormField>

        <FormField label={t.workflowAdmin.nextStage} hint={t.workflowAdmin.noNextStage}>
          {(id) => (
            <Select
              id={id}
              options={siblings
                .filter((s) => s.id !== stage?.id)
                .map((s) => ({ value: s.id, label: s.name }))}
              placeholder={t.projects.none}
              value={defaultNextStageId}
              onChange={(e) => setDefaultNextStageId(e.target.value)}
              disabled={isFinal}
            />
          )}
        </FormField>

        <FormField label={t.workflowAdmin.joinPolicy}>
          {(id) => (
            <Select
              id={id}
              options={JOIN_OPTIONS}
              value={joinPolicy}
              onChange={(e) => setJoinPolicy(e.target.value as JoinPolicy)}
            />
          )}
        </FormField>

        <FormField label={t.workflowAdmin.conflictPolicy}>
          {(id) => (
            <Select
              id={id}
              options={CONFLICT_OPTIONS}
              value={conflictPolicy}
              onChange={(e) => setConflictPolicy(e.target.value as ConflictPolicy)}
            />
          )}
        </FormField>

        <FormField label={t.workflowAdmin.claimPolicy} hint={t.workflowAdmin.claimHint}>
          {(id) => (
            <Select
              id={id}
              options={CLAIM_OPTIONS}
              value={claimPolicy}
              onChange={(e) => setClaimPolicy(e.target.value as ClaimPolicy)}
            />
          )}
        </FormField>

        <Checkbox
          label={t.workflowAdmin.isStart}
          checked={isStart}
          onChange={(e) => setIsStart(e.target.checked)}
        />
        <Checkbox
          label={t.workflowAdmin.isFinal}
          checked={isFinal}
          onChange={(e) => setIsFinal(e.target.checked)}
        />
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
        <Checkbox
          label={t.workflowAdmin.requiresReceive}
          checked={requiresReceive}
          onChange={(e) => setRequiresReceive(e.target.checked)}
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

/** إضافة مشارك ثانٍ هي ما يجعل المرحلة تقف عند أكثر من موظف. */
export function ParticipantModal({
  stage,
  onClose,
}: {
  stage: WorkflowStageDto;
  onClose: () => void;
}) {
  const save = useSaveStageParticipant();
  const roles = useRoles();
  const profiles = useProfiles();

  const [kind, setKind] = useState<ParticipantKind>("user");
  const [userId, setUserId] = useState("");
  const [roleId, setRoleId] = useState("");
  const [isOptional, setIsOptional] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    try {
      await save.mutateAsync({
        id: null,
        stageId: stage.id,
        kind,
        userId: kind === "user" && userId !== "" ? userId : null,
        roleId: kind === "role" && roleId !== "" ? roleId : null,
        departmentId: null,
        isOptional,
        sortOrder: stage.participants.length + 1,
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
      title={t.workflowAdmin.participantTitle}
      description={stage.name}
      footer={
        <>
          <Button type="submit" form="participant-form" isLoading={save.isPending}>
            {t.common.save}
          </Button>
          <Button variant="ghost" onClick={onClose}>
            {t.common.cancel}
          </Button>
        </>
      }
    >
      <form
        id="participant-form"
        onSubmit={handleSubmit}
        className="flex flex-col gap-4"
      >
        <FormField
          label={t.workflowAdmin.participantKind}
          hint={t.workflowAdmin.participantsHint}
          required
        >
          {(id) => (
            <Select
              id={id}
              options={KIND_OPTIONS}
              value={kind}
              onChange={(e) => setKind(e.target.value as ParticipantKind)}
            />
          )}
        </FormField>

        {kind === "user" && (
          <FormField label={t.workflowAdmin.employee} required>
            {(id) => (
              <Select
                id={id}
                options={(profiles.data ?? [])
                  .filter((profile) => profile.isActive)
                  .map((profile) => ({ value: profile.id, label: profile.fullName }))}
                placeholder={t.projects.none}
                value={userId}
                onChange={(e) => setUserId(e.target.value)}
              />
            )}
          </FormField>
        )}

        {kind === "role" && (
          <FormField label={t.workflowAdmin.role} required>
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
        )}

        <Checkbox
          label={t.workflowAdmin.isOptional}
          hint={t.workflowAdmin.isOptionalHint}
          checked={isOptional}
          onChange={(e) => setIsOptional(e.target.checked)}
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

/** زرّ على مرحلة: النوع يحدّد لونه وسلوكه ووجود وجهة له. */
export function ActionModal({
  stage,
  action,
  onClose,
}: {
  stage: WorkflowStageDto;
  action: WorkflowActionDto | null;
  onClose: () => void;
}) {
  const save = useSaveWorkflowAction();

  const [actionKey, setActionKey] = useState(action?.actionKey ?? "");
  const [label, setLabel] = useState(action?.label ?? "");
  const [kind, setKind] = useState<ActionKind>(action?.kind ?? "forward");
  const [sortOrder, setSortOrder] = useState(
    String(action?.sortOrder ?? stage.actions.length + 1),
  );
  const [requiresNote, setRequiresNote] = useState(action?.requiresNote ?? false);
  const [requiresAttachment, setRequiresAttachment] = useState(
    action?.requiresAttachment ?? false,
  );
  const [returnMinutes, setReturnMinutes] = useState(
    action?.returnMinutes === null || action?.returnMinutes === undefined
      ? ""
      : String(action.returnMinutes),
  );
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    try {
      await save.mutateAsync({
        id: action?.id ?? null,
        stageId: stage.id,
        actionKey,
        label,
        kind,
        sortOrder: Number(sortOrder),
        requiresNote,
        requiresAttachment,
        requiresEvaluation: action?.requiresEvaluation ?? false,
        returnMinutes:
          actionSupportsReturnMinutes(kind) && returnMinutes.trim() !== ""
            ? Number(returnMinutes)
            : null,
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
      title={t.workflowAdmin.actionTitle}
      description={stage.name}
      footer={
        <>
          <Button type="submit" form="action-form" isLoading={save.isPending}>
            {t.common.save}
          </Button>
          <Button variant="ghost" onClick={onClose}>
            {t.common.cancel}
          </Button>
        </>
      }
    >
      <form
        id="action-form"
        onSubmit={handleSubmit}
        className="grid gap-4 sm:grid-cols-2"
      >
        <FormField label={t.workflowAdmin.actionLabel} required>
          {(id) => (
            <Input
              id={id}
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              required
            />
          )}
        </FormField>

        <FormField
          label={t.workflowAdmin.actionKey}
          hint={t.workflowAdmin.stageKeyHint}
          required
        >
          {(id) => (
            <Input
              id={id}
              dir="ltr"
              value={actionKey}
              onChange={(e) => setActionKey(e.target.value)}
              disabled={action !== null}
              required
            />
          )}
        </FormField>

        <FormField label={t.workflowAdmin.actionKind} required>
          {(id) => (
            <Select
              id={id}
              options={ACTION_KIND_OPTIONS}
              value={kind}
              onChange={(e) => setKind(e.target.value as ActionKind)}
            />
          )}
        </FormField>

        <FormField label={t.workflowAdmin.stageOrder}>
          {(id) => (
            <Input
              id={id}
              type="number"
              min="1"
              dir="ltr"
              value={sortOrder}
              onChange={(e) => setSortOrder(e.target.value)}
            />
          )}
        </FormField>

        {actionSupportsReturnMinutes(kind) && (
          <FormField
            label={t.workflowAdmin.returnMinutes}
            hint={t.workflowAdmin.returnMinutesHint}
          >
            {(id) => (
              <Input
                id={id}
                type="number"
                min="1"
                dir="ltr"
                value={returnMinutes}
                onChange={(e) => setReturnMinutes(e.target.value)}
              />
            )}
          </FormField>
        )}

        <Checkbox
          label={t.workflowAdmin.requiresNote}
          checked={requiresNote}
          onChange={(e) => setRequiresNote(e.target.checked)}
        />
        <Checkbox
          label={t.workflowAdmin.requiresAttachment}
          checked={requiresAttachment}
          onChange={(e) => setRequiresAttachment(e.target.checked)}
        />

        {!actionCarriesRoutes(kind) && (
          <p className="text-content-muted text-xs sm:col-span-2">
            {kind === "note" ? t.workflowAdmin.kindNote : t.workflowAdmin.kindFinal}
          </p>
        )}

        {error !== null && (
          <p role="alert" className="text-danger text-sm sm:col-span-2">
            {error}
          </p>
        )}
      </form>
    </Modal>
  );
}

/**
 * وجهة مشروطة. الشرط بنية واحدة بسيطة (حقل/معامل/قيمة) — التركيب المنطقي
 * مدعوم في المحرّك ويُحرَّر لاحقًا في محرّر الخريطة.
 */
export function RouteModal({
  action,
  siblings,
  onClose,
}: {
  action: WorkflowActionDto;
  siblings: readonly WorkflowStageDto[];
  onClose: () => void;
}) {
  const save = useSaveActionRoute();

  const [priority, setPriority] = useState("10");
  const [targetStageId, setTargetStageId] = useState("");
  const [hasCondition, setHasCondition] = useState(false);
  const [field, setField] = useState("amount");
  const [op, setOp] = useState<ConditionOp>("gt");
  const [value, setValue] = useState("");
  const [error, setError] = useState<string | null>(null);

  const needsValue = op !== "is_null" && op !== "is_not_null";
  const isList = op === "in" || op === "not_in";

  function buildCondition(): WorkflowCondition | null {
    if (!hasCondition) return null;
    if (!needsValue) {
      return { op: op as "is_null" | "is_not_null", field };
    }
    if (isList) {
      return {
        op: op as "in" | "not_in",
        field,
        value: value
          .split(",")
          .map((part) => part.trim())
          .filter((part) => part !== "")
          .map((part) => (Number.isNaN(Number(part)) ? part : Number(part))),
      };
    }
    // الرقم يبقى رقمًا: المقارنة الرقمية تختلف عن النصّية في المحرّك
    const parsed = Number(value);
    return {
      op: op as "eq" | "ne" | "gt" | "gte" | "lt" | "lte",
      field,
      value: value.trim() !== "" && !Number.isNaN(parsed) ? parsed : value,
    };
  }

  const preview = describeCondition(buildCondition());

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    try {
      await save.mutateAsync({
        id: null,
        actionId: action.id,
        priority: Number(priority),
        condition: buildCondition(),
        targetStageId,
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
      title={t.workflowAdmin.routeTitle}
      description={`${action.label} — ${t.workflowAdmin.routesHint}`}
      footer={
        <>
          <Button type="submit" form="route-form" isLoading={save.isPending}>
            {t.common.save}
          </Button>
          <Button variant="ghost" onClick={onClose}>
            {t.common.cancel}
          </Button>
        </>
      }
    >
      <form
        id="route-form"
        onSubmit={handleSubmit}
        className="grid gap-4 sm:grid-cols-2"
      >
        <FormField label={t.workflowAdmin.targetStage} required>
          {(id) => (
            <Select
              id={id}
              options={siblings.map((s) => ({ value: s.id, label: s.name }))}
              placeholder={t.projects.none}
              value={targetStageId}
              onChange={(e) => setTargetStageId(e.target.value)}
            />
          )}
        </FormField>

        <FormField label={t.workflowAdmin.priority} hint={t.workflowAdmin.routesHint}>
          {(id) => (
            <Input
              id={id}
              type="number"
              min="1"
              dir="ltr"
              value={priority}
              onChange={(e) => setPriority(e.target.value)}
            />
          )}
        </FormField>

        <div className="sm:col-span-2">
          <Checkbox
            label={t.workflowAdmin.condition}
            hint={t.workflowAdmin.conditionHint}
            checked={hasCondition}
            onChange={(e) => setHasCondition(e.target.checked)}
          />
        </div>

        {hasCondition && (
          <>
            <FormField label={t.workflowAdmin.conditionField} required>
              {(id) => (
                <Input
                  id={id}
                  dir="ltr"
                  value={field}
                  onChange={(e) => setField(e.target.value)}
                />
              )}
            </FormField>

            <FormField label={t.workflowAdmin.conditionOp} required>
              {(id) => (
                <Select
                  id={id}
                  options={OP_OPTIONS.map((o) => ({ value: o.value, label: o.label }))}
                  value={op}
                  onChange={(e) => setOp(e.target.value as ConditionOp)}
                />
              )}
            </FormField>

            {needsValue && (
              <FormField
                label={t.workflowAdmin.conditionValue}
                {...(isList ? { hint: t.workflowAdmin.conditionListHint } : {})}
                required
              >
                {(id) => (
                  <Input
                    id={id}
                    value={value}
                    onChange={(e) => setValue(e.target.value)}
                  />
                )}
              </FormField>
            )}
          </>
        )}

        <p className="bg-surface-sunken text-content-muted rounded-[var(--radius-control)] p-2 text-xs sm:col-span-2">
          {preview}
        </p>

        {error !== null && (
          <p role="alert" className="text-danger text-sm sm:col-span-2">
            {error}
          </p>
        )}
      </form>
    </Modal>
  );
}

/**
 * شرط جاهزية على مرحلة.
 *
 * لغته لغة التفريع المجمَّدة نفسها — من عرف كيف يكتب شرط وجهة يعرف كيف يكتب
 * شرط جاهزية. والرسالة إلزامية: «غير جاهزة» بلا سبب تُرجع الموظف إلى المدير
 * ليسأل عمّا ينقص، وهو ما جاء الشرط ليمنعه.
 */
export function RequirementModal({
  stage,
  requirement,
  onClose,
}: {
  stage: WorkflowStageDto;
  requirement: StageRequirementDto | null;
  onClose: () => void;
}) {
  const save = useSaveStageRequirement();

  const [kind, setKind] = useState<RequirementKind>(requirement?.kind ?? "condition");
  const [message, setMessage] = useState(requirement?.message ?? "");
  const [appliesTo, setAppliesTo] = useState<RequirementScope>(
    requirement?.appliesTo ?? "advancing",
  );
  const [minAttachments, setMinAttachments] = useState(
    String(requirement?.minAttachments ?? 1),
  );
  const [field, setField] = useState(
    requirement?.condition !== null && requirement?.condition !== undefined
      ? ((requirement.condition as { field?: string }).field ?? "amount")
      : "amount",
  );
  const [op, setOp] = useState<ConditionOp>(
    (requirement?.condition?.op as ConditionOp | undefined) ?? "is_not_null",
  );
  const [value, setValue] = useState("");
  const [error, setError] = useState<string | null>(null);

  const needsValue = op !== "is_null" && op !== "is_not_null";
  const isList = op === "in" || op === "not_in";

  function buildCondition(): WorkflowCondition | null {
    if (kind !== "condition") return null;
    if (!needsValue) return { op: op as "is_null" | "is_not_null", field };
    if (isList) {
      return {
        op: op as "in" | "not_in",
        field,
        value: value
          .split(",")
          .map((part) => part.trim())
          .filter((part) => part !== "")
          .map((part) => (Number.isNaN(Number(part)) ? part : Number(part))),
      };
    }
    const parsed = Number(value);
    return {
      op: op as "eq" | "ne" | "gt" | "gte" | "lt" | "lte",
      field,
      value: value.trim() !== "" && !Number.isNaN(parsed) ? parsed : value,
    };
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    try {
      await save.mutateAsync({
        id: requirement?.id ?? null,
        stageId: stage.id,
        kind,
        condition: buildCondition(),
        minAttachments: kind === "attachment" ? Number(minAttachments) : null,
        message,
        appliesTo,
        sortOrder: requirement?.sortOrder ?? stage.requirements.length + 1,
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
      title={t.workflowAdmin.requirementTitle}
      description={stage.name}
      footer={
        <>
          <Button type="submit" form="requirement-form" isLoading={save.isPending}>
            {t.common.save}
          </Button>
          <Button variant="ghost" onClick={onClose}>
            {t.common.cancel}
          </Button>
        </>
      }
    >
      <form
        id="requirement-form"
        onSubmit={handleSubmit}
        className="grid gap-4 sm:grid-cols-2"
      >
        <FormField label={t.workflowAdmin.requirementKind} required>
          {(id) => (
            <Select
              id={id}
              options={[
                {
                  value: "condition",
                  label: t.workflowAdmin.requirementCondition,
                },
                {
                  value: "attachment",
                  label: t.workflowAdmin.requirementAttachment,
                },
              ]}
              value={kind}
              onChange={(e) => setKind(e.target.value as RequirementKind)}
            />
          )}
        </FormField>

        <FormField label={t.workflowAdmin.requirementScope}>
          {(id) => (
            <Select
              id={id}
              options={[
                { value: "advancing", label: t.workflowAdmin.requirementAdvancing },
                { value: "any_action", label: t.workflowAdmin.requirementAnyAction },
              ]}
              value={appliesTo}
              onChange={(e) => setAppliesTo(e.target.value as RequirementScope)}
            />
          )}
        </FormField>

        {kind === "attachment" ? (
          <FormField label={t.workflowAdmin.minAttachments} required>
            {(id) => (
              <Input
                id={id}
                type="number"
                min="1"
                dir="ltr"
                value={minAttachments}
                onChange={(e) => setMinAttachments(e.target.value)}
                required
              />
            )}
          </FormField>
        ) : (
          <>
            <FormField label={t.workflowAdmin.conditionField} required>
              {(id) => (
                <Input
                  id={id}
                  dir="ltr"
                  value={field}
                  onChange={(e) => setField(e.target.value)}
                />
              )}
            </FormField>

            <FormField label={t.workflowAdmin.conditionOp} required>
              {(id) => (
                <Select
                  id={id}
                  options={OP_OPTIONS.map((o) => ({ value: o.value, label: o.label }))}
                  value={op}
                  onChange={(e) => setOp(e.target.value as ConditionOp)}
                />
              )}
            </FormField>

            {needsValue && (
              <FormField
                label={t.workflowAdmin.conditionValue}
                {...(isList ? { hint: t.workflowAdmin.conditionListHint } : {})}
                required
              >
                {(id) => (
                  <Input
                    id={id}
                    value={value}
                    onChange={(e) => setValue(e.target.value)}
                  />
                )}
              </FormField>
            )}

            <p className="bg-surface-sunken text-content-muted rounded-[var(--radius-control)] p-2 text-xs sm:col-span-2">
              {describeCondition(buildCondition())}
            </p>
          </>
        )}

        <div className="sm:col-span-2">
          <FormField
            label={t.workflowAdmin.requirementMessage}
            hint={t.workflowAdmin.requirementMessageHint}
            required
          >
            {(id) => (
              <Input
                id={id}
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                required
              />
            )}
          </FormField>
        </div>

        {error !== null && (
          <p role="alert" className="text-danger text-sm sm:col-span-2">
            {error}
          </p>
        )}
      </form>
    </Modal>
  );
}
