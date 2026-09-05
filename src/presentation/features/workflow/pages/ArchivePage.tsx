/**
 * طابور الأرشيف — ما أُغلق ولم يصل أصله.
 *
 * شاشةٌ واحدة تخدم فاعلَين: صاحب المعاملة يرى ما عليه أن يودعه، وأمين
 * الأرشيف يرى ما ينتظر قبوله. والترتيب بأقدم إغلاق لا بأحدثه: الطابور
 * يُقرأ من رأسه، وما تأخّر هو ما يستحقّ النظر.
 */
import { useState } from "react";
import { Link } from "react-router-dom";
import { Archive, Check, Undo2 } from "lucide-react";
import type { ArchiveQueueItemDto } from "@application/modules/workflow/dtos";
import type { ArchiveState } from "@core/modules/workflow/entities/WorkflowGovernance";
import { Card } from "@presentation/shared/ui/Card";
import { Badge } from "@presentation/shared/ui/Badge";
import { Button } from "@presentation/shared/ui/Button";
import { Input } from "@presentation/shared/ui/Input";
import { Modal } from "@presentation/shared/ui/Modal";
import { FormField } from "@presentation/shared/ui/FormField";
import { DataTable, type Column } from "@presentation/shared/ui/DataTable";
import { EmptyState } from "@presentation/shared/ui/EmptyState";
import { PermissionGate } from "@presentation/shared/ui/PermissionGate";
import { formatDateTime, formatNumber } from "@presentation/shared/lib/formatters";
import { errorMessage } from "@presentation/shared/lib/query";
import {
  useAcceptArchive,
  useArchiveQueue,
  useRejectArchive,
  useSubmitOriginal,
} from "../hooks/useOperations";
import { t } from "@i18n/index";

const STATE_LABELS: Record<ArchiveState, string> = {
  none: t.governance.archiveStateNone,
  submitted: t.governance.archiveStateSubmitted,
  archived: t.governance.archiveStateArchived,
};

const STATE_TONES: Record<ArchiveState, "neutral" | "warning" | "success"> = {
  none: "neutral",
  submitted: "warning",
  archived: "success",
};

