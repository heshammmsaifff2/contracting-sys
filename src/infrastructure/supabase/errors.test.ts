import { describe, expect, it } from "vitest";
import type { PostgrestError } from "@supabase/supabase-js";
import { isRawPostgresMessage, toDomainDbError } from "./errors";

function pgError(over: Partial<PostgrestError>): PostgrestError {
  return {
    message: "",
    details: "",
    hint: "",
    code: "",
    name: "PostgrestError",
    ...over,
  } as PostgrestError;
}

const CONTEXT = { entity: "المسار" };

describe("توضيح رسائل القاعدة — ما كتبه إنسان يُعرَض", () => {
  it("رسالة دالّة المحرّك تصل كما هي", () => {
    const error = pgError({
      code: "23503",
      message: "لا يُحذف: ٥ معاملة تسير على هذا الإصدار أو سارت عليه.",
    });
    expect(toDomainDbError(error, CONTEXT).message).toBe(
      "لا يُحذف: ٥ معاملة تسير على هذا الإصدار أو سارت عليه.",
    );
  });

  it("رسالة الجاهزية تصل كما هي", () => {
    const error = pgError({
      code: "23514",
      message: "أرفق صورة المستخلص قبل الموافقة",
    });
    expect(toDomainDbError(error, CONTEXT).message).toBe(
      "أرفق صورة المستخلص قبل الموافقة",
    );
  });

  it("رفض الصلاحية الصريح يصل كما هو", () => {
    const error = pgError({
      code: "42501",
      message: "حذف المسارات يتطلّب صلاحية workflow.manage",
    });
    expect(toDomainDbError(error, CONTEXT).message).toBe(
      "حذف المسارات يتطلّب صلاحية workflow.manage",
    );
  });

  it("رمز raise الافتراضي يصل كما هو", () => {
    const error = pgError({ code: "P0001", message: "سبب الردّ مطلوب" });
    expect(toDomainDbError(error, CONTEXT).message).toBe("سبب الردّ مطلوب");
  });
});

describe("توضيح رسائل القاعدة — ما ولّده Postgres يُستبدَل", () => {
  it("خرق القيد لا يُعرَض بصيغته الإنجليزية", () => {
    const error = pgError({
      code: "23514",
      message:
        'new row for relation "workflow_stages" violates check constraint "stages_quorum_needs_count"',
    });
    const mapped = toDomainDbError(error, CONTEXT);
    expect(mapped.message).toBe("قيمة غير مقبولة حسب قواعد قاعدة البيانات");
    // النصّ الخام يبقى في السبب للتشخيص لا للعرض
    expect(JSON.stringify(mapped)).toContain("stages_quorum_needs_count");
  });

  it("خرق المفتاح الأجنبي الخام يُستبدَل", () => {
    const error = pgError({
      code: "23503",
      message:
        'update or delete on table "workflow_definitions" violates foreign key constraint "transactions_definition_id_fkey" on table "transactions"',
    });
    expect(toDomainDbError(error, CONTEXT).message).toBe(
      "لا يمكن إتمام العملية لوجود ارتباط ببيانات أخرى",
    );
  });

  it("رفض RLS الخام يُستبدَل", () => {
    const error = pgError({
      code: "42501",
      message: 'new row violates row-level security policy for table "transactions"',
    });
    expect(toDomainDbError(error, CONTEXT).message).toBe(
      "لا تملك صلاحية لهذا الإجراء أو أن المشروع غير معتمد لك",
    );
  });

  it("التكرار الخام يُستبدَل", () => {
    const error = pgError({
      code: "23505",
      message: 'duplicate key value violates unique constraint "projects_code_key"',
    });
    expect(toDomainDbError(error, CONTEXT).message).toBe(
      "القيمة مستخدَمة من قبل — الكود يجب أن يكون فريدًا",
    );
  });

  it("الرسالة الفارغة تُعامَل معاملة الخام", () => {
    expect(isRawPostgresMessage("")).toBe(true);
    expect(isRawPostgresMessage(null)).toBe(true);
    expect(isRawPostgresMessage(undefined)).toBe(true);
    expect(toDomainDbError(pgError({ code: "23514" }), CONTEXT).message).toBe(
      "قيمة غير مقبولة حسب قواعد قاعدة البيانات",
    );
  });
});

describe("توضيح رسائل القاعدة — ما لم يتغيّر", () => {
  it("انعدام الصفّ يبقى NotFound", () => {
    const mapped = toDomainDbError(pgError({ code: "PGRST116" }), {
      entity: "المعاملة",
      id: "abc",
    });
    expect(mapped.message).toContain("المعاملة");
  });

  /** `P0002` هو رمز plpgsql لـ `no_data_found`، لا `02000`. */
  it("رسالة الدالّة تُحفَظ حين لا يوجد ما طُلب", () => {
    const mapped = toDomainDbError(
      pgError({ code: "P0002", message: "إجراء غير معروف لهذه المرحلة: nope" }),
      { entity: "الإجراء", id: "" },
    );
    expect(mapped.message).toBe("إجراء غير معروف لهذه المرحلة: nope");
  });

  it("وبلا رسالة تعود الصيغة العامّة", () => {
    const mapped = toDomainDbError(pgError({ code: "P0002" }), {
      entity: "المسار",
      id: "xyz",
    });
    expect(mapped.message).toBe("المسار غير موجود: xyz");
  });
});
