import { createClient } from "jsr:@supabase/supabase-js@2";

/**
 * يتحقّق من أن الطلب صادر عن مستخدم مسجّل الدخول.
 * لا دالة تتعامل مع الأسرار تُنفَّذ لمستخدم مجهول.
 */
export async function requireUser(
  req: Request,
): Promise<
  { ok: true; userId: string } | { ok: false; status: number; message: string }
> {
  const authHeader = req.headers.get("Authorization");
  if (!authHeader) {
    return { ok: false, status: 401, message: "مطلوب تسجيل الدخول" };
  }

  const client = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_ANON_KEY") ?? "",
    { global: { headers: { Authorization: authHeader } } },
  );

  const { data, error } = await client.auth.getUser();
  if (error || !data.user) {
    return { ok: false, status: 401, message: "جلسة غير صالحة" };
  }

  return { ok: true, userId: data.user.id };
}
