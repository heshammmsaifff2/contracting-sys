import { useEffect, useRef, type ReactNode } from "react";
import { X } from "lucide-react";
import { cn } from "../lib/cn";
import { t } from "@i18n/index";

export interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  children: ReactNode;
  /** أزرار الإجراءات أسفل النافذة. */
  footer?: ReactNode;
  size?: "sm" | "md" | "lg";
}

const SIZES = {
  sm: "max-w-md",
  md: "max-w-2xl",
  lg: "max-w-4xl",
} as const;

/** نافذة حوارية أصلية (<dialog>) — تدعم Esc وحبس التركيز تلقائيًا. */
export function Modal({
  isOpen,
  onClose,
  title,
  description,
  children,
  footer,
  size = "md",
}: ModalProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (dialog === null) return;

    if (isOpen && !dialog.open) dialog.showModal();
    if (!isOpen && dialog.open) dialog.close();
  }, [isOpen]);

  return (
    <dialog
      ref={dialogRef}
      dir="rtl"
      onCancel={(event) => {
        event.preventDefault();
        onClose();
      }}
      onClick={(event) => {
        // الضغط على الخلفية خارج المحتوى يغلق النافذة
        if (event.target === dialogRef.current) onClose();
      }}
      className={cn(
        "bg-surface text-content m-auto w-[calc(100vw-2rem)] rounded-[var(--radius-card)] p-0",
        "backdrop:bg-black/40",
        SIZES[size],
      )}
    >
      <div className="border-border flex items-start justify-between gap-4 border-b px-5 py-4">
        <div className="min-w-0">
          <h2 className="text-content text-base font-bold">{title}</h2>
          {description !== undefined && (
            <p className="text-content-muted mt-1 text-sm">{description}</p>
          )}
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label={t.common.close}
          className="text-content-muted hover:bg-surface-sunken grid size-8 shrink-0 place-items-center rounded-[var(--radius-control)]"
        >
          <X aria-hidden className="size-4" />
        </button>
      </div>

      <div className="max-h-[70vh] overflow-y-auto px-5 py-4">{children}</div>

      {footer !== undefined && (
        <div className="border-border flex justify-start gap-2 border-t px-5 py-4">
          {footer}
        </div>
      )}
    </dialog>
  );
}
