/**
 * التحقيق الوحيد لمنفذ IFileStorage باستخدام Cloudinary.
 * قواعد ملزِمة: api_secret لا يظهر في المتصفّح، والرفع موقّع دائمًا،
 * والحذف يمرّ عبر Edge Function.
 */
import type { DomainError } from "@core/shared/errors/domain-error";
import { InfrastructureError, toDomainError } from "@core/shared/errors/domain-error";
import { err, ok, okVoid, type Result } from "@core/shared/result";
import type {
  CreateUploadTicketInput,
  IFileStorage,
  StoredFile,
  UploadTicket,
  UploadUrlOptions,
} from "@application/shared/ports/file-storage";
import type { EdgeFnClient } from "./EdgeFnClient";

/** شكل ردّ Edge Function `sign-cloudinary-upload`. */
interface SignatureResponse {
  signature: string;
  timestamp: number;
  apiKey: string;
  cloudName: string;
  folder: string;
  type: "upload" | "authenticated";
}

/** شكل ردّ Cloudinary بعد الرفع. */
interface CloudinaryUploadResponse {
  public_id?: string;
  secure_url?: string;
  error?: { message: string };
}

export class CloudinaryFileStorage implements IFileStorage {
  private readonly edgeFn: EdgeFnClient;
  private readonly cloudName: string;

  constructor(edgeFn: EdgeFnClient, cloudName: string) {
    this.edgeFn = edgeFn;
    this.cloudName = cloudName;
  }

  async createUploadTicket(
    input: CreateUploadTicketInput,
  ): Promise<Result<UploadTicket, DomainError>> {
    const signed = await this.edgeFn.invoke<SignatureResponse>(
      "sign-cloudinary-upload",
      { folder: input.folder, authenticated: input.authenticated === true },
    );
    if (!signed.ok) return signed;

    const s = signed.value;
    return ok({
      uploadUrl: `https://api.cloudinary.com/v1_1/${s.cloudName}/auto/upload`,
      params: {
        api_key: s.apiKey,
        timestamp: String(s.timestamp),
        signature: s.signature,
        folder: s.folder,
        type: s.type,
      },
    });
  }

  async upload(
    ticket: UploadTicket,
    file: File,
  ): Promise<Result<StoredFile, DomainError>> {
    try {
      const form = new FormData();
      form.append("file", file);
      for (const [key, value] of Object.entries(ticket.params)) {
        form.append(key, value);
      }

      const response = await fetch(ticket.uploadUrl, {
        method: "POST",
        body: form,
      });
      const payload = (await response.json()) as CloudinaryUploadResponse;

      if (!response.ok || !payload.public_id || !payload.secure_url) {
        return err(
          new InfrastructureError("فشل رفع الملف", {
            status: response.status,
            cause: payload.error?.message ?? "unknown",
          }),
        );
      }

      return ok({ publicId: payload.public_id, url: payload.secure_url });
    } catch (e) {
      return err(toDomainError(e, "تعذّر الاتصال بخادم الملفّات"));
    }
  }

  buildUrl(publicId: string, opts: UploadUrlOptions = {}): string {
    const transforms: string[] = [];
    if (opts.width !== undefined) transforms.push(`w_${opts.width}`);
    if (opts.height !== undefined) transforms.push(`h_${opts.height}`);
    transforms.push(`q_${opts.quality ?? "auto"}`, "f_auto");

    const deliveryType = opts.authenticated ? "authenticated" : "upload";
    const segment = transforms.join(",");
    return `https://res.cloudinary.com/${this.cloudName}/image/${deliveryType}/${segment}/${publicId}`;
  }

  async remove(publicId: string): Promise<Result<void, DomainError>> {
    const removed = await this.edgeFn.invoke<{ result: string }>(
      "delete-cloudinary-asset",
      { publicId },
    );
    if (!removed.ok) return removed;

    if (removed.value.result !== "ok") {
      return err(
        new InfrastructureError("تعذّر حذف الملف من مزوّد التخزين", {
          publicId,
          result: removed.value.result,
        }),
      );
    }
    return okVoid();
  }
}
