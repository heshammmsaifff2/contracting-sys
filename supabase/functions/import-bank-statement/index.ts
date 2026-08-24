/**
 * import-bank-statement
 * ترحيل كشف حساب البنك: يطابق سطور الكشف بطلبات الدفع المعلّقة (الرواتب
 * والسلف والمستخلصات)، فيعلّمها «محوَّلة» ويُسجّل قيد الصرف آليًا.
 *
 * لماذا Edge Function لا الواجهة؟
 *   post_accounting_entry ممنوحة لـ service_role وحده، فلا مسار للترحيل
 *   إلا من هنا. والتحقّق مزدوج كالمعتاد:
 *     1) الطالب مسجّل الدخول.
 *     2) يملك صلاحية payroll.import — بدالة has_permission نفسها التي
 *        تستند إليها سياسات RLS.
 *
 * الطلب : { rows: [{ reference, amount, transferredAt? }], dryRun? }
 * الردّ  : { matched, transferred, posted, skipped: [{ reference, reason }] }
 *
 * المطابقة برقم طلب الدفع وقيمته معًا: رقم وحده قد يتكرّر في كشوف قديمة،
 * وقيمة وحدها لا تدلّ على صاحبها.
 */
import { createClient } from "jsr:@supabase/supabase-js@2";
import { corsHeaders, errorResponse, jsonResponse } from "../_shared/cors.ts";

interface StatementRow {
  reference?: unknown;
  amount?: unknown;
  transferredAt?: unknown;
}

interface ImportBody {
  rows?: unknown;
  dryRun?: unknown;
}

/** فرق مقبول بين قيمة الكشف وقيمة الطلب (كسور التقريب). */
const AMOUNT_TOLERANCE = 0.01;

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

  const callerClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authHeader } },
  });

  const { data: caller, error: callerError } = await callerClient.auth.getUser();
  if (callerError || !caller.user) {
    return errorResponse("جلسة غير صالحة", 401);
  }

  const { data: allowed, error: permError } = await callerClient.rpc("has_permission", {
    permission_key: "payroll.import",
  });
  if (permError) {
    return errorResponse("تعذّر التحقّق من الصلاحية", 500);
  }
  if (allowed !== true) {
    return errorResponse("لا تملك صلاحية ترحيل كشف البنك", 403);
  }

  let body: ImportBody;
  try {
    body = await req.json();
  } catch {
    return errorResponse("جسم الطلب غير صالح", 400);
  }

  if (!Array.isArray(body.rows) || body.rows.length === 0) {
    return errorResponse("الكشف بلا سطور", 400);
  }
  if (body.rows.length > 1000) {
    return errorResponse("الكشف أكبر من الحد (1000 سطر)", 400);
  }

  const dryRun = body.dryRun === true;

  const adminClient = createClient(supabaseUrl, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const skipped: { reference: string; reason: string }[] = [];
  let matched = 0;
  let transferred = 0;
  let posted = 0;

  for (const raw of body.rows as StatementRow[]) {
    const reference = Number(raw.reference);
    const amount = Number(raw.amount);
    const label = String(raw.reference ?? "");

    if (!Number.isFinite(reference) || !Number.isFinite(amount) || amount <= 0) {
      skipped.push({ reference: label, reason: "سطر غير صالح" });
      continue;
    }

    const { data: payment, error: findError } = await adminClient
      .from("payment_requests")
      .select("id, amount, status")
      .eq("no", reference)
      .maybeSingle();

    if (findError) {
      skipped.push({ reference: label, reason: "تعذّرت قراءة طلب الدفع" });
      continue;
    }
    if (payment === null) {
      skipped.push({ reference: label, reason: "لا يوجد طلب دفع بهذا الرقم" });
      continue;
    }
    if (Math.abs(Number(payment.amount) - amount) > AMOUNT_TOLERANCE) {
      skipped.push({
        reference: label,
        reason: `القيمة لا تطابق طلب الدفع (${payment.amount})`,
      });
      continue;
    }

    matched += 1;

    if (payment.status === "transferred") {
      skipped.push({ reference: label, reason: "محوَّل سلفًا — لا يُرحَّل مرتين" });
      continue;
    }
    if (dryRun) {
      continue;
    }

    const transferredAt =
      typeof raw.transferredAt === "string" && raw.transferredAt !== ""
        ? raw.transferredAt
        : new Date().toISOString();

    // شرط الحالة يمنع سباقًا مع تحويل يدوي جارٍ في الوقت نفسه
    const { data: updated, error: updateError } = await adminClient
      .from("payment_requests")
      .update({ status: "transferred", transferred_at: transferredAt })
      .eq("id", payment.id)
      .neq("status", "transferred")
      .select("id")
      .maybeSingle();

    if (updateError || updated === null) {
      skipped.push({ reference: label, reason: "تعذّر تسجيل التحويل" });
      continue;
    }

    transferred += 1;

    const { error: postError } = await adminClient.rpc("post_accounting_entry", {
      p_source_type: "payment_transfer",
      p_source_id: payment.id,
    });

    if (postError) {
      skipped.push({
        reference: label,
        reason: `حُوِّل ولم يُرحَّل: ${postError.message}`,
      });
      continue;
    }

    posted += 1;
  }

  return jsonResponse({ matched, transferred, posted, skipped });
});
