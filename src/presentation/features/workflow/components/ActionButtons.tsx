/**
 * أزرار المرحلة كما عرّفها المسار — لا زرّ واحد اسمه «إنجاز».
 *
 * اللون يتبع نوع الزرّ لا اجتهاد الواجهة:
 * أخضر انتقال · أحمر إرجاع · رمادي ملاحظة · بنّي إغلاق · كحلي نهاية المسار.
 * والملاحظة لا تحرّك المرحلة، فتبقى الأزرار بعدها كما هي.
 */
import { useState } from "react";
import type { ActionKind } from "@core/modules/workflow/entities/WorkflowAction";
import type {
  AvailableActionDto,
  InboxItemDto,
} from "@application/modules/workflow/dtos";
import { Button, type ButtonVariant } from "@presentation/shared/ui/Button";
import { Modal } from "@presentation/shared/ui/Modal";
import { FormField } from "@presentation/shared/ui/FormField";
import { errorMessage } from "@presentation/shared/lib/query";
import {
  canClaim,
  canRelease,
  isHeldByColleague,
} from "@core/modules/workflow/entities/WorkflowGovernance";
import { useCompleteAssignment, useReceiveAssignment } from "../hooks/useWorkflow";
import { useClaimAssignment, useReleaseAssignmentClaim } from "../hooks/useOperations";
import { t } from "@i18n/index";

const KIND_VARIANTS: Record<ActionKind, ButtonVariant> = {
  forward: "primary",
  backward: "danger",
  note: "ghost",
  closure: "secondary",
  final: "outline",
};

export interface ActionButtonsProps {
  assignment: InboxItemDto;
  actions: readonly AvailableActionDto[];
  onMessage?: (message: string) => void;
  onError?: (message: string) => void;
  size?: "sm" | "md";
}

