import { describe, expect, it } from "vitest";
import { andThen, combine, err, isErr, isOk, map, ok, unwrapOr } from "./result";
import { ValidationError } from "./errors/domain-error";

describe("Result", () => {
  it("يميّز النجاح من الفشل", () => {
    expect(isOk(ok(1))).toBe(true);
    expect(isErr(err(new ValidationError("خطأ")))).toBe(true);
  });

  it("map يعمل على النجاح فقط", () => {
    expect(map(ok(2), (n) => n * 3)).toEqual({ ok: true, value: 6 });

    const failure = err(new ValidationError("خطأ"));
    expect(map(failure, (n: number) => n * 3)).toBe(failure);
  });

  it("andThen يوقف السلسلة عند أول خطأ", () => {
    const failure = err(new ValidationError("توقّف"));
    const result = andThen(failure, (n: number) => ok(n + 1));
    expect(result.ok).toBe(false);
  });

  it("combine يُعيد أول خطأ أو كل القيم", () => {
    expect(combine([ok(1), ok(2)])).toEqual({ ok: true, value: [1, 2] });
    expect(combine([ok(1), err(new ValidationError("x"))]).ok).toBe(false);
  });

  it("unwrapOr يستخدم البديل عند الفشل", () => {
    expect(unwrapOr(err(new ValidationError("x")), 42)).toBe(42);
  });
});
