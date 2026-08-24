/**
 * sign-cloudinary-upload
 * تُصدر توقيعًا مؤقّتًا يسمح للمتصفّح برفع ملف مباشرة إلى Cloudinary،
 * دون أن يرى api_secret إطلاقًا.
 *
 * الطلب : { folder: string, authenticated?: boolean }
 * الردّ  : { signature, timestamp, apiKey, cloudName, folder, type }
 */
import { corsHeaders, errorResponse, jsonResponse } from "../_shared/cors.ts";
import { requireUser } from "../_shared/auth.ts";
import { isValidFolder, readConfig, signParams } from "../_shared/cloudinary.ts";

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

  let body: { folder?: unknown; authenticated?: unknown };
  try {
    body = await req.json();
  } catch {
    return errorResponse("جسم الطلب غير صالح", 400);
  }

  if (!isValidFolder(body.folder)) {
    return errorResponse("مسار المجلّد غير صالح، يجب أن يبدأ بـ erp/", 400);
  }

  // للمستندات الحسّاسة نستخدم أصلًا خاصًّا لا يُقرأ برابط عام
  const type = body.authenticated === true ? "authenticated" : "upload";
  const timestamp = Math.floor(Date.now() / 1000);

  const signature = await signParams(
    { folder: body.folder, timestamp: String(timestamp), type },
    config.apiSecret,
  );

  return jsonResponse({
    signature,
    timestamp,
    apiKey: config.apiKey,
    cloudName: config.cloudName,
    folder: body.folder,
    type,
  });
});
