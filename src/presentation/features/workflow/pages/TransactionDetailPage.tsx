/**
 * تفاصيل المعاملة: خطّ زمني للمراحل بعدّاداتها ودرجاتها.
 * مدير البرنامج يحدّد المدة أو يعدّلها حتى بعد الإنجاز [المراسلات 3، 4]،
 * وطالب المعاملة يعطي «تمام الإنجاز» فتُقفل [المراسلات 9].
 */
import { useState } from "react";
import { useParams } from "react-router-dom";
import { CheckCircle2, Clock, Timer, XCircle } from "lucide-react";
import type { InboxItemDto } from "@application/modules/workflow/dtos";
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
  useCancelTransaction,
  useCloseTransaction,
  useSetStepDuration,
  useTransaction,
} from "../hooks/useWorkflow";
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

function DurationModal({ step, onClose }: { step: InboxItemDto; onClose: () => void }) {
  const setDuration = useSetStepDuration();
  const [minutes, setMinutes] = useState(String(step.allocatedMinutes ?? 60));
  const [scope, setScope] = useState<"all_occurrences" | "single">("all_occurrences");
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);

  async function handleSave() {
    setError(null);
    try {
      await setDuration.mutateAsync({
        stepInstanceId: step.stepInstanceId,
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
      description={`${step.stepName} — ${step.assigneeName ?? ""}`}
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

function StepCard({
  step,
  onSetDuration,
}: {
  step: InboxItemDto;
  onSetDuration: (step: InboxItemDto) => void;
}) {
  return (
    <li className="border-border flex flex-wrap items-start gap-4 border-b py-4 last:border-0">
      <span className="bg-surface-sunken text-content grid size-8 shrink-0 place-items-center rounded-full text-sm font-bold">
        {formatNumber(step.orderNo)}
      </span>

      <span className="min-w-0 flex-1">
        <span className="text-content block text-sm font-medium">{step.stepName}</span>
        <span className="text-content-muted block text-xs">
          {step.assigneeName ?? "—"}
        </span>

        {step.managerNote !== "" && (
          <span className="text-content-muted mt-1 block text-xs">
            {t.transaction.managerNote}: {step.managerNote}
          </span>
        )}

        <span className="text-content-muted mt-1 flex flex-wrap gap-x-4 gap-y-1 text-[11px]">
          {step.arrivedAt !== null && (
            <span className="tabular">
              <Clock aria-hidden className="me-1 inline size-3" />
              {formatDateTime(step.arrivedAt)}
            </span>
          )}
          {step.allocatedMinutes !== null && (
            <span className="tabular">
              {t.inbox.allocated}: {formatDuration(step.allocatedMinutes)}
            </span>
          )}
          <span className="tabular">
            {t.inbox.elapsed}: {formatDuration(step.elapsedMinutes)}
          </span>
        </span>
      </span>

      <span className="flex shrink-0 flex-col items-end gap-2">
        <CountdownBadge
          color={step.color}
          remainingMinutes={step.remainingMinutes}
          awaitingDuration={step.awaitingDuration}
          isDone={step.stepStatus === "done"}
        />

        {step.score !== null && (
          <Badge tone="brand">
            {t.transaction.score}: {formatNumber(step.score)}
          </Badge>
        )}

        <PermissionGate permission="duration.manage">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => onSetDuration(step)}
            startIcon={<Timer aria-hidden className="size-4" />}
          >
            {t.transaction.setDuration}
          </Button>
        </PermissionGate>
      </span>
    </li>
  );
}

export function TransactionDetailPage() {
  const { id } = useParams<{ id: string }>();
  const transaction = useTransaction(id ?? null);
  const close = useCloseTransaction();
  const cancel = useCancelTransaction();

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

  const completedSteps = data.steps.filter((step) => step.stepStatus === "done");
  const scored = completedSteps.filter((step) => step.score !== null);
  const averageScore =
    scored.length === 0
      ? null
      : scored.reduce((sum, step) => sum + (step.score ?? 0), 0) / scored.length;

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
              data.steps.length === 0 ? 0 : completedSteps.length / data.steps.length,
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

      <Card title={t.transaction.steps}>
        <ul>
          {data.steps.map((step) => (
            <StepCard
              key={step.stepInstanceId}
              step={step}
              onSetDuration={setDurationTarget}
            />
          ))}
        </ul>
      </Card>

      {durationTarget !== null && (
        <DurationModal
          key={durationTarget.stepInstanceId}
          step={durationTarget}
          onClose={() => setDurationTarget(null)}
        />
      )}
    </div>
  );
}
