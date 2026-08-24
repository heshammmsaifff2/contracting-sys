/**
 * اختبار الرفع الآمن المطلوب في Phase 0: رفع صورة واحدة عبر التوقيع المؤقّت.
 */
import { useState } from "react";
import type { StoredFile } from "@application/shared/ports/file-storage";
import { FileUpload } from "@presentation/shared/ui/FileUpload";
import { STORAGE_ROOT } from "@config/app";
import { t } from "@i18n/index";

export function UploadCheck() {
  const [file, setFile] = useState<StoredFile | null>(null);

  return (
    <div className="flex flex-col gap-3">
      <p className="text-content-muted text-sm">{t.setup.fileUploadHint}</p>

      <FileUpload
        folder={`${STORAGE_ROOT}/setup-check`}
        value={file}
        onChange={setFile}
        accept="image/*"
        maxSizeMb={5}
      />

      {file !== null && (
        <dl className="bg-surface-sunken rounded-[var(--radius-control)] p-3 text-xs">
          <div className="flex gap-2">
            <dt className="text-content font-medium">public_id:</dt>
            <dd className="text-content-muted truncate font-mono">{file.publicId}</dd>
          </div>
          <div className="mt-1 flex gap-2">
            <dt className="text-content font-medium">secure_url:</dt>
            <dd className="text-content-muted truncate font-mono">{file.url}</dd>
          </div>
        </dl>
      )}
    </div>
  );
}
