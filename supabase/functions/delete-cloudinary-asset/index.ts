/**
 * delete-cloudinary-asset
 * حذف أصل من Cloudinary. الحذف لا يتم من المتصفّح لأنه يتطلّب api_secret.
 *
 * الطلب : { publicId: string }
 * الردّ  : { result: "ok" | "not found" | ... }
 *
 * TODO(Phase 1): إضافة تحقّق من صلاحية `file.delete` وربط الأصل بالمشروع
 * المعتمد للمستخدم قبل السماح بالحذف.
 */
import { corsHeaders, errorResponse, jsonResponse } from "../_shared/cors.ts";
import { requireUser } from "../_shared/auth.ts";
import { readConfig, signParams } from "../_shared/cloudinary.ts";

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }
  if (req.method !== "POST") {
    return errorResponse("الطريقة غير مدعومة", 405);
  }

  const auth = await requireUser(req);
  if (!auth.ok) return errorResponse(auth.message, auth.status);

  const config = readConfig();
  if (!config) {
    return errorResponse("إعدادات مزوّد التخزين غير مكتملة على الخادم", 500);
  }

  let body: { publicId?: unknown };
  try {
    body = await req.json();
  } catch {
    return errorResponse("جسم الطلب غير صالح", 400);
  }

  if (typeof body.publicId !== "string" || !body.publicId.startsWith("erp/")) {
    return errorResponse("معرّف الأصل غير صالح", 400);
  }

  const timestamp = Math.floor(Date.now() / 1000);
  const signature = await signParams(
    { public_id: body.publicId, timestamp: String(timestamp) },
    config.apiSecret,
  );

  const form = new FormData();
  form.append("public_id", body.publicId);
  form.append("timestamp", String(timestamp));
  form.append("api_key", config.apiKey);
  form.append("signature", signature);

  const response = await fetch(
    `https://api.cloudinary.com/v1_1/${config.cloudName}/image/destroy`,
    { method: "POST", body: form },
  );

  if (!response.ok) {
    return errorResponse("فشل حذف الأصل من مزوّد التخزين", 502);
  }

  const payload = (await response.json()) as { result?: string };
  return jsonResponse({ result: payload.result ?? "unknown" });
});
