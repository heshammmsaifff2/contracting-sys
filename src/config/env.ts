/**
 * متغيّرات البيئة — تُقرأ وتُتحقّق مرة واحدة عند الإقلاع.
 * لا تُقرأ import.meta.env في أي مكان آخر من التطبيق.
 * ملاحظة أمنية: المتغيّرات السرّية (SERVICE_ROLE / API_SECRET) لا تُقرأ هنا إطلاقًا،
 * فهي تخصّ Edge Functions على الخادم فقط.
 */
import { z } from "zod";

const envSchema = z.object({
  VITE_SUPABASE_URL: z.string().url("VITE_SUPABASE_URL يجب أن يكون رابطًا صالحًا"),
  VITE_SUPABASE_ANON_KEY: z.string().min(1, "VITE_SUPABASE_ANON_KEY مطلوب"),
  VITE_CLOUDINARY_CLOUD_NAME: z.string().min(1, "VITE_CLOUDINARY_CLOUD_NAME مطلوب"),
  VITE_CLOUDINARY_API_KEY: z.string().min(1, "VITE_CLOUDINARY_API_KEY مطلوب"),
});

export type AppEnv = z.infer<typeof envSchema>;

function readEnv(): AppEnv {
  const parsed = envSchema.safeParse(import.meta.env);
  if (!parsed.success) {
    const issues = parsed.error.issues
      .map((i) => `- ${String(i.path[0])}: ${i.message}`)
      .join("\n");
    throw new Error(`إعدادات البيئة ناقصة أو غير صالحة:\n${issues}`);
  }
  return parsed.data;
}

export const env: AppEnv = readEnv();

export const isDev = import.meta.env.DEV;
export const isProd = import.meta.env.PROD;
export const mode = import.meta.env.MODE;
