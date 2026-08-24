/**
 * تحويل أخطاء Postgres/PostgREST إلى DomainError عند حدود الطبقة،
 * فلا يتسرّب أي نوع من Supabase إلى application أو presentation.
 */
import type { PostgrestError } from "@supabase/supabase-js";
import type { DomainError } from "@core/shared/errors/domain-error";
import {
  ConflictError,
  ForbiddenError,
  InfrastructureError,
  NotFoundError,
  ValidationError,
} from "@core/shared/errors/domain-error";

/** Map a PostgREST error onto the domain error taxonomy. */
export function toDomainDbError(
  error: PostgrestError,
  context: { entity: string; id?: string },
): DomainError {
  switch (error.code) {
    // insufficient_privilege — سياسة RLS رفضت العملية
    case "42501":
      return new ForbiddenError(
        "لا تملك صلاحية لهذا الإجراء أو أن المشروع غير معتمد لك",
        { entity: context.entity, cause: error.message },
      );
    // unique_violation
    case "23505":
      return new ConflictError("القيمة مستخدَمة من قبل — الكود يجب أن يكون فريدًا", {
        entity: context.entity,
        cause: error.details,
      });
    // foreign_key_violation
    case "23503":
      return new ConflictError("لا يمكن إتمام العملية لوجود ارتباط ببيانات أخرى", {
        entity: context.entity,
        cause: error.details,
      });
    // check_violation
    case "23514":
      return new ValidationError("قيمة غير مقبولة حسب قواعد قاعدة البيانات", {
        entity: context.entity,
      });
    // no rows returned by .single()
    case "PGRST116":
      return new NotFoundError(context.entity, context.id ?? "");
    default:
      return new InfrastructureError("تعذّر تنفيذ العملية على قاعدة البيانات", {
        entity: context.entity,
        code: error.code,
        cause: error.message,
      });
  }
}
