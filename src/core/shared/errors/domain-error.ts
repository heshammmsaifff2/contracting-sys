/**
 * أخطاء الدومين — تُصنَّف بـ code ثابت ليمكن ترجمتها في الواجهة،
 * وتحمل details اختيارية للسياق. لا تُرمى، بل تُعاد داخل Result.
 */
export type DomainErrorCode =
  | "VALIDATION"
  | "NOT_FOUND"
  | "CONFLICT"
  | "FORBIDDEN"
  | "UNAUTHENTICATED"
  | "INFRASTRUCTURE"
  | "UNEXPECTED";

export class DomainError extends Error {
  readonly code: DomainErrorCode;
  readonly details: Readonly<Record<string, unknown>>;

  constructor(
    code: DomainErrorCode,
    message: string,
    details: Record<string, unknown> = {},
  ) {
    super(message);
    this.name = "DomainError";
    this.code = code;
    this.details = details;
  }
}

export class ValidationError extends DomainError {
  /** field -> رسالة الخطأ */
  readonly fields: Readonly<Record<string, string>>;

  constructor(message: string, fields: Record<string, string> = {}) {
    super("VALIDATION", message, { fields });
    this.name = "ValidationError";
    this.fields = fields;
  }
}

export class NotFoundError extends DomainError {
  constructor(entity: string, id: string) {
    super("NOT_FOUND", `${entity} غير موجود: ${id}`, { entity, id });
    this.name = "NotFoundError";
  }
}

export class ConflictError extends DomainError {
  constructor(message: string, details: Record<string, unknown> = {}) {
    super("CONFLICT", message, details);
    this.name = "ConflictError";
  }
}

/** يُستخدم عند خرق قاعدة الصلاحيات أو قاعدة «المشروع غير المعتمد». */
export class ForbiddenError extends DomainError {
  constructor(message: string, details: Record<string, unknown> = {}) {
    super("FORBIDDEN", message, details);
    this.name = "ForbiddenError";
  }
}

/** أخطاء الحدود الخارجية (Supabase / Cloudinary / الشبكة). */
export class InfrastructureError extends DomainError {
  constructor(message: string, details: Record<string, unknown> = {}) {
    super("INFRASTRUCTURE", message, details);
    this.name = "InfrastructureError";
  }
}

/** Normalize any thrown value into a DomainError at a layer boundary. */
export function toDomainError(
  e: unknown,
  fallbackMessage = "حدث خطأ غير متوقّع",
): DomainError {
  if (e instanceof DomainError) return e;
  if (e instanceof Error)
    return new DomainError("UNEXPECTED", e.message || fallbackMessage);
  return new DomainError("UNEXPECTED", fallbackMessage, { raw: e });
}
