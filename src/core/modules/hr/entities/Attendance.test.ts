import { describe, expect, it } from "vitest";
import {
  isPastCutoff,
  payableDays,
  validateSheet,
  type AttendanceStatus,
  type DayValues,
} from "./Attendance";
import { laborCost, productionRatio } from "./Worker";
import { canDecide, canWithdraw, installmentAmount, validateLoanRequest } from "./Loan";

/** القيم الافتراضية في settings — الغياب يخصم [شؤون الموظفين 3]. */
const VALUES: DayValues = { present: 1, sick: 0.5, excused: -1, absent: -2 };

function day(status: AttendanceStatus) {
  return { status };
}

describe("Attendance — اليوميات المستحقّة [3]", () => {
  it("الحاضر يوم والمريض نصف يوم", () => {
    expect(payableDays([day("present"), day("present"), day("sick")], VALUES)).toBe(
      2.5,
    );
  });

  it("الغياب بإذن يخصم يومًا وبدون إذن يومين", () => {
    expect(payableDays([day("present"), day("excused")], VALUES)).toBe(0);
    expect(payableDays([day("present"), day("absent")], VALUES)).toBe(-1);
  });

  it("الشهر كله غياب بلا إذن يعطي مستحقًّا سالبًا", () => {
    expect(payableDays([day("absent"), day("absent")], VALUES)).toBe(-4);
  });

  it("القيم من الإعداد لا من الكود: تغييرها يغيّر النتيجة", () => {
    const lenient: DayValues = { present: 1, sick: 1, excused: 0, absent: -1 };
    expect(payableDays([day("present"), day("sick"), day("excused")], lenient)).toBe(2);
  });
});

describe("Attendance — حدّ وقت التسجيل [17]", () => {
  it("قبل الموعد يُسمح", () => {
    expect(isPastCutoff("12:00", new Date("2026-08-24T09:30:00"))).toBe(false);
  });

  it("بعد الموعد يُمنع", () => {
    expect(isPastCutoff("12:00", new Date("2026-08-24T12:01:00"))).toBe(true);
  });

  it("الموعد قابل للتعديل", () => {
    expect(isPastCutoff("15:00", new Date("2026-08-24T14:00:00"))).toBe(false);
  });
});

describe("Attendance — كشف اليومية", () => {
  it("يرفض الكشف الفارغ", () => {
    expect(validateSheet([]).ok).toBe(false);
  });

  it("يرفض تكرار العامل في الكشف الواحد", () => {
    const result = validateSheet([
      { workerId: "w1", status: "present" },
      { workerId: "w1", status: "absent" },
    ]);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.fields.entries).toBe("duplicate");
  });

  it("يقبل كشفًا سليمًا", () => {
    expect(
      validateSheet([
        { workerId: "w1", status: "present" },
        { workerId: "w2", status: "sick" },
      ]).ok,
    ).toBe(true);
  });
});

describe("Worker — التكلفة ومعدّل الإنتاج [10]", () => {
  it("التكلفة = المستحقّ × الأجر اليومي", () => {
    expect(laborCost(10, 350)).toBe(3500);
    expect(laborCost(2.5, 300)).toBe(750);
  });

  it("النسبة = الدخل ÷ التكلفة", () => {
    expect(productionRatio(9000, 3500)).toBeCloseTo(2.571, 3);
  });

  it("بلا تكلفة لا نسبة", () => {
    expect(productionRatio(9000, 0)).toBeNull();
  });
});

describe("Loan — الخدمة الذاتية [7]", () => {
  it("يرفض قيمة غير موجبة أو أقساطًا صفرية", () => {
    expect(validateLoanRequest({ amount: 0, installments: 1, reason: "" }).ok).toBe(
      false,
    );
    expect(validateLoanRequest({ amount: 100, installments: 0, reason: "" }).ok).toBe(
      false,
    );
  });

  it("يقبل طلبًا سليمًا", () => {
    expect(validateLoanRequest({ amount: 2000, installments: 4, reason: "" }).ok).toBe(
      true,
    );
  });

  it("لا يُبتّ في سلفة مرتين، ولا تُسحب بعد البتّ", () => {
    expect(canDecide("requested")).toBe(true);
    expect(canDecide("approved")).toBe(false);
    expect(canWithdraw("requested")).toBe(true);
    expect(canWithdraw("rejected")).toBe(false);
  });

  it("القسط = القيمة ÷ عدد الأقساط", () => {
    expect(installmentAmount(2000, 4)).toBe(500);
    expect(installmentAmount(1000, 3)).toBe(333.33);
  });
});
