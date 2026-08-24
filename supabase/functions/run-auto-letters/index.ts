/**
 * run-auto-letters
 * وظيفة الصيانة المجدولة (Supabase Scheduled Function / cron):
 * (١) تنشئ الخطابات الآلية المستحقّة [المراسلات 10] — تصل الوارد كمعاملة
 *     رسمية لها مدة وعدّاد وتظهر في تقارير المتأخّر، لا كإشعار عابر.
 * (٢) تنبّه بانتهاء خطابات الضمان قبل موعدها بمدة من الإعدادات، وتعلّم
 *     المنتهي منها [الحسابات: الضمانات].
 *
 * الأمان: دالة run_auto_letters في Postgres مسحوبة الصلاحية من authenticated
 * وممنوحة لـ service_role وحده، فلا يستطيع أي مستخدم توليد خطابات بنفسه.
 * الاستدعاء هنا يتطلّب سرًّا مشتركًا (CRON_SECRET) لأن verify_jwt مُعطَّل
 * — فالمُشغِّل جدول زمني لا مستخدم.
 */
import { createClient } from "jsr:@supabase/supabase-js@2";
import { corsHeaders, errorResponse, jsonResponse } from "../_shared/cors.ts";

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }
  if (req.method !== "POST") {
    return errorResponse("الطريقة غير مدعومة", 405);
  }

  const expectedSecret = Deno.env.get("CRON_SECRET") ?? "";
  if (expectedSecret === "") {
    return errorResponse("لم يُضبط CRON_SECRET على الخادم", 500);
  }

  const providedSecret = req.headers.get("x-cron-secret") ?? "";
  if (providedSecret !== expectedSecret) {
    return errorResponse("غير مصرّح", 401);
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
  if (!supabaseUrl || !serviceKey) {
    return errorResponse("إعدادات الخادم غير مكتملة", 500);
  }

  const adminClient = createClient(supabaseUrl, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const { data: letters, error: lettersError } =
    await adminClient.rpc("run_auto_letters");

  if (lettersError) {
    return errorResponse(lettersError.message, 500);
  }

  // تنبيه الضمانات لا يُفشل المهمة كلها إن تعثّر — الخطابات أهم وأكثر تكرارًا
  const { data: guarantees, error: guaranteesError } = await adminClient.rpc(
    "notify_expiring_guarantees",
  );

  return jsonResponse({
    created: letters ?? 0,
    guaranteeAlerts: guarantees ?? 0,
    ...(guaranteesError === null ? {} : { guaranteeError: guaranteesError.message }),
  });
});
