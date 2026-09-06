/**
 * تأكيد بسطر واحد عند كل زرّ حذف.
 *
 * بغيره تحتاج كل شاشة حالةً لما يُحذف الآن وحالةً للخطأ وأخرى للانتظار —
 * فتُكتب مرّة ثم تُنسى عند الزرّ العاشر. هنا حالة واحدة ونافذة واحدة.
 *
 * والفعل يُمرَّر دالّةً لا معرّفًا: النافذة لا تعرف ما تحذف، وهذا يجعلها
 * تصلح للحذف ولغيره من الأفعال التي لا رجعة فيها.
 */
import { useCallback, useState, type ReactNode } from "react";
import { ConfirmDialog } from "./ConfirmDialog";
import { errorMessage } from "../lib/query";

export interface ConfirmRequest {
  title: string;
  description?: ReactNode;
  consequences?: readonly string[];
  /** يُطلَب كتابته حرفًا بحرف قبل فتح زرّ التأكيد — للأخطر وحده. */
  confirmPhrase?: string;
  confirmLabel?: string;
  onConfirm: () => void | Promise<unknown>;
}

export interface UseConfirmResult {
  ask: (request: ConfirmRequest) => void;
  /** ضعه مرّة في نهاية الشاشة. */
  dialog: ReactNode;
}

export function useConfirm(): UseConfirmResult {
  const [request, setRequest] = useState<ConfirmRequest | null>(null);
  const [isRunning, setIsRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const ask = useCallback((next: ConfirmRequest) => {
    setError(null);
    setIsRunning(false);
    setRequest(next);
  }, []);

  const close = useCallback(() => {
    setRequest(null);
    setError(null);
    setIsRunning(false);
  }, []);

  async function run() {
    if (request === null) return;
    setError(null);
    setIsRunning(true);
    try {
      await request.onConfirm();
      close();
    } catch (e) {
      // النافذة تبقى مفتوحة: الرسالة تُقرأ حيث وقع الفعل لا في مكان آخر
      setError(errorMessage(e));
      setIsRunning(false);
    }
  }

  return {
    ask,
    dialog:
      request === null ? null : (
        <ConfirmDialog
          title={request.title}
          {...(request.description === undefined
            ? {}
            : { description: request.description })}
          {...(request.consequences === undefined
            ? {}
            : { consequences: request.consequences })}
          {...(request.confirmPhrase === undefined
            ? {}
            : { confirmPhrase: request.confirmPhrase })}
          {...(request.confirmLabel === undefined
            ? {}
            : { confirmLabel: request.confirmLabel })}
          isLoading={isRunning}
          error={error}
          onConfirm={() => void run()}
          onCancel={close}
        />
      ),
  };
}
