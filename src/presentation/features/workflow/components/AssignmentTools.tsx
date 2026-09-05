/**
 * أدوات التشغيل على تكليف بعينه: تحويل · تذكير · تحذير · مدّ مهلة.
 *
 * كلّها تطلب سببًا مكتوبًا — وليس تشدُّدًا: هو ما يجعل الفعل قابلًا للمراجعة
 * بعد شهر، ويظهر في الخطّ الزمني بجانب الإجراءات.
 */
import { useState } from "react";
import { Bell, Clock3, ShieldAlert, Users } from "lucide-react";
import type { InboxItemDto } from "@application/modules/workflow/dtos";
import { Badge } from "@presentation/shared/ui/Badge";
import { Button } from "@presentation/shared/ui/Button";
import { Input } from "@presentation/shared/ui/Input";
import { Select } from "@presentation/shared/ui/Select";
import { FormField } from "@presentation/shared/ui/FormField";
import { Modal } from "@presentation/shared/ui/Modal";
import { PermissionGate } from "@presentation/shared/ui/PermissionGate";
import { errorMessage } from "@presentation/shared/lib/query";
import { useCurrentUser } from "@presentation/shared/hooks/useCurrentUser";
import {
  useExtendDeadline,
  useSendAlert,
  useTransferAssignment,
  useTransferTargets,
} from "../hooks/useOperations";
import { t } from "@i18n/index";

type Tool = "transfer" | "reminder" | "warning" | "extend";

export interface AssignmentToolsProps {
  assignment: InboxItemDto;
  onMessage: (message: string) => void;
  onError: (message: string) => void;
}

export function AssignmentTools({
  assignment,
  onMessage,
  onError,
}: AssignmentToolsProps) {
  const currentUser = useCurrentUser();
  const [tool, setTool] = useState<Tool | null>(null);

  if (assignment.assignmentStatus !== "in_progress") return null;

  const isMine = assignment.assigneeId === currentUser.id;

  return (
    <>
      <span className="flex flex-wrap gap-1">
        {/* التحويل حقّ المكلَّف نفسه، أو صاحب صلاحية التحويل */}
        {isMine ? (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setTool("transfer")}
            startIcon={<Users aria-hidden className="size-3.5" />}
          >
            {t.ops.transfer}
          </Button>
        ) : (
          <PermissionGate permission="transaction.transfer">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setTool("transfer")}
              startIcon={<Users aria-hidden className="size-3.5" />}
            >
              {t.ops.transfer}
            </Button>
          </PermissionGate>
        )}

        <PermissionGate permission="transaction.alert">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setTool("reminder")}
            startIcon={<Bell aria-hidden className="size-3.5" />}
          >
            {t.ops.reminder}
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setTool("warning")}
            startIcon={<ShieldAlert aria-hidden className="text-danger size-3.5" />}
          >
            {t.ops.warning}
          </Button>
        </PermissionGate>

        <PermissionGate permission="transaction.extend">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setTool("extend")}
            startIcon={<Clock3 aria-hidden className="size-3.5" />}
          >
            {t.ops.extend}
          </Button>
        </PermissionGate>

        {assignment.warningsCount > 0 && (
          <Badge tone="danger">{t.ops.warningsCount(assignment.warningsCount)}</Badge>
        )}
        {assignment.extendedMinutes > 0 && (
          <Badge tone="neutral">{t.ops.extendedBy(assignment.extendedMinutes)}</Badge>
        )}
      </span>

      {tool !== null && (
        <ToolModal
          tool={tool}
          assignment={assignment}
          onClose={() => setTool(null)}
          onMessage={onMessage}
          onError={onError}
        />
      )}
    </>
  );
}

function ToolModal({
  tool,
  assignment,
  onClose,
  onMessage,
  onError,
}: {
  tool: Tool;
  assignment: InboxItemDto;
  onClose: () => void;
  onMessage: (message: string) => void;
  onError: (message: string) => void;
}) {
  const transfer = useTransferAssignment();
  const alert = useSendAlert();
  const extend = useExtendDeadline();
  const targets = useTransferTargets(
    tool === "transfer" ? assignment.assignmentId : null,
  );

  const [reason, setReason] = useState("");
  const [toUserId, setToUserId] = useState("");
  const [extraMinutes, setExtraMinutes] = useState("60");
  const [error, setError] = useState<string | null>(null);

  const titles: Record<Tool, string> = {
    transfer: t.ops.transferTitle,
    reminder: t.ops.reminderTitle,
    warning: t.ops.warningTitle,
    extend: t.ops.extendTitle,
  };

  // التذكير وحده لا يلزمه سبب
  const reasonRequired = tool !== "reminder";
  const isPending = transfer.isPending || alert.isPending || extend.isPending;

  async function handleSubmit() {
    setError(null);
    try {
      if (tool === "transfer") {
        await transfer.mutateAsync({
          assignmentId: assignment.assignmentId,
          toUserId,
          reason,
        });
        onMessage(t.ops.transferred);
      } else if (tool === "extend") {
        await extend.mutateAsync({
          assignmentId: assignment.assignmentId,
          extraMinutes: Number(extraMinutes),
          reason,
        });
        onMessage(t.ops.extended);
      } else {
        await alert.mutateAsync({
          assignmentId: assignment.assignmentId,
          kind: tool,
          reason,
        });
        onMessage(tool === "warning" ? t.ops.warned : t.ops.reminded);
      }
      onClose();
    } catch (e) {
      const message = errorMessage(e);
      setError(message);
      onError(message);
    }
  }

  const canSubmit =
    (!reasonRequired || reason.trim() !== "") &&
    (tool !== "transfer" || toUserId !== "") &&
    (tool !== "extend" || Number(extraMinutes) > 0);

  return (
    <Modal
      isOpen
      onClose={onClose}
      title={titles[tool]}
      description={`${assignment.stageName} — ${assignment.assigneeName ?? ""}`}
      footer={
        <>
          <Button
            onClick={() => void handleSubmit()}
            isLoading={isPending}
            disabled={!canSubmit}
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
        {tool === "transfer" && (
          <FormField label={t.ops.transferTo} hint={t.ops.transferHint} required>
            {(id) => (
              <Select
                id={id}
                options={(targets.data ?? []).map((x) => ({
                  value: x.userId,
                  label: x.fullName,
                }))}
                placeholder={t.projects.none}
                value={toUserId}
                onChange={(e) => setToUserId(e.target.value)}
              />
            )}
          </FormField>
        )}

        {tool === "transfer" && (targets.data ?? []).length === 0 && (
          <p className="text-warning text-xs">{t.ops.noTargets}</p>
        )}

        {tool === "extend" && (
          <FormField label={t.ops.extraMinutes} hint={t.ops.extendHint} required>
            {(id) => (
              <Input
                id={id}
                type="number"
                min="1"
                dir="ltr"
                value={extraMinutes}
                onChange={(e) => setExtraMinutes(e.target.value)}
              />
            )}
          </FormField>
        )}

        <FormField
          label={t.ops.reason}
          {...(tool === "warning" ? { hint: t.ops.warningHint } : {})}
          required={reasonRequired}
        >
          {(id) => (
            <textarea
              id={id}
              rows={3}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              className="border-border-strong bg-surface text-content w-full rounded-[var(--radius-control)] border px-3 py-2 text-sm"
            />
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
