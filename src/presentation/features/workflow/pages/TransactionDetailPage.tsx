/**
 * تفاصيل المعاملة: المراحل، ولكل مرحلة مشاركوها بعدّاداتهم ودرجاتهم.
 *
 * المرحلة قد تقف عند أكثر من موظف، فالعرض على مستويين: المرحلة وسياستها
 * وتقدّمها، وتحتها كل مكلَّف بعدّاده ودرجته. مدير البرنامج يحدّد المدة أو
 * يعدّلها حتى بعد الإنجاز [المراسلات 3، 4]، وطالب المعاملة يعطي «تمام
 * الإنجاز» فتُقفل [المراسلات 9].
 */
import { useState } from "react";
import { useParams } from "react-router-dom";
import { Ban, CheckCircle2, Clock, Timer, XCircle } from "lucide-react";
import type {
  AvailableActionDto,
  InboxItemDto,
  StageDto,
  TimelineEntryDto,
} from "@application/modules/workflow/dtos";
import type { ActionKind } from "@core/modules/workflow/entities/WorkflowAction";
import type { CompletionPolicy } from "@core/modules/workflow/entities/StageInstance";
import { Card } from "@presentation/shared/ui/Card";
import { Badge, type BadgeTone } from "@presentation/shared/ui/Badge";
import { Button } from "@presentation/shared/ui/Button";
import { Input } from "@presentation/shared/ui/Input";
import { Select } from "@presentation/shared/ui/Select";
import { FormField } from "@presentation/shared/ui/FormField";
import { Modal } from "@presentation/shared/ui/Modal";
import { EmptyState } from "@presentation/shared/ui/EmptyState";
import { Spinner } from "@presentation/shared/ui/Spinner";
import { CountdownBadge } from "@presentation/shared/ui/CountdownBadge";
import { PermissionGate } from "@presentation/shared/ui/PermissionGate";
import {
  formatDateTime,
  formatDuration,
  formatNumber,
  formatPercent,
} from "@presentation/shared/lib/formatters";
import { errorMessage } from "@presentation/shared/lib/query";
import {
  useAvailableActions,
  useCancelTransaction,
  useCloseTransaction,
  useSetAssignmentDuration,
  useTransaction,
  useTransactionTimeline,
} from "../hooks/useWorkflow";
import { ActionButtons } from "../components/ActionButtons";
import { AttachmentsCard } from "../components/AttachmentsCard";
import { AssignmentTools } from "../components/AssignmentTools";
import { TransactionMapCard } from "../components/TransactionMapCard";
import { ArchiveCard } from "../components/ArchiveCard";
import { useForceClose } from "../hooks/useOperations";
import { useTransactionAttachments } from "../hooks/useAttachments";
import { t } from "@i18n/index";

const STATUS_LABELS: Record<string, string> = {
  in_progress: t.transaction.statusInProgress,
  awaiting_confirmation: t.transaction.statusAwaiting,
  completed: t.transaction.statusCompleted,
  cancelled: t.transaction.statusCancelled,
};

const STATUS_TONES: Record<string, BadgeTone> = {
  in_progress: "info",
  awaiting_confirmation: "warning",
  completed: "success",
  cancelled: "neutral",
};

const STAGE_TONES: Record<string, BadgeTone> = {
  pending: "warning",
  in_progress: "info",
  done: "success",
  cancelled: "neutral",
  skipped: "neutral",
};

const KIND_TONES: Record<ActionKind, BadgeTone> = {
  forward: "success",
  backward: "danger",
  note: "neutral",
  closure: "warning",
  final: "info",
};

const POLICY_LABELS: Record<CompletionPolicy, string> = {
  all: t.transaction.policyAll,
  any: t.transaction.policyAny,
  quorum: t.transaction.policyQuorum,
};

