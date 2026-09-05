/**
 * مرفقات المعاملة.
 *
 * الملفّ يُرفع مباشرة إلى المزوّد بتوقيع من الخادم، ولا يُخزَّن في القاعدة —
 * ما يُحفَظ مرجعُه وحده. والمرفق يُربَط بالتكليف المفتوح للمستخدم، فيُعرَف من
 * أرفقه وفي أي مرحلة، ويُفتَح به زرٌّ يشترط مرفقًا.
 *
 * والمرفق المختوم بإجراء لا يُحذف: صار جزءًا من الخطّ الزمني.
 */
import { useState } from "react";
import { Lock, Paperclip, Trash2 } from "lucide-react";
import type { StoredFile } from "@application/shared/ports/file-storage";
import type {
  AttachmentVisibility,
  InboxItemDto,
  TransactionAttachmentDto,
} from "@application/modules/workflow/dtos";
import { transactionAttachmentFolder } from "@application/modules/workflow/use-cases/AttachmentUseCases";
import { Card } from "@presentation/shared/ui/Card";
import { Badge } from "@presentation/shared/ui/Badge";
import { Button } from "@presentation/shared/ui/Button";
import { Select } from "@presentation/shared/ui/Select";
import { FormField } from "@presentation/shared/ui/FormField";
import { FileUpload } from "@presentation/shared/ui/FileUpload";
import { EmptyState } from "@presentation/shared/ui/EmptyState";
import { formatDateTime, formatFileSize } from "@presentation/shared/lib/formatters";
import { errorMessage } from "@presentation/shared/lib/query";
import { useCurrentUser } from "@presentation/shared/hooks/useCurrentUser";
import { useAddAttachment, useRemoveAttachment } from "../hooks/useAttachments";
import { t } from "@i18n/index";

const VISIBILITY_OPTIONS = [
  { value: "participants", label: t.attachments.visParticipants },
  { value: "permission", label: t.attachments.visPermission },
];

export interface AttachmentsCardProps {
  transactionId: string;
  attachments: readonly TransactionAttachmentDto[];
  /** كل تكليفات المعاملة المفتوحة — يُصفّى منها تكليف المستخدم نفسه. */
  openAssignments: readonly InboxItemDto[];
  isLoading?: boolean;
}

export function AttachmentsCard({
  transactionId,
  attachments,
  openAssignments,
  isLoading = false,
}: AttachmentsCardProps) {
  const currentUser = useCurrentUser();
  const add = useAddAttachment();
  const remove = useRemoveAttachment();
  const [visibility, setVisibility] = useState<AttachmentVisibility>("participants");
  const [error, setError] = useState<string | null>(null);

  // الإرفاق يُنسب لتكليف **المستخدم نفسه**: الخادم يرفض الإرفاق على تكليف غيره
  const myAssignment =
    openAssignments.find((a) => a.assigneeId === currentUser.id) ?? null;
  const assignmentId = myAssignment?.assignmentId ?? null;
  const canAttach = myAssignment !== null;

  async function handleUploaded(file: StoredFile | null) {
    if (file === null) return;
    setError(null);
    try {
      await add.mutateAsync({
        transactionId,
        assignmentId,
        // الاسم من آخر مقطع في المعرّف — المزوّد لا يعيد الاسم الأصلي
        name: file.publicId.split("/").pop() ?? file.publicId,
        file,
        contentType: "",
        sizeBytes: 0,
        visibility,
        departmentId: null,
        requiredPermission:
          visibility === "permission" ? "attachment.read_restricted" : null,
        isAuthenticated: visibility !== "participants",
      });
    } catch (e) {
      setError(errorMessage(e));
    }
  }

  async function handleRemove(attachment: TransactionAttachmentDto) {
    setError(null);
    try {
      await remove.mutateAsync(attachment.id);
    } catch (e) {
      setError(errorMessage(e));
    }
  }

  return (
    <Card title={t.attachments.title} description={t.attachments.hint}>
      {canAttach && (
        <div className="border-border mb-4 flex flex-wrap items-end gap-3 border-b pb-4">
          <div className="min-w-48">
            <FormField label={t.attachments.visibility}>
              {(id) => (
                <Select
                  id={id}
                  options={VISIBILITY_OPTIONS}
                  value={visibility}
                  onChange={(e) =>
                    setVisibility(e.target.value as AttachmentVisibility)
                  }
                />
              )}
            </FormField>
          </div>

          <FileUpload
            folder={transactionAttachmentFolder(transactionId)}
            value={null}
            onChange={(file) => void handleUploaded(file)}
            authenticated={visibility !== "participants"}
            maxSizeMb={25}
            disabled={add.isPending}
          />
        </div>
      )}

      {error !== null && (
        <p role="alert" className="text-danger mb-3 text-sm">
          {error}
        </p>
      )}

      {attachments.length === 0 ? (
        <EmptyState
          title={t.attachments.empty}
          {...(isLoading ? {} : { description: t.attachments.emptyHint })}
        />
      ) : (
        <ul className="divide-border divide-y">
          {attachments.map((attachment) => (
            <li
              key={attachment.id}
              className="flex flex-wrap items-center gap-3 py-2.5"
            >
              <Paperclip aria-hidden className="text-content-muted size-4 shrink-0" />

              <span className="min-w-0 flex-1">
                <a
                  href={attachment.file.url}
                  target="_blank"
                  rel="noreferrer"
                  className="text-brand-700 block truncate text-sm underline"
                >
                  {attachment.name}
                </a>
                <span className="text-content-muted block text-[11px]">
                  {attachment.uploadedByName ?? "—"}
                  {attachment.stageName !== null && ` · ${attachment.stageName}`}
                  {` · ${formatDateTime(attachment.createdAt)}`}
                  {attachment.sizeBytes > 0 &&
                    ` · ${formatFileSize(attachment.sizeBytes)}`}
                </span>
              </span>

              {attachment.visibility !== "participants" && (
                <Badge tone="warning">
                  <Lock aria-hidden className="me-1 inline size-3" />
                  {attachment.visibility === "department"
                    ? (attachment.departmentName ?? t.attachments.visDepartment)
                    : t.attachments.visPermission}
                </Badge>
              )}

              {/* المختوم بإجراء لا يُحذف — لا زرّ له أصلًا */}
              {attachment.actionLogId === null ? (
                <Button
                  variant="ghost"
                  size="sm"
                  aria-label={t.common.delete}
                  onClick={() => void handleRemove(attachment)}
                  isLoading={remove.isPending}
                  startIcon={<Trash2 aria-hidden className="text-danger size-4" />}
                />
              ) : (
                <Badge tone="neutral">{t.attachments.sealed}</Badge>
              )}
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}
