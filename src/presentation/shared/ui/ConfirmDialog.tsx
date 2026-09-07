/**
 * تأكيد قبل فعلٍ لا رجعة فيه.
 *
 * بُني على `Modal` لا على مكتبة تنبيهات خارجية: الشاشة عربية من اليمين
 * لليسار، وألوانها ومقاييسها من الثيم — ومكتبة تأتي بتنسيقها هي تبدو غريبة
 * وتحتاج ضبطًا للاتّجاه والخطّ لتلحق ببقيّة النظام.
 *
 * وهو **يمنع الضغط بالعادة**: زرّ التأكيد أحمر ولا يُركَّز تلقائيًّا، وما كان
 * أخطر يطلب كتابة الاسم بيد المستخدم قبل أن ينفتح.
 */
import { useState, type ReactNode } from "react";
import { AlertTriangle, Ban, Trash2 } from "lucide-react";
import { Modal } from "./Modal";
import { Button } from "./Button";
import { Input } from "./Input";
import { FormField } from "./FormField";
import { t } from "@i18n/index";

export interface ConfirmDialogProps {
  /** عنوان قصير يقول ماذا سيقع. */
  title: string;
  /** ما يجب أن يعرفه قبل أن يضغط — لا «هل أنت متأكد؟». */
  description?: ReactNode;
  /** ما لا رجعة فيه: تعداد ما سيذهب معه. */
  consequences?: readonly string[];
  /**
   * حين يُمرَّر، لا يُفتح زرّ التأكيد حتى يكتبه المستخدم حرفًا بحرف.
   * للأفعال التي تمحو عملًا كثيرًا — لا لكل حذف.
   */
  confirmPhrase?: string;
  confirmLabel?: string;
  isLoading?: boolean;
  /** رسالة الخطأ إن رفض الخادم — تبقى النافذة مفتوحة ليقرأها. */
  error?: string | null;
  /**
   * سببُ منعٍ معروف **قبل** المحاولة.
   *
   * حين يُمرَّر لا يُعرَض زرّ التنفيذ أصلًا: زرٌّ يُفتح لفعلٍ نعلم أنه سيُردّ
   * يُعلّم المستخدم أن يضغط ثم يقرأ، والصواب أن يقرأ فلا يضغط.
   */
  blockedReason?: string;
  onConfirm: () => void;
  onCancel: () => void;
}

export function ConfirmDialog({
  title,
  description,
  consequences,
  confirmPhrase,
  confirmLabel = t.common.delete,
  isLoading = false,
  error = null,
  blockedReason,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  const [typed, setTyped] = useState("");

  const isBlocked = blockedReason !== undefined;
  const isUnlocked =
    confirmPhrase === undefined || typed.trim() === confirmPhrase.trim();

  return (
    <Modal
      isOpen
      onClose={onCancel}
      title={title}
      footer={
        isBlocked ? (
          <Button onClick={onCancel}>{t.common.close}</Button>
        ) : (
          <>
            <Button
              variant="danger"
              onClick={onConfirm}
              isLoading={isLoading}
              disabled={!isUnlocked}
              startIcon={<Trash2 aria-hidden className="size-4" />}
            >
              {confirmLabel}
            </Button>
            <Button variant="ghost" onClick={onCancel}>
              {t.common.cancel}
            </Button>
          </>
        )
      }
    >
      <div className="flex flex-col gap-4">
        <div className="flex items-start gap-3">
          {isBlocked ? (
            <Ban aria-hidden className="text-danger mt-0.5 size-5 shrink-0" />
          ) : (
            <AlertTriangle aria-hidden className="text-danger mt-0.5 size-5 shrink-0" />
          )}
          <div className="min-w-0">
            {isBlocked && (
              <p className="text-content mb-1 text-sm font-bold">
                {t.common.cannotDelete}
              </p>
            )}
            <p className="text-content text-sm whitespace-pre-line">
              {blockedReason ?? description ?? t.common.confirmDelete}
            </p>
          </div>
        </div>

        {!isBlocked && consequences !== undefined && consequences.length > 0 && (
          <div className="border-danger/30 bg-danger-soft rounded-[var(--radius-control)] border p-3">
            <p className="text-content mb-1 text-xs font-bold">
              {t.common.irreversible}
            </p>
            <ul className="text-content-muted list-inside list-disc text-xs">
              {consequences.map((line) => (
                <li key={line}>{line}</li>
              ))}
            </ul>
          </div>
        )}

        {!isBlocked && confirmPhrase !== undefined && (
          <FormField label={t.common.typeToConfirm} hint={confirmPhrase} required>
            {(id) => (
              <Input
                id={id}
                value={typed}
                onChange={(e) => setTyped(e.target.value)}
                autoComplete="off"
              />
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
