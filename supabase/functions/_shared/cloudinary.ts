/**
 * أدوات Cloudinary المشتركة. الـ api_secret يُقرأ من أسرار الخادم فقط
 * ولا يُعاد في أي استجابة إطلاقًا.
 */
export interface CloudinaryConfig {
  cloudName: string;
  apiKey: string;
  apiSecret: string;
}

export function readConfig(): CloudinaryConfig | null {
  const cloudName = Deno.env.get("CLOUDINARY_CLOUD_NAME");
  const apiKey = Deno.env.get("CLOUDINARY_API_KEY");
  const apiSecret = Deno.env.get("CLOUDINARY_API_SECRET");
  if (!cloudName || !apiKey || !apiSecret) return null;
  return { cloudName, apiKey, apiSecret };
}

/**
 * توقيع Cloudinary: ترتيب المعاملات أبجديًا، ربطها بـ &، إلحاق api_secret، ثم SHA-1.
 */
export async function signParams(
  params: Record<string, string>,
  apiSecret: string,
): Promise<string> {
  const toSign = Object.keys(params)
    .sort()
    .map((key) => `${key}=${params[key]}`)
    .join("&");

  const bytes = new TextEncoder().encode(toSign + apiSecret);
  const digest = await crypto.subtle.digest("SHA-1", bytes);

  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

/** المجلّدات مقيّدة بالجذر erp/ لمنع الكتابة خارج مساحة النظام. */
export function isValidFolder(folder: unknown): folder is string {
  return typeof folder === "string" && /^erp(\/[A-Za-z0-9._-]+)+$/.test(folder);
}
