/**
 * post-accounting-entry
 * البوابة الوحيدة لترحيل القيود الآلية (القسم 8 من المواصفات).
 *
 * لماذا Edge Function وليس استدعاءً مباشرًا من المتصفّح؟
 * دالة post_accounting_entry في Postgres هي SECURITY DEFINER (تتجاوز RLS لتكتب
 * في دفتر اليومية)، ولذلك سُحب حقّ تنفيذها من authenticated ومُنح لـ service_role
 * وحده. فالمسار الوحيد للترحيل يمرّ من هنا بعد فحصين:
 *   1) الطالب مسجّل الدخول.
 *   2) الطالب يرى المستند المصدر فعليًا تحت RLS — فمن لا يراه لا يرحّله.
 * ثم يتولّى Postgres بناء القيد ذرّيًا: إمّا قيد متوازن كامل أو لا شيء.
 *
 * الطلب : { sourceType, sourceId }
 * الردّ  : { entryId }
 */
import { createClient } from "jsr:@supabase/supabase-js@2";
import { corsHeaders, errorResponse, jsonResponse } from "../_shared/cors.ts";

/** المستند المصدر لكل نوع حدث — يُوسَّع مع كل مرحلة. */
const SOURCE_TABLES: Record<string, string> = {
  opening_balance: "opening_balances",
  receipt_approval: "receipt_requests",
  payment_transfer: "payment_requests",
  material_transfer: "transfer_notes",
  // Phase 6: extract_approval, custody_approval
  // Phase 7: loan_disbursement
};

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }
  if (req.method !== "POST") {
    return errorResponse("الطريقة غير مدعومة", 405);
  }

  const authHeader = req.headers.get("Authorization");
  if (!authHeader) {
    return errorResponse("مطلوب تسجيل الدخول", 401);
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY") ?? "";
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

  if (!supabaseUrl || !anonKey || !serviceKey) {
    return errorResponse("إعدادات الخادم غير مكتملة", 500);
  }

  let body: { sourceType?: unknown; sourceId?: unknown };
  try {
    body = await req.json();
  } catch {
    return errorResponse("جسم الطلب غير صالح", 400);
  }

  const sourceType = typeof body.sourceType === "string" ? body.sourceType : "";
  const sourceId = typeof body.sourceId === "string" ? body.sourceId : "";

  const sourceTable = SOURCE_TABLES[sourceType];
  if (sourceTable === undefined) {
    return errorResponse(`نوع الحدث ${sourceType} غير مدعوم`, 400);
  }
  if (!UUID_PATTERN.test(sourceId)) {
    return errorResponse("معرّف المستند غير صالح", 400);
  }

  // عميل بصلاحيات الطالب — تسري عليه سياسات RLS
  const callerClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authHeader } },
  });

  const { data: caller, error: callerError } = await callerClient.auth.getUser();
  if (callerError || !caller.user) {
    return errorResponse("جلسة غير صالحة", 401);
  }

  // من لا يرى المستند تحت RLS لا يحقّ له إطلاق قيده
  const { data: source, error: sourceError } = await callerClient
    .from(sourceTable)
    .select("id")
    .eq("id", sourceId)
    .maybeSingle();

  if (sourceError) {
    return errorResponse("تعذّر قراءة المستند المصدر", 500);
  }
  if (source === null) {
    return errorResponse("المستند غير موجود أو لا تملك صلاحية عليه", 403);
  }

  // الترحيل نفسه بصلاحيات كاملة — بعد اجتياز الفحصين أعلاه
  const adminClient = createClient(supabaseUrl, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const { data: entryId, error: postError } = await adminClient.rpc(
    "post_accounting_entry",
    { p_source_type: sourceType, p_source_id: sourceId },
  );

  if (postError) {
    // أخطاء الدومين (مستند غير معتمد، حساب تجميعي، قيد غير متوازن) تُعاد كـ 400
    const isDomain =
      postError.code === "23514" ||
      postError.code === "P0002" ||
      postError.code === "0A000";
    return errorResponse(postError.message, isDomain ? 400 : 500);
  }

  return jsonResponse({ entryId });
});