export function ActionButtons({
  assignment,
  actions,
  onMessage,
  onError,
  size = "sm",
}: ActionButtonsProps) {
  const complete = useCompleteAssignment();
  const receive = useReceiveAssignment();
  const claim = useClaimAssignment();
  const release = useReleaseAssignmentClaim();
  const [noteFor, setNoteFor] = useState<AvailableActionDto | null>(null);
  const [note, setNote] = useState("");
  const [modalError, setModalError] = useState<string | null>(null);

  const claimState = {
    status: assignment.assignmentStatus,
    claimedAt: assignment.claimedAt,
    claimPolicy: assignment.claimPolicy,
  };

  // محجوزة لدى زميل: تُعرَض للاطّلاع ولا يُعرَض عليها زرّ يخدع
  if (isHeldByColleague(claimState)) {
    return (
      <span className="text-content-muted text-xs">{t.governance.heldByColleague}</span>
    );
  }

  if (assignment.assignmentStatus !== "in_progress") return null;

  async function run(action: AvailableActionDto, notes: string) {
    try {
      await complete.mutateAsync({
        assignmentId: assignment.assignmentId,
        actionKey: action.actionKey,
        notes,
      });
      onMessage?.(action.kind === "note" ? t.inbox.noteAdded : t.inbox.completed);
      return true;
    } catch (e) {
      const message = errorMessage(e);
      onError?.(message);
      setModalError(message);
      return false;
    }
  }

  function missingAttachment(action: AvailableActionDto): boolean {
    return action.requiresAttachment && action.attachmentCount === 0;
  }

  /**
   * شروط الجاهزية تُحسَب على الخادم وتصل مع الزرّ.
   * فيُعطَّل الزرّ برسالته هو، بدل أن يضغط الموظف ثم يُردّ.
   */
  function blockedBy(action: AvailableActionDto): string | null {
    if (missingAttachment(action)) return t.attachments.required;
    return action.unmetRequirements[0] ?? null;
  }

  async function handleClick(action: AvailableActionDto) {
    // المرفق والجاهزية يُفحصان قبل الضغط؛ الخادم يرفض بغيرهما على كل حال
    const blocked = blockedBy(action);
    if (blocked !== null) {
      onError?.(blocked);
      return;
    }
    // ما يشترط ملاحظة يُسأل عنها قبل الإرسال بدل أن يُردّ من الخادم
    if (action.requiresNote) {
      setModalError(null);
      setNote("");
      setNoteFor(action);
      return;
    }
    await run(action, "");
  }

  async function handleReceive() {
    try {
      await receive.mutateAsync(assignment.assignmentId);
      onMessage?.(t.inbox.received);
    } catch (e) {
      onError?.(errorMessage(e));
    }
  }

  async function handleClaim() {
    try {
      await claim.mutateAsync(assignment.assignmentId);
      onMessage?.(t.governance.claimedByYou);
    } catch (e) {
      onError?.(errorMessage(e));
    }
  }

  async function handleRelease() {
    try {
      await release.mutateAsync({
        assignmentId: assignment.assignmentId,
        reason: "",
      });
    } catch (e) {
      onError?.(errorMessage(e));
    }
  }

  // الحجز يسبق كل شيء: بغيره يعمل عشرة العمل نفسه
  if (canClaim(claimState)) {
    return (
      <Button
        variant="outline"
        size={size}
        onClick={() => void handleClaim()}
        isLoading={claim.isPending}
        title={t.governance.claimTitle}
      >
        {t.governance.claim}
      </Button>
    );
  }

  // الاستلام يسبق أي إجراء حين تشترطه المرحلة
  if (assignment.awaitingReceive) {
    return (
      <Button
        variant="outline"
        size={size}
        onClick={() => void handleReceive()}
        isLoading={receive.isPending}
      >
        {t.inbox.receive}
      </Button>
    );
  }

  if (assignment.awaitingDuration) {
    return (
      <span className="text-content-muted text-xs">{t.inbox.awaitingDuration}</span>
    );
  }

  if (actions.length === 0) {
    return <span className="text-content-muted text-xs">{t.inbox.noActions}</span>;
  }

  return (
    <>
      <span className="flex flex-wrap justify-end gap-2">
        {canRelease(claimState, true, false) && (
          <Button
            variant="ghost"
            size={size}
            onClick={() => void handleRelease()}
            isLoading={release.isPending}
          >
            {t.governance.release}
          </Button>
        )}
        {[...actions]
          .sort((a, b) => a.sortOrder - b.sortOrder)
          .map((action) => (
            <Button
              key={action.actionId}
              variant={KIND_VARIANTS[action.kind]}
              size={size}
              onClick={() => void handleClick(action)}
              isLoading={complete.isPending}
              disabled={blockedBy(action) !== null}
              title={blockedBy(action) ?? undefined}
            >
              {action.label}
            </Button>
          ))}
      </span>

      {noteFor !== null && (
        <Modal
          isOpen
          onClose={() => setNoteFor(null)}
          title={noteFor.label}
          description={assignment.stageName}
          footer={
            <>
              <Button
                onClick={() => {
                  void (async () => {
                    if (await run(noteFor, note)) setNoteFor(null);
                  })();
                }}
                isLoading={complete.isPending}
                disabled={note.trim() === ""}
              >
                {t.common.save}
              </Button>
              <Button variant="ghost" onClick={() => setNoteFor(null)}>
                {t.common.cancel}
              </Button>
            </>
          }
        >
          <div className="flex flex-col gap-3">
            <FormField label={t.transaction.notes} hint={t.inbox.noteRequired} required>
              {(id) => (
                <textarea
                  id={id}
                  rows={4}
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  className="border-border-strong bg-surface text-content w-full rounded-[var(--radius-control)] border px-3 py-2 text-sm"
                />
              )}
            </FormField>
            {modalError !== null && (
              <p role="alert" className="text-danger text-sm">
                {modalError}
              </p>
            )}
          </div>
        </Modal>
      )}
    </>
  );
}
