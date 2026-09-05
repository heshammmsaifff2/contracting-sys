/**
 * لغة شروط التفريع — **مغلقة** عمدًا.
 *
 * هذه نسخة مطابقة لما يطبّقه `validate_workflow_condition` في Postgres:
 * الواجهة تمنع الشرط المعطوب قبل الحفظ، والخادم يمنعه على كل حال.
 * لا يُضاف معامل هنا إلا بتعديل docs/decisions/0001-workflow-engine-v2.md
 * ثم الدالة في القاعدة ثم هذا الملف.
 */
import { ValidationError } from "../../../shared/errors/domain-error";
import { err, okVoid, type Result } from "../../../shared/result";

export type LogicalOp = "and" | "or" | "not";
export type CompareOp = "eq" | "ne" | "gt" | "gte" | "lt" | "lte";
export type MembershipOp = "in" | "not_in";
export type NullOp = "is_null" | "is_not_null";
export type ConditionOp = LogicalOp | CompareOp | MembershipOp | NullOp;

export type ConditionValue = string | number | boolean;

export type WorkflowCondition =
  | { readonly op: LogicalOp; readonly args: readonly WorkflowCondition[] }
  | { readonly op: CompareOp; readonly field: string; readonly value: ConditionValue }
  | {
      readonly op: MembershipOp;
      readonly field: string;
      readonly value: readonly ConditionValue[];
    }
  | { readonly op: NullOp; readonly field: string };

export const LOGICAL_OPS: readonly LogicalOp[] = ["and", "or", "not"];
export const COMPARE_OPS: readonly CompareOp[] = ["eq", "ne", "gt", "gte", "lt", "lte"];
export const MEMBERSHIP_OPS: readonly MembershipOp[] = ["in", "not_in"];
export const NULL_OPS: readonly NullOp[] = ["is_null", "is_not_null"];

export const CONDITION_OPS: readonly ConditionOp[] = [
  ...LOGICAL_OPS,
  ...COMPARE_OPS,
  ...MEMBERSHIP_OPS,
  ...NULL_OPS,
];

/** أقصى عمق تعشيش — يطابق الحدّ في القاعدة. */
export const MAX_CONDITION_DEPTH = 5;

const OP_LABELS: Record<ConditionOp, string> = {
  and: "و",
  or: "أو",
  not: "ليس",
  eq: "يساوي",
  ne: "لا يساوي",
  gt: "أكبر من",
  gte: "أكبر من أو يساوي",
  lt: "أصغر من",
  lte: "أصغر من أو يساوي",
  in: "ضمن",
  not_in: "ليس ضمن",
  is_null: "غير محدَّد",
  is_not_null: "محدَّد",
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function invalid(message: string, field: string): Result<void, ValidationError> {
  return err(new ValidationError(message, { condition: field }));
}

/**
 * يتحقّق من شكل الشرط. الشرط الفارغ (null) صالح — وهو المسار الافتراضي.
 */
export function validateCondition(
  condition: unknown,
  depth = 0,
): Result<void, ValidationError> {
  if (condition === null || condition === undefined) return okVoid();

  if (depth > MAX_CONDITION_DEPTH) {
    return invalid(
      `عمق تعشيش الشرط يتجاوز الحد المسموح (${MAX_CONDITION_DEPTH})`,
      "depth",
    );
  }

  if (!isRecord(condition)) {
    return invalid("الشرط يجب أن يكون كائنًا", "shape");
  }

  const op = condition["op"];
  if (typeof op !== "string" || !CONDITION_OPS.includes(op as ConditionOp)) {
    return invalid(`معامل غير مسموح: ${String(op ?? "")}`, "op");
  }

  if (LOGICAL_OPS.includes(op as LogicalOp)) {
    const args = condition["args"];
    if (!Array.isArray(args) || args.length === 0) {
      return invalid(`المعامل ${OP_LABELS[op as ConditionOp]} يحتاج شروطًا`, "args");
    }
    if (op === "not" && args.length !== 1) {
      return invalid("المعامل «ليس» يأخذ شرطًا واحدًا", "args");
    }
    for (const arg of args) {
      const result = validateCondition(arg, depth + 1);
      if (!result.ok) return result;
    }
    return okVoid();
  }

  const field = condition["field"];
  if (typeof field !== "string" || field.trim() === "") {
    return invalid("الشرط يحتاج اسم حقل", "field");
  }

  if (NULL_OPS.includes(op as NullOp)) return okVoid();

  if (!("value" in condition)) {
    return invalid(`المعامل ${OP_LABELS[op as ConditionOp]} يحتاج قيمة`, "value");
  }

  if (MEMBERSHIP_OPS.includes(op as MembershipOp)) {
    if (!Array.isArray(condition["value"]) || condition["value"].length === 0) {
      return invalid(
        `المعامل ${OP_LABELS[op as ConditionOp]} يحتاج قائمة قيم`,
        "value",
      );
    }
  }

  return okVoid();
}

function formatValue(value: unknown): string {
  if (Array.isArray(value)) return value.map(formatValue).join("، ");
  if (typeof value === "boolean") return value ? "نعم" : "لا";
  return String(value);
}

/**
 * وصف الشرط بالعربية — تُعرض تحت المسار في المحرِّر ليعرف من يحرّره ماذا كتب.
 */
export function describeCondition(condition: unknown): string {
  if (condition === null || condition === undefined) return "دائمًا (المسار الافتراضي)";
  if (!isRecord(condition)) return "شرط غير صالح";

  const op = condition["op"] as ConditionOp | undefined;
  if (op === undefined || !CONDITION_OPS.includes(op)) return "شرط غير صالح";

  if (op === "not") {
    const args = condition["args"];
    const inner = Array.isArray(args) ? describeCondition(args[0]) : "";
    return `ليس (${inner})`;
  }

  if (op === "and" || op === "or") {
    const args = condition["args"];
    if (!Array.isArray(args)) return "شرط غير صالح";
    const joined = args.map(describeCondition).join(` ${OP_LABELS[op]} `);
    return args.length > 1 ? `(${joined})` : joined;
  }

  const field = String(condition["field"] ?? "");
  if (NULL_OPS.includes(op as NullOp)) return `${field} ${OP_LABELS[op]}`;

  return `${field} ${OP_LABELS[op]} ${formatValue(condition["value"])}`;
}
