import { describe, expect, it } from "vitest";
import {
  describeCondition,
  validateCondition,
  type WorkflowCondition,
} from "./WorkflowCondition";

describe("WorkflowCondition — التحقّق", () => {
  it("الشرط الفارغ صالح — وهو المسار الافتراضي", () => {
    expect(validateCondition(null).ok).toBe(true);
    expect(validateCondition(undefined).ok).toBe(true);
  });

  it("يقبل المقارنة المكتملة", () => {
    const c: WorkflowCondition = { op: "gt", field: "amount", value: 50000 };
    expect(validateCondition(c).ok).toBe(true);
  });

  it("يرفض معاملًا خارج اللغة المغلقة", () => {
    const result = validateCondition({ op: "exec", field: "a", value: 1 });
    expect(result.ok).toBe(false);
  });

  it("يرفض المقارنة بلا قيمة", () => {
    expect(validateCondition({ op: "gt", field: "amount" }).ok).toBe(false);
  });

  it("يرفض الشرط بلا حقل", () => {
    expect(validateCondition({ op: "eq", field: "  ", value: 1 }).ok).toBe(false);
  });

  it("يرفض الانتماء بلا قائمة", () => {
    expect(validateCondition({ op: "in", field: "p", value: "x" }).ok).toBe(false);
    expect(validateCondition({ op: "in", field: "p", value: [] }).ok).toBe(false);
  });

  it("«ليس» تأخذ شرطًا واحدًا لا أكثر", () => {
    const one = { op: "not", args: [{ op: "is_null", field: "a" }] };
    const two = {
      op: "not",
      args: [
        { op: "is_null", field: "a" },
        { op: "is_null", field: "b" },
      ],
    };
    expect(validateCondition(one).ok).toBe(true);
    expect(validateCondition(two).ok).toBe(false);
  });

  it("يرفض «و» بلا شروط", () => {
    expect(validateCondition({ op: "and", args: [] }).ok).toBe(false);
  });

  it("يرفض التعشيش الذي يتجاوز خمسة مستويات", () => {
    let deep: unknown = { op: "eq", field: "a", value: 1 };
    for (let i = 0; i < 6; i += 1) deep = { op: "and", args: [deep] };
    expect(validateCondition(deep).ok).toBe(false);
  });

  it("يقبل خمسة مستويات بالضبط", () => {
    let deep: unknown = { op: "eq", field: "a", value: 1 };
    for (let i = 0; i < 4; i += 1) deep = { op: "and", args: [deep] };
    expect(validateCondition(deep).ok).toBe(true);
  });

  it("يتحقّق من الشروط المتداخلة لا من الغلاف وحده", () => {
    const bad = {
      op: "and",
      args: [
        { op: "eq", field: "a", value: 1 },
        { op: "exec", field: "b", value: 2 },
      ],
    };
    expect(validateCondition(bad).ok).toBe(false);
  });
});

describe("WorkflowCondition — الوصف بالعربية", () => {
  it("يصف المسار الافتراضي", () => {
    expect(describeCondition(null)).toBe("دائمًا (المسار الافتراضي)");
  });

  it("يصف المقارنة", () => {
    expect(describeCondition({ op: "gt", field: "amount", value: 50000 })).toBe(
      "amount أكبر من 50000",
    );
  });

  it("يصف الفراغ بلا قيمة", () => {
    expect(describeCondition({ op: "is_null", field: "contractor_id" })).toBe(
      "contractor_id غير محدَّد",
    );
  });

  it("يصف الانتماء بقائمة", () => {
    expect(describeCondition({ op: "in", field: "p", value: ["a", "b"] })).toBe(
      "p ضمن a، b",
    );
  });

  it("يصف التركيب المنطقي", () => {
    expect(
      describeCondition({
        op: "and",
        args: [
          { op: "gt", field: "amount", value: 1 },
          { op: "eq", field: "type", value: "extract" },
        ],
      }),
    ).toBe("(amount أكبر من 1 و type يساوي extract)");
  });

  it("يصف النفي", () => {
    expect(
      describeCondition({ op: "not", args: [{ op: "is_null", field: "a" }] }),
    ).toBe("ليس (a غير محدَّد)");
  });
});
