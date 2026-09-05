/**
 * أرشفة الأصل الورقيّ — على مرحلتين.
 *
 * «أُغلقت» لا تعني أن الورقة وصلت الأرشيف. والمرحلة الواحدة تُخفي الخلاف
 * المعروف: «سلّمتُه» في مقابل «لم يصلني». فبفاعلَين وختمَين: صاحب المعاملة
 * **يودِع**، وأمين الأرشيف **يقبل ويفهرس** أو **يردّ بسبب مكتوب**.
 */
import { useState } from "react";
import { Archive, Check, Undo2 } from "lucide-react";
import type { TransactionDto } from "@application/modules/workflow/dtos";
import {
  canDecideArchive,
  canSubmitOriginal,
} from "@core/modules/workflow/entities/WorkflowGovernance";
import { Card } from "@presentation/shared/ui/Card";
import { Badge } from "@presentation/shared/ui/Badge";
import { Button } from "@presentation/shared/ui/Button";
import { Input } from "@presentation/shared/ui/Input";
import { FormField } from "@presentation/shared/ui/FormField";
import { PermissionGate } from "@presentation/shared/ui/PermissionGate";
import { formatDateTime } from "@presentation/shared/lib/formatters";
import { errorMessage } from "@presentation/shared/lib/query";
import {
  useAcceptArchive,
  useRejectArchive,
  useSubmitOriginal,
} from "../hooks/useOperations";
import { t } from "@i18n/index";

const STATE_LABELS = {
  none: t.governance.archiveStateNone,
  submitted: t.governance.archiveStateSubmitted,
  archived: t.governance.archiveStateArchived,
} as const;

const STATE_TONES = {
  none: "neutral",
  submitted: "warning",
  archived: "success",
} as const;

export function ArchiveCard({ transaction }: { transaction: TransactionDto }) {
  const submit = useSubmitOriginal();
  const accept = useAcceptArchive();
  const reject = useRejectArchive();

  const [notes, setNotes] = useState("");
  const [location, setLocation] = useState("");
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);

  // معاملة ما تزال تسير لا أصل لها يُودَع
  if (!transaction.isClosed && transaction.archiveState === "none") return null;

  async function run(action: () => Promise<unknown>) {
    setError(null);
    try {
      await action();
      setNotes("");
      setLocation("");
      setReason("");
    } catch (e) {
      setError(errorMessage(e));
    }
  }

  const state = transaction.archiveState;

  return (
    <Card
      title={
        <span className="flex flex-wrap items-center gap-2">
          <Archive aria-hidden className="text-content-muted size-4" />
          {t.governance.archiveTitle}
          <Badge tone={STATE_TONES[state]}>{STATE_LABELS[state]}</Badge>
        </span>
      }
      description={t.governance.archiveHint}
    >
      <dl className="mb-3 grid gap-2 text-xs sm:grid-cols-3">
        {transaction.archiveSubmittedAt !== null && (
          <div>
            <dt className="text-content-muted">{t.governance.submittedBy}</dt>
            <dd className="text-content mt-0.5">
              {transaction.archiveSubmittedByName ?? "—"}
              <span className="text-content-muted tabular ms-2">
                {formatDateTime(transaction.archiveSubmittedAt)}
              </span>
            </dd>
          </div>
        )}
        {transaction.archivedAt !== null && (
          <div>
            <dt className="text-content-muted">{t.governance.archivedBy}</dt>
            <dd className="text-content mt-0.5">
              {transaction.archivedByName ?? "—"}
              <span className="text-content-muted tabular ms-2">
                {formatDateTime(transaction.archivedAt)}
              </span>
            </dd>
          </div>
        )}
        {transaction.archiveLocation !== "" && (
          <div>
            <dt className="text-content-muted">{t.governance.location}</dt>
            <dd className="text-content mt-0.5">{transaction.archiveLocation}</dd>
          </div>
        )}
      </dl>

      {canSubmitOriginal(state, transaction.isClosed) && (
        <div className="flex flex-wrap items-end gap-2">
          <FormField label={t.governance.submitNotes} className="min-w-56 flex-1">
            {(id) => (
              <Input id={id} value={notes} onChange={(e) => setNotes(e.target.value)} />
            )}
          </FormField>
          <Button
            isLoading={submit.isPending}
            onClick={() =>
              run(() => submit.mutateAsync({ transactionId: transaction.id, notes }))
            }
            startIcon={<Archive aria-hidden className="size-4" />}
          >
            {t.governance.submitOriginal}
          </Button>
        </div>
      )}

      {canDecideArchive(state) && (
        <PermissionGate permission="transaction.archive">
          <div className="flex flex-col gap-3">
            <div className="flex flex-wrap items-end gap-2">
              <FormField
                label={t.governance.location}
                hint={t.governance.locationHint}
                className="min-w-56 flex-1"
                required
              >
                {(id) => (
                  <Input
                    id={id}
                    value={location}
                    onChange={(e) => setLocation(e.target.value)}
                  />
                )}
              </FormField>
              <Button
                isLoading={accept.isPending}
                onClick={() =>
                  run(() =>
                    accept.mutateAsync({
                      transactionId: transaction.id,
                      text: location,
                      notes,
                    }),
                  )
                }
                startIcon={<Check aria-hidden className="size-4" />}
              >
                {t.governance.acceptArchive}
              </Button>
            </div>

            <div className="flex flex-wrap items-end gap-2">
              <FormField
                label={t.governance.rejectReason}
                hint={t.governance.rejectReasonHint}
                className="min-w-56 flex-1"
                required
              >
                {(id) => (
                  <Input
                    id={id}
                    value={reason}
                    onChange={(e) => setReason(e.target.value)}
                  />
                )}
              </FormField>
              <Button
                variant="secondary"
                isLoading={reject.isPending}
                onClick={() =>
                  run(() =>
                    reject.mutateAsync({
                      transactionId: transaction.id,
                      text: reason,
                    }),
                  )
                }
                startIcon={<Undo2 aria-hidden className="size-4" />}
              >
                {t.governance.rejectArchive}
              </Button>
            </div>
          </div>
        </PermissionGate>
      )}

      {error !== null && (
        <p role="alert" className="text-danger mt-2 text-sm">
          {error}
        </p>
      )}
    </Card>
  );
}