function DurationModal({
  assignment,
  onClose,
}: {
  assignment: InboxItemDto;
  onClose: () => void;
}) {
  const setDuration = useSetAssignmentDuration();
  const [minutes, setMinutes] = useState(String(assignment.allocatedMinutes ?? 60));
  const [scope, setScope] = useState<"all_occurrences" | "single">("all_occurrences");
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);

  async function handleSave() {
    setError(null);
    try {
      await setDuration.mutateAsync({
        assignmentId: assignment.assignmentId,
        minutes: Number(minutes),
        scope,
        reason,
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
      title={t.transaction.setDurationTitle}
      description={`${assignment.stageName} — ${assignment.assigneeName ?? ""}`}
      footer={
        <>
          <Button onClick={() => void handleSave()} isLoading={setDuration.isPending}>
            {t.common.save}
          </Button>
          <Button variant="ghost" onClick={onClose}>
            {t.common.cancel}
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        <FormField label={t.transaction.durationMinutes} required>
          {(id) => (
            <Input
              id={id}
              type="number"
              min="1"
              dir="ltr"
              value={minutes}
              onChange={(e) => setMinutes(e.target.value)}
            />
          )}
        </FormField>

        <FormField
          label={t.transaction.durationScope}
          hint={t.inbox.awaitingDurationHint}
        >
          {(id) => (
            <Select
              id={id}
              options={[
                { value: "all_occurrences", label: t.transaction.scopeAll },
                { value: "single", label: t.transaction.scopeSingle },
              ]}
              value={scope}
              onChange={(e) => setScope(e.target.value as "all_occurrences" | "single")}
            />
          )}
        </FormField>

        <FormField label={t.transaction.reason}>
          {(id) => (
            <Input id={id} value={reason} onChange={(e) => setReason(e.target.value)} />
          )}
        </FormField>

        {error !== null && (
          <p role="alert" className="text-danger text-sm">
            {error}
          </p>
        )}
      </div>
    </Modal>
  );
}

/** مكلَّف واحد داخل مرحلة — لكلٍّ عدّاده ودرجته. */
function AssignmentRow({
  assignment,
  actions,
  onSetDuration,
  onMessage,
  onError,
}: {
  assignment: InboxItemDto;
  actions: readonly AvailableActionDto[];
  onSetDuration: (assignment: InboxItemDto) => void;
  onMessage: (message: string) => void;
  onError: (message: string) => void;
}) {
  const isCancelled = assignment.assignmentStatus === "cancelled";

  return (
    <li
      className={`border-border flex flex-wrap items-start gap-4 border-b py-3 last:border-0 ${
        isCancelled ? "opacity-60" : ""
      }`}
    >
      <span className="min-w-0 flex-1">
        <span className="text-content flex items-center gap-2 text-sm font-medium">
          {assignment.assigneeName ?? "—"}
          {assignment.isOptional && (
            <Badge tone="neutral">{t.workflowAdmin.isOptional}</Badge>
          )}
          {isCancelled && <Badge tone="neutral">{t.transaction.notNeeded}</Badge>}
        </span>

        {assignment.managerNote !== "" && (
          <span className="text-content-muted mt-1 block text-xs">
            {t.transaction.managerNote}: {assignment.managerNote}
          </span>
        )}
        {assignment.notes !== "" && (
          <span className="text-content-muted mt-1 block text-xs">
            {assignment.notes}
          </span>
        )}

        <span className="text-content-muted mt-1 flex flex-wrap gap-x-4 gap-y-1 text-[11px]">
          {assignment.arrivedAt !== null && (
            <span className="tabular">
              <Clock aria-hidden className="me-1 inline size-3" />
              {formatDateTime(assignment.arrivedAt)}
            </span>
          )}
          {assignment.allocatedMinutes !== null && (
            <span className="tabular">
              {t.inbox.allocated}: {formatDuration(assignment.allocatedMinutes)}
            </span>
          )}
          <span className="tabular">
            {t.inbox.elapsed}: {formatDuration(assignment.elapsedMinutes)}
          </span>
        </span>
      </span>

      <span className="flex shrink-0 flex-col items-end gap-2">
        <CountdownBadge
          color={assignment.color}
          remainingMinutes={assignment.remainingMinutes}
          awaitingDuration={assignment.awaitingDuration}
          isDone={assignment.assignmentStatus === "done"}
        />

        {assignment.score !== null && (
          <Badge tone="brand">
            {t.transaction.score}: {formatNumber(assignment.score)}
          </Badge>
        )}

        {!isCancelled && (
          <ActionButtons
            assignment={assignment}
            actions={actions}
            onMessage={onMessage}
            onError={onError}
          />
        )}

        {!isCancelled && (
          <AssignmentTools
            assignment={assignment}
            onMessage={onMessage}
            onError={onError}
          />
        )}

        {!isCancelled && (
          <PermissionGate permission="duration.manage">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => onSetDuration(assignment)}
              startIcon={<Timer aria-hidden className="size-4" />}
            >
              {t.transaction.setDuration}
            </Button>
          </PermissionGate>
        )}
      </span>
    </li>
  );
}

/** مرحلة بمشاركيها: العنوان يحمل السياسة والتقدّم، والقائمة تحمل المكلَّفين. */
function StageSection({
  stage,
  actions,
  onSetDuration,
  onMessage,
  onError,
}: {
  stage: StageDto;
  actions: readonly AvailableActionDto[];
  onSetDuration: (assignment: InboxItemDto) => void;
  onMessage: (message: string) => void;
  onError: (message: string) => void;
}) {
  return (
    <li className="border-border border-b py-4 last:border-0">
      <div className="flex flex-wrap items-center gap-2">
        <span className="bg-surface-sunken text-content grid size-8 shrink-0 place-items-center rounded-full text-sm font-bold">
          {formatNumber(stage.seq)}
        </span>
        <span className="text-content text-sm font-medium">{stage.stageName}</span>

        <Badge tone={STAGE_TONES[stage.stageStatus] ?? "neutral"}>
          {t.transaction.stageStatus[stage.stageStatus]}
        </Badge>

        {/* السياسة تُعرض دائمًا: هي ما يفسّر لماذا لم تُغلق المرحلة بعد */}
        <Badge tone="neutral">
          {POLICY_LABELS[stage.completionPolicy]}
          {stage.completionPolicy === "quorum" && stage.quorumCount !== null
            ? ` (${formatNumber(stage.quorumCount)})`
            : ""}
        </Badge>

        {stage.participantsCount > 1 && (
          <Badge tone={stage.doneCount >= stage.requiredCount ? "success" : "info"}>
            {t.inbox.sharedStage(stage.doneCount, stage.participantsCount)}
          </Badge>
        )}

        {stage.requiresReceive && (
          <Badge tone="neutral">{t.workflowAdmin.requiresReceive}</Badge>
        )}

        {/* مرحلة التقاء لم يحن وقتها: لا مشاركين بعد وليست بلا مؤهّلين */}
        {stage.stageStatus === "pending" && stage.participantsCount === 0 && (
          <Badge tone="warning">{t.transaction.stageWaitingJoin}</Badge>
        )}
      </div>

      {stage.assignments.length === 0 ? (
        stage.stageStatus === "pending" ? null : (
          <p className="text-warning mt-2 ps-11 text-xs">
            {t.transaction.stageUnassigned}
          </p>
        )
      ) : (
        <ul className="mt-2 ps-11">
          {stage.assignments.map((assignment) => (
            <AssignmentRow
              key={assignment.assignmentId}
              assignment={assignment}
              actions={actions.filter(
                (a) => a.assignmentId === assignment.assignmentId,
              )}
              onSetDuration={onSetDuration}
              onMessage={onMessage}
              onError={onError}
            />
          ))}
        </ul>
      )}
    </li>
  );
}

export function TransactionDetailPage() {
  const { id } = useParams<{ id: string }>();
  const transaction = useTransaction(id ?? null);
  const actions = useAvailableActions({ transactionId: id ?? "" });
  const timeline = useTransactionTimeline(id ?? null);
  const attachments = useTransactionAttachments(id ?? null);
  const close = useCloseTransaction();
  const cancel = useCancelTransaction();
  const forceClose = useForceClose();

  const [durationTarget, setDurationTarget] = useState<InboxItemDto | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  if (transaction.isPending) {
    return (
      <Card>
        <Spinner />
      </Card>
    );
  }

  const data = transaction.data;
  if (transaction.isError || data === null || data === undefined) {
    return (
      <Card>
        <EmptyState
          title={t.transaction.notFound}
          {...(transaction.isError
            ? { description: errorMessage(transaction.error) }
            : {})}
        />
      </Card>
    );
  }

  const completedStages = data.stages.filter((stage) => stage.stageStatus === "done");
  // المتوسّط عبر كل التكليفات لا المراحل: التوازي يجعل للمرحلة الواحدة عدة درجات
  const scored = data.stages
    .flatMap((stage) => stage.assignments)
    .filter((assignment) => assignment.score !== null);
  const averageScore =
    scored.length === 0
      ? null
      : scored.reduce((sum, a) => sum + (a.score ?? 0), 0) / scored.length;

  async function handleClose() {
    if (data === null || data === undefined) return;
    if (!window.confirm(t.transaction.closeHint)) return;
    setMessage(null);
    setError(null);
    try {
      await close.mutateAsync({ transactionId: data.id, status: data.status });
      setMessage(t.transaction.closed);
    } catch (e) {
      setError(errorMessage(e));
    }
  }

  async function handleCancel() {
    if (data === null || data === undefined) return;
    if (!window.confirm(t.transaction.cancelHint)) return;
    setError(null);
    try {
      await cancel.mutateAsync(data.id);
    } catch (e) {
      setError(errorMessage(e));
    }
  }

  // الإغلاق الإداري يختلف عن الإلغاء: يُعلَّم فلا يُحتسب إنجازًا
  async function handleForceClose() {
    if (data === null || data === undefined) return;
    const reason = window.prompt(t.ops.forceCloseHint);
    if (reason === null || reason.trim() === "") return;
    setMessage(null);
    setError(null);
    try {
      await forceClose.mutateAsync({ transactionId: data.id, reason });
      setMessage(t.ops.forceClosed);
    } catch (e) {
      setError(errorMessage(e));
    }
  }

  return (
    <div className="mx-auto flex max-w-4xl flex-col gap-6">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-content flex items-center gap-2 text-xl font-extrabold">
            <span className="tabular font-mono">#{data.no}</span>
            {data.subject}
          </h1>
          <p className="text-content-muted mt-1 text-sm">
            {data.type}
            {data.projectName !== null && ` · ${data.projectName}`}
            {` · ${t.transaction.requester}: ${data.requesterName}`}
          </p>
        </div>

        <span className="flex flex-wrap items-center gap-2">
          <Badge tone={STATUS_TONES[data.status] ?? "neutral"}>
            {STATUS_LABELS[data.status] ?? data.status}
          </Badge>

          {data.status === "awaiting_confirmation" && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => void handleClose()}
              isLoading={close.isPending}
              startIcon={<CheckCircle2 aria-hidden className="size-4" />}
            >
              {t.transaction.close}
            </Button>
          )}

          {!data.isClosed && (
            <PermissionGate permission="transaction.override">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => void handleCancel()}
                startIcon={<XCircle aria-hidden className="text-danger size-4" />}
              >
                {t.transaction.cancel}
              </Button>
            </PermissionGate>
          )}

          {!data.isClosed && (
            <PermissionGate permission="transaction.force_close">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => void handleForceClose()}
                isLoading={forceClose.isPending}
                startIcon={<Ban aria-hidden className="text-danger size-4" />}
              >
                {t.ops.forceClose}
              </Button>
            </PermissionGate>
          )}
        </span>
      </header>

      {message !== null && (
        <p role="status" className="text-success text-sm">
          {message}
        </p>
      )}
      {error !== null && (
        <p role="alert" className="text-danger text-sm">
          {error}
        </p>
      )}

      <dl className="grid gap-3 sm:grid-cols-3">
        <div className="bg-surface-sunken rounded-[var(--radius-control)] p-3">
          <dt className="text-content-muted text-xs">{t.transaction.progress}</dt>
          <dd className="tabular text-content mt-0.5 text-sm font-medium">
            {formatPercent(
              data.stages.length === 0
                ? 0
                : completedStages.length / data.stages.length,
            )}
          </dd>
        </div>
        <div className="bg-surface-sunken rounded-[var(--radius-control)] p-3">
          <dt className="text-content-muted text-xs">{t.transaction.averageScore}</dt>
          <dd className="tabular text-content mt-0.5 text-sm font-medium">
            {averageScore === null
              ? "—"
              : formatNumber(Math.round(averageScore * 100) / 100)}
          </dd>
        </div>
        <div className="bg-surface-sunken rounded-[var(--radius-control)] p-3">
          <dt className="text-content-muted text-xs">{t.transaction.createdAt}</dt>
          <dd className="tabular text-content mt-0.5 text-sm font-medium">
            {formatDateTime(data.createdAt)}
          </dd>
        </div>
      </dl>

      <Card title={t.transaction.stages}>
        {data.stages.length === 0 ? (
          <EmptyState title={t.workflowAdmin.noStages} />
        ) : (
          <ul>
            {data.stages.map((stage) => (
              <StageSection
                key={stage.stageInstanceId}
                stage={stage}
                actions={actions.data ?? []}
                onSetDuration={setDurationTarget}
                onMessage={setMessage}
                onError={setError}
              />
            ))}
          </ul>
        )}
      </Card>

      <TransactionMapCard transaction={data} />

      <ArchiveCard transaction={data} />

      <AttachmentsCard
        transactionId={data.id}
        attachments={attachments.data ?? []}
        openAssignments={data.stages
          .flatMap((stage) => stage.assignments)
          .filter((a) => a.assignmentStatus === "in_progress")}
        isLoading={attachments.isPending}
      />

      <Card title={t.transaction.timeline} description={t.transaction.timelineHint}>
        {(timeline.data ?? []).length === 0 ? (
          <EmptyState title={t.transaction.noTimeline} />
        ) : (
          <ol className="flex flex-col gap-3">
            {(timeline.data ?? []).map((entry: TimelineEntryDto) => (
              <li key={entry.id} className="flex flex-wrap items-baseline gap-2">
                <Badge tone={KIND_TONES[entry.kind]}>{entry.actionLabel}</Badge>
                <span className="text-content text-sm">{entry.stageName ?? "—"}</span>
                <span className="text-content-muted text-xs">
                  {entry.actedByName ?? "—"}
                </span>
                <span className="tabular text-content-muted text-[11px]">
                  {formatDateTime(entry.actedAt)}
                </span>
                {entry.notes !== "" && (
                  <span className="text-content-muted basis-full text-xs">
                    {entry.notes}
                  </span>
                )}
              </li>
            ))}
          </ol>
        )}
      </Card>

      {durationTarget !== null && (
        <DurationModal
          key={durationTarget.assignmentId}
          assignment={durationTarget}
          onClose={() => setDurationTarget(null)}
        />
      )}
    </div>
  );
}
