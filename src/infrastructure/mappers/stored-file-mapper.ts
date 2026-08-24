/**
 * تحويل أعمدة jsonb التي تحمل مراجع Cloudinary ⇄ نوع StoredFile المجرّد.
 * قاعدة المواصفات: نخزّن public_id و secure_url فقط، لا الملف نفسه.
 */
import type { StoredFile } from "@application/shared/ports/file-storage";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/** DB jsonb {public_id, url} → StoredFile (يتسامح مع secure_url). */
export function toStoredFile(value: unknown): StoredFile | null {
  if (!isRecord(value)) return null;
  const publicId = value.public_id ?? value.publicId;
  const url = value.url ?? value.secure_url;
  if (typeof publicId !== "string" || typeof url !== "string") return null;
  return { publicId, url };
}

/** DB jsonb [{public_id, url}] → StoredFile[] — يتجاهل العناصر التالفة. */
export function toStoredFiles(value: unknown): StoredFile[] {
  if (!Array.isArray(value)) return [];
  return value.map(toStoredFile).filter((file): file is StoredFile => file !== null);
}

/** StoredFile → jsonb بالشكل الذي تتوقّعه قاعدة البيانات. */
export function fromStoredFile(
  file: StoredFile | null,
): { public_id: string; url: string } | null {
  if (file === null) return null;
  return { public_id: file.publicId, url: file.url };
}

export function fromStoredFiles(
  files: readonly StoredFile[],
): { public_id: string; url: string }[] {
  return files.map((file) => ({ public_id: file.publicId, url: file.url }));
}
