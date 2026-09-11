/**
 * تحويل أخطاء Postgres/PostgREST إلى DomainError عند حدود الطبقة،
 * فلا يتسرّب أي نوع من Supabase إلى application أو presentation.
 *
 * **ورسالةُ القاعدة تُحترَم.** كان هذا الملفّ يبتلع كل رسالة ويضع مكانها
 * عبارةً عامّة — فيصير «لا يُحذف: ٥ معاملات تسير على هذا الإصدار» هو
 * «لا يمكن إتمام العملية لوجود ارتباط ببيانات أخرى»، ويصير «احجز المعاملة
 * قبل إنجازها» هو «قيمة غير مقبولة». عشرات الرسائل كُتبت في دوالّ المحرّك
 * لتقول للمستخدم **ما ينقصه**، وكانت تُرمى عند آخر خطوة.
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

/**
 * هل الرسالة من Postgres نفسه أم كتبها إنسان؟
 *
 * ما يولّده Postgres لهذه الرموز له شكل معروف يذكر اسم القيد أو الجدول
 * بالإنجليزية — وهو ما لا يُعرض لمستخدم عربيّ. وما نكتبه نحن بـ
 * `raise exception '…'` جملةٌ مفهومة تقول ما العمل.
 *
 * التمييز بالشكل لا باللغة: قد نكتب يومًا رسالةً بالإنجليزية، ولا يصحّ أن
 * ينقلب معنى الفحص حينها.
 */
const RAW_POSTGRES_PATTERNS: readonly RegExp[] = [
  /violates .*constraint/i,
  /violates row-level security/i,
  /permission denied for/i,
  /duplicate key value/i,
  /null value in column/i,
  /invalid input syntax/i,
];

export function isRawPostgresMessage(message: string | null | undefined): boolean {
  if (message === null || message === undefined || message.trim() === "") {
    return true;
  }
  return RAW_POSTGRES_PATTERNS.some((pattern) => pattern.test(message));
}

/** رسالة الدالّة إن كانت مكتوبة للقارئ، وإلّا فالعبارة العامّة. */
function spoken(error: PostgrestError, fallback: string): string {
  return isRawPostgresMessage(error.message) ? fallback : error.message;
}

/** Map a PostgREST error onto the domain error taxonomy. */
export function toDomainDbError(
  error: PostgrestError,
  context: { entity: string; id?: string },
): DomainError {
  switch (error.code) {
    // insufficient_privilege — سياسة RLS رفضت العملية، أو دالّة رفضت صراحةً
    case "42501":
      return new ForbiddenError(
        spoken(error, "لا تملك صلاحية لهذا الإجراء أو أن المشروع غير معتمد لك"),
        { entity: context.entity, cause: error.message },
      );
    // unique_violation
    case "23505": {
      let msg = "القيمة مستخدَمة من قبل — الكود يجب أن يكون فريدًا";
      const fullMsg = `${error.message ?? ""} ${error.details ?? ""}`;
      if (fullMsg.includes("workflow_definitions_type_version_idx")) {
        msg = "رمز نوع المعاملة مستخدم بالفعل في مسار آخر — يجب أن يكون رمز نوع المعاملة فريدًا";
      } else if (fullMsg.includes("workflow_stages_definition_id_stage_key_key")) {
        msg = "رمز المرحلة مكرر داخل هذا المسار — يجب أن يكون لكل مرحلة رمز إنجليزي فريد";
      } else if (fullMsg.includes("workflow_definitions_one_published_idx")) {
        msg = "يوجد مسار منشور ومفعّل بالفعل لهذا النوع من المعاملات";
      }
      return new ConflictError(
        spoken(error, msg),
        { entity: context.entity, cause: error.details },
      );
    }
    // foreign_key_violation
    case "23503":
      return new ConflictError(
        spoken(error, "لا يمكن إتمام العملية لوجود ارتباط ببيانات أخرى"),
        { entity: context.entity, cause: error.details },
      );
    // check_violation — وأكثر رسائل المحرّك تأتي بهذا الرمز
    case "23514": {
      let checkMsg = "قيمة غير مقبولة حسب قواعد قاعدة البيانات";
      const full = `${error.message ?? ""} ${error.details ?? ""}`;
      if (full.includes("participant_shape")) {
        checkMsg = "بيانات المشارك غير مكتملة — يجب اختيار الدور أو الموظف المطلوب للمشارك";
      } else if (full.includes("workflow_definitions_active_only_published")) {
        checkMsg = "لا يمكن تفعيل مسار غير منشور";
      }
      return new ValidationError(
        spoken(error, checkMsg),
        // النصّ الخام يبقى للتشخيص وإن لم يُعرَض: بغيره لا يُعرف أيّ قيد خُرق
        { entity: context.entity, cause: error.message },
      );
    }
    // raise_exception — الرمز الافتراضي لـ `raise` بلا errcode
    case "P0001":
      return new ValidationError(spoken(error, "تعذّر تنفيذ العملية"), {
        entity: context.entity,
        cause: error.message,
      });
    /**
     * لم يُوجَد ما طُلب. و`P0002` هو رمز plpgsql لـ `no_data_found` —
     * لا `02000` الذي يخصّ SQL المعياريّ؛ ودوالّ المحرّك ترفع الأول.
     */
    case "P0002":
    case "02000": {
      const said = isRawPostgresMessage(error.message) ? undefined : error.message;
      return new NotFoundError(context.entity, context.id ?? "", said);
    }
    /**
     * لا صفوف من `.single()`. رسالتها من PostgREST لا من دالّة، وهي
     * إنجليزية لا تُعرَض — فتبقى الصيغة العامّة.
     */
    case "PGRST116":
      return new NotFoundError(context.entity, context.id ?? "");
    default:
      return new InfrastructureError(
        spoken(error, "تعذّر تنفيذ العملية على قاعدة البيانات"),
        { entity: context.entity, code: error.code, cause: error.message },
      );
  }
}
