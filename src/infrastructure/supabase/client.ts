/**
 * العميل الوحيد لـ Supabase في التطبيق كلّه.
 * ممنوع استيراد هذا الملف من `core` أو `application` أو `presentation` —
 * الوصول يمرّ عبر Repositories/Services في طبقة infrastructure فقط.
 */
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { env } from "@config/env";
import type { Database } from "./database.types";

export type AppSupabaseClient = SupabaseClient<Database>;

export const supabase: AppSupabaseClient = createClient<Database>(
  env.VITE_SUPABASE_URL,
  env.VITE_SUPABASE_ANON_KEY,
  {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
    },
  },
);
