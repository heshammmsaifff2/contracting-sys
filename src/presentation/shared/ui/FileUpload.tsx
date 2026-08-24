/**
 * <FileUpload> — المكوّن المشترك الوحيد لرفع الملفّات في النظام.
 * لا يعرف المزوّد (Cloudinary) ولا يملك أي مفتاح: ينادي use-case محقونًا
 * يتولّى طلب التوقيع من Edge Function ثم الرفع المباشر.
 * ما يعود هو { publicId, url } وهو ما يُخزَّن في قاعدة البيانات.
 */
import { useRef, useState, type ChangeEvent } from "react";
import { FileUp, Trash2, CheckCircle2 } from "lucide-react";
import type { StoredFile } from "@application/shared/ports/file-storage";
import { useUseCases } from "@presentation/app/providers/di-context";
import { formatFileSize } from "../lib/formatters";
import { cn } from "../lib/cn";
import { t } from "@i18n/index";
import { Button } from "./Button";

export interface FileUploadProps {
  /** مجلّد منظّم حسب الوحدة والمشروع: erp/{project_id}/invoices */
  folder: string;
  value: StoredFile | null;
  onChange: (file: StoredFile | null) => void;
  accept?: string;
  /** الحد الأقصى بالميجابايت. */
  maxSizeMb?: number;
  /** للمستندات الحسّاسة (عقود، فواتير) — أصل خاص برابط موقّع. */
  authenticated?: boolean;
  disabled?: boolean;
  className?: string;
}

export function FileUpload({
  folder,
  value,
  onChange,
  accept = "image/*,application/pdf",
  maxSizeMb = 10,
  authenticated = false,
  disabled = false,
  className,
}: FileUploadProps) {
  const { uploadFile } = useUseCases();
  const inputRef = useRef<HTMLInputElement>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const maxBytes = maxSizeMb * 1024 * 1024;

  async function handleSelect(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    // نصفّر قيمة الحقل ليعمل اختيار نفس الملف مرتين متتاليتين
    event.target.value = "";
    if (!file) return;

    setError(null);

    if (file.size > maxBytes) {
      setError(
        `${t.upload.tooLarge} (${t.upload.maxSize}: ${formatFileSize(maxBytes)})`,
      );
      return;
    }

    setIsUploading(true);
    const result = await uploadFile.execute({ folder, file, authenticated });
    setIsUploading(false);

    if (!result.ok) {
      setError(result.error.message);
      return;
    }
    onChange(result.value);
  }

  return (
    <div className={cn("flex flex-col gap-2", className)}>
      <input
        ref={inputRef}
        type="file"
        accept={accept}
        className="sr-only"
        onChange={handleSelect}
        disabled={disabled || isUploading}
        aria-label={t.upload.label}
      />

      {value === null ? (
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          disabled={disabled || isUploading}
          className={cn(
            "flex w-full flex-col items-center justify-center gap-2 rounded-[var(--radius-card)]",
            "border-border-strong bg-surface-muted border-2 border-dashed px-4 py-8",
            "text-content-muted text-sm transition-colors",
            "hover:border-brand-400 hover:text-brand-700",
            "disabled:cursor-not-allowed disabled:opacity-60",
          )}
        >
          <FileUp aria-hidden className="size-6" />
          <span>{isUploading ? t.upload.uploading : t.upload.dropHere}</span>
          <span className="text-xs">
            {t.upload.maxSize}: {formatFileSize(maxBytes)}
          </span>
        </button>
      ) : (
        <div className="border-border bg-surface flex items-center justify-between gap-3 rounded-[var(--radius-card)] border px-4 py-3">
          <div className="flex min-w-0 items-center gap-2">
            <CheckCircle2 aria-hidden className="text-success size-5 shrink-0" />
            <a
              href={value.url}
              target="_blank"
              rel="noreferrer"
              className="text-brand-700 truncate text-sm underline"
            >
              {value.publicId}
            </a>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => onChange(null)}
            disabled={disabled}
            startIcon={<Trash2 aria-hidden className="text-danger size-4" />}
            aria-label={t.upload.remove}
          >
            {t.upload.remove}
          </Button>
        </div>
      )}

      {error !== null && (
        <p role="alert" className="text-danger text-xs">
          {t.upload.failed}: {error}
        </p>
      )}
    </div>
  );
}
