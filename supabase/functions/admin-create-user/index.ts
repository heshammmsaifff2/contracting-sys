/**
 * admin-create-user
 * إنشاء مستخدم جديد. يتطلّب مفتاح service_role، لذا يتم هنا حصريًا
 * ولا يمرّ عبر المتصفّح إطلاقًا.
 *
 * التحقّق مزدوج:
 *   1) الطالب مسجّل الدخول.
 *   2) الطالب يملك صلاحية user.create — تُقرأ بدالة has_permission نفسها
 *      التي تستخدمها سياسات RLS، فلا يوجد مسار جانبي يتجاوزها.
 *   3) الوظيفة والأدوار تمنح صلاحيات، فإسنادها عند الإنشاء يتطلّب
 *      user.assign_role كما يتطلّبه تغييرها بعده.
 *
 * التصنيف والقسم لا يُرسَلان: يُشتقّان من الوظيفة بمُشغّل القاعدة.
 *
 * الطلب : { email, password, fullName, jobId?, code?, roleKeys? }
 * الردّ  : { userId }
 */
import { createClient } from "jsr:@supabase/supabase-js@2";
import { corsHeaders, errorResponse, jsonResponse } from "../_shared/cors.ts";

interface CreateUserBody {
  email?: unknown;
  password?: unknown;
  fullName?: unknown;
  jobId?: unknown;
  code?: unknown;
  roleKeys?: unknown;
}

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const MIN_PASSWORD_LENGTH = 8;

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

  // عميل بصلاحيات الطالب — لفحص الهوية والصلاحية تحت RLS
  const callerClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authHeader } },
  });

  const { data: caller, error: callerError } = await callerClient.auth.getUser();
  if (callerError || !caller.user) {
    return errorResponse("جلسة غير صالحة", 401);
  }

  const { data: allowed, error: permError } = await callerClient.rpc("has_permission", {
    permission_key: "user.create",
  });
  if (permError) {
    return errorResponse("تعذّر التحقّق من الصلاحية", 500);
  }
  if (allowed !== true) {
    return errorResponse("لا تملك صلاحية إنشاء المستخدمين", 403);
  }

  let body: CreateUserBody;
  try {
    body = await req.json();
  } catch {
    return errorResponse("جسم الطلب غير صالح", 400);
  }

  const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
  const password = typeof body.password === "string" ? body.password : "";
  const fullName = typeof body.fullName === "string" ? body.fullName.trim() : "";
  const jobId = typeof body.jobId === "string" && body.jobId !== "" ? body.jobId : null;
  const code = typeof body.code === "string" && body.code !== "" ? body.code : null;
  const roleKeys = Array.isArray(body.roleKeys)
    ? body.roleKeys.filter((key): key is string => typeof key === "string")
    : [];

  if (!EMAIL_PATTERN.test(email)) {
    return errorResponse("البريد الإلكتروني غير صالح", 400);
  }
  if (password.length < MIN_PASSWORD_LENGTH) {
    return errorResponse("كلمة المرور يجب ألا تقلّ عن 8 أحرف", 400);
  }
  if (fullName.length < 2) {
    return errorResponse("اسم الموظف مطلوب", 400);
  }
  if (jobId !== null && !UUID_PATTERN.test(jobId)) {
    return errorResponse("الوظيفة غير صالحة", 400);
  }

  if (jobId !== null || roleKeys.length > 0) {
    const { data: canAssign, error: assignError } = await callerClient.rpc(
      "has_permission",
      { permission_key: "user.assign_role" },
    );
    if (assignError) {
      return errorResponse("تعذّر التحقّق من الصلاحية", 500);
    }
    if (canAssign !== true) {
      return errorResponse(
        "إسناد الوظيفة يمنح صلاحياتها — يتطلّب صلاحية إسناد الأدوار. أضِف الموظف بلا وظيفة",
        403,
      );
    }
  }

  // عميل بصلاحيات كاملة — لا يُنشأ إلا بعد اجتياز فحص الصلاحية أعلاه
  const adminClient = createClient(supabaseUrl, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  if (jobId !== null) {
    const { data: job, error: jobError } = await adminClient
      .from("jobs")
      .select("id")
      .eq("id", jobId)
      .maybeSingle();
    if (jobError) {
      return errorResponse("تعذّر التحقّق من الوظيفة", 500);
    }
    if (!job) {
      return errorResponse("الوظيفة غير موجودة", 400);
    }
  }

  const { data: created, error: createError } = await adminClient.auth.admin.createUser(
    {
      email,
      password,
      email_confirm: true,
      // handle_new_user يقرأ job_id فيشتقّ القسم والتصنيف ويمنح دور الوظيفة
      user_metadata: {
        full_name: fullName,
        ...(jobId === null ? {} : { job_id: jobId }),
      },
    },
  );

  if (createError || !created.user) {
    const message = createError?.message ?? "تعذّر إنشاء المستخدم";
    const status = message.toLowerCase().includes("already") ? 409 : 400;
    return errorResponse(
      status === 409 ? "البريد الإلكتروني مستخدَم من قبل" : message,
      status,
    );
  }

  const userId = created.user.id;

  // المُشغِّل handle_new_user أنشأ الملف؛ نكمل الكود ومَن أنشأه
  const { error: profileError } = await adminClient
    .from("profiles")
    .update({ code, created_by: caller.user.id })
    .eq("id", userId);

  if (profileError) {
    // تراجع: لا نترك مستخدم مصادقة بلا ملف صالح
    await adminClient.auth.admin.deleteUser(userId);
    const isDuplicate = profileError.code === "23505";
    return errorResponse(
      isDuplicate ? "الكود مستخدَم من قبل" : "تعذّر حفظ بيانات الموظف",
      isDuplicate ? 409 : 500,
    );
  }

  if (roleKeys.length > 0) {
    const { data: roles } = await adminClient
      .from("roles")
      .select("id")
      .in("key", roleKeys);

    if (roles && roles.length > 0) {
      // دور الوظيفة قد يكون بينها — فالمكرّر يُتجاوز ولا يُسقط الطلب
      await adminClient.from("user_roles").upsert(
        roles.map((role: { id: string }) => ({
          user_id: userId,
          role_id: role.id,
          created_by: caller.user.id,
        })),
        { onConflict: "user_id,role_id", ignoreDuplicates: true },
      );
    }
  }

  return jsonResponse({ userId });
});