/** أمين الأرشيف يقبل بموضع أو يردّ بسبب — الحقلان إلزاميّان لا زينة. */
function DecisionModal({
  item,
  mode,
  onClose,
}: {
  item: ArchiveQueueItemDto;
  mode: "accept" | "reject";
  onClose: () => void;
}) {
  const accept = useAcceptArchive();
  const reject = useRejectArchive();
  const [text, setText] = useState("");
  const [notes, setNotes] = useState("");
  const [error, setError] = useState<string | null>(null);

  const isAccept = mode === "accept";
  const pending = isAccept ? accept.isPending : reject.isPending;

  async function handleSave() {
    setError(null);
    try {
      if (isAccept) {
        await accept.mutateAsync({
          transactionId: item.transactionId,
          text,
          notes,
        });
      } else {
        await reject.mutateAsync({ transactionId: item.transactionId, text });
      }
      onClose();
    } catch (e) {
      setError(errorMessage(e));
    }
  }

  return (
    <Modal
      isOpen
      onClose={onClose}
      title={isAccept ? t.governance.acceptArchive : t.governance.rejectArchive}
      description={`#${item.transactionNo} — ${item.subject}`}
      footer={
        <>
          <Button
            onClick={() => void handleSave()}
            isLoading={pending}
            disabled={text.trim() === ""}
          >
            {t.common.save}
          </Button>
          <Button variant="ghost" onClick={onClose}>
            {t.common.cancel}
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        <FormField
          label={isAccept ? t.governance.location : t.governance.rejectReason}
          hint={isAccept ? t.governance.locationHint : t.governance.rejectReasonHint}
          required
        >
          {(id) => (
            <Input id={id} value={text} onChange={(e) => setText(e.target.value)} />
          )}
        </FormField>

        {isAccept && (
          <FormField label={t.governance.submitNotes}>
            {(id) => (
              <Input id={id} value={notes} onChange={(e) => setNotes(e.target.value)} />
            )}
          </FormField>
        )}

        {error !== null && (
          <p role="alert" className="text-danger text-sm">
            {error}
          </p>
        )}
      </div>
    </Modal>
  );
}

export function ArchivePage() {
  const queue = useArchiveQueue();
  const submit = useSubmitOriginal();
  const [decision, setDecision] = useState<{
    item: ArchiveQueueItemDto;
    mode: "accept" | "reject";
  } | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(item: ArchiveQueueItemDto) {
    setError(null);
    try {
      await submit.mutateAsync({ transactionId: item.transactionId, notes: "" });
    } catch (e) {
      setError(errorMessage(e));
    }
  }

  const columns: readonly Column<ArchiveQueueItemDto>[] = [
    {
      key: "no",
      header: t.inbox.no,
      render: (row) => (
        <Link
          to={`/transactions/${row.transactionId}`}
          className="text-brand-600 tabular font-mono text-xs"
        >
          #{row.transactionNo}
        </Link>
      ),
    },
    {
      key: "subject",
      header: t.transaction.subject,
      render: (row) => (
        <span className="text-content text-sm">
          {row.subject}
          {row.projectName !== null && (
            <span className="text-content-muted ms-2 text-xs">{row.projectName}</span>
          )}
        </span>
      ),
    },
    {
      key: "closed",
      header: t.transaction.closed,
      render: (row) => (
        <span className="tabular text-content-muted text-xs">
          {row.closedAt === null ? "—" : formatDateTime(row.closedAt)}
        </span>
      ),
    },
    {
      key: "days",
      header: t.governance.daysSinceClosed,
      // الأيام تحذّر بلونها: ما تجاوز أسبوعين خرج عن المعتاد
      render: (row) => (
        <Badge tone={row.daysSinceClosed > 14 ? "danger" : "neutral"}>
          {formatNumber(row.daysSinceClosed)}
        </Badge>
      ),
    },
    {
      key: "state",
      header: t.transaction.status,
      render: (row) => (
        <span className="flex flex-wrap items-center gap-2">
          <Badge tone={STATE_TONES[row.archiveState]}>
            {STATE_LABELS[row.archiveState]}
          </Badge>
          {row.submittedByName !== null && (
            <span className="text-content-muted text-[11px]">
              {t.governance.submittedBy}: {row.submittedByName}
            </span>
          )}
        </span>
      ),
    },
    {
      key: "actions",
      header: "",
      render: (row) => (
        <span className="flex flex-wrap justify-end gap-1">
          {row.archiveState === "none" && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => void handleSubmit(row)}
              isLoading={submit.isPending}
              startIcon={<Archive aria-hidden className="size-4" />}
            >
              {t.governance.submitOriginal}
            </Button>
          )}
          {row.archiveState === "submitted" && (
            <PermissionGate permission="transaction.archive">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setDecision({ item: row, mode: "accept" })}
                startIcon={<Check aria-hidden className="size-4" />}
              >
                {t.governance.acceptArchive}
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setDecision({ item: row, mode: "reject" })}
                startIcon={<Undo2 aria-hidden className="text-danger size-4" />}
              >
                {t.governance.rejectArchive}
              </Button>
            </PermissionGate>
          )}
        </span>
      ),
    },
  ];

  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-6">
      <header>
        <h1 className="text-content text-xl font-extrabold">
          {t.governance.archiveQueue}
        </h1>
        <p className="text-content-muted mt-1 text-sm">
          {t.governance.archiveQueueHint}
        </p>
      </header>

      {error !== null && (
        <p role="alert" className="text-danger text-sm">
          {error}
        </p>
      )}

      <Card>
        {queue.isError ? (
          <EmptyState title={t.common.error} description={errorMessage(queue.error)} />
        ) : (
          <DataTable
            columns={columns}
            rows={queue.data ?? []}
            rowKey={(row) => row.transactionId}
            isLoading={queue.isPending}
            emptyTitle={t.governance.emptyQueue}
          />
        )}
      </Card>

      {decision !== null && (
        <DecisionModal
          key={`${decision.mode}-${decision.item.transactionId}`}
          item={decision.item}
          mode={decision.mode}
          onClose={() => setDecision(null)}
        />
      )}
    </div>
  );
}
