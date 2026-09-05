import { describe, expect, it } from "vitest";
import {
  describeAudience,
  describeSchedule,
  validateAudience,
  validateScheduleSpec,
} from "./ScheduledTask";

describe("ScheduledTask — الجمهور", () => {
  it("الشركة كلها لا تحتاج معرّفات", () => {
    expect(validateAudience({ scope: "company" }).ok).toBe(true);
  });

  it("ما عدا الشركة يحتاج قائمة غير فارغة", () => {
    expect(validateAudience({ scope: "role" }).ok).toBe(false);
    expect(validateAudience({ scope: "role", ids: [] }).ok).toBe(false);
    expect(validateAudience({ scope: "role", ids: ["r1"] }).ok).toBe(true);
  });

  it("يرفض نطاقًا غير معروف", () => {
    expect(validateAudience({ scope: "everyone" as never, ids: ["x"] }).ok).toBe(false);
  });

  it("يصف الجمهور بأسماء لا معرّفات", () => {
    expect(describeAudience({ scope: "company" })).toBe("كل الشركة");
    expect(
      describeAudience(
        { scope: "role", ids: ["r1", "r2"] },
        { r1: "مهندس", r2: "محاسب" },
      ),
    ).toBe("أدوار: مهندس، محاسب");
  });

  it("يعرض المعرّف حين يغيب الاسم", () => {
    expect(describeAudience({ scope: "users", ids: ["u9"] })).toBe("موظفون: u9");
  });
});

describe("ScheduledTask — الجدولة", () => {
  it("«مرة واحدة» تحتاج لحظة صالحة", () => {
    expect(validateScheduleSpec("once", {}).ok).toBe(false);
    expect(validateScheduleSpec("once", { at: "ليس تاريخًا" }).ok).toBe(false);
    expect(validateScheduleSpec("once", { at: "2026-12-01T10:00:00+03:00" }).ok).toBe(
      true,
    );
  });

  it("الوقت بصيغة HH:MM", () => {
    expect(validateScheduleSpec("daily", { time: "09:00" }).ok).toBe(true);
    expect(validateScheduleSpec("daily", { time: "9:00" }).ok).toBe(false);
    expect(validateScheduleSpec("daily", { time: "24:00" }).ok).toBe(false);
  });

  it("الأسبوعية تحتاج يومًا واحدًا على الأقل", () => {
    expect(validateScheduleSpec("weekly", { time: "09:00" }).ok).toBe(false);
    expect(validateScheduleSpec("weekly", { time: "09:00", days: [] }).ok).toBe(false);
    expect(validateScheduleSpec("weekly", { time: "09:00", days: [0, 4] }).ok).toBe(
      true,
    );
  });

  it("يوم الأسبوع بين صفر وستة", () => {
    expect(validateScheduleSpec("weekly", { days: [7] }).ok).toBe(false);
    expect(validateScheduleSpec("weekly", { days: [-1] }).ok).toBe(false);
  });

  it("يوم الشهر بين 1 و28 — فبراير لا يحتمل 31", () => {
    expect(validateScheduleSpec("monthly", { day_of_month: 28 }).ok).toBe(true);
    expect(validateScheduleSpec("monthly", { day_of_month: 29 }).ok).toBe(false);
    expect(validateScheduleSpec("quarterly", { day_of_month: 0 }).ok).toBe(false);
  });

  it("السنوية تتحقّق من الشهر واليوم", () => {
    expect(validateScheduleSpec("yearly", { month: 1, day: 1 }).ok).toBe(true);
    expect(validateScheduleSpec("yearly", { month: 13, day: 1 }).ok).toBe(false);
    expect(validateScheduleSpec("yearly", { month: 1, day: 31 }).ok).toBe(false);
  });

  it("يرفض نوع جدولة خارج القائمة — cron ليس منها", () => {
    expect(validateScheduleSpec("cron" as never, {}).ok).toBe(false);
  });
});

describe("ScheduledTask — الوصف بالعربية", () => {
  it("يصف اليومية والأسبوعية والشهرية", () => {
    expect(describeSchedule("daily", { time: "08:30" })).toBe("كل يوم الساعة 08:30");
    expect(describeSchedule("weekly", { time: "14:00", days: [0, 4] })).toBe(
      "كل أسبوع: الأحد، الخميس الساعة 14:00",
    );
    expect(describeSchedule("monthly", { time: "08:00", day_of_month: 1 })).toBe(
      "كل شهر يوم 1 الساعة 08:00",
    );
  });

  it("يذكر الإزاحة ليوم العمل حين تكون مفعّلة", () => {
    expect(describeSchedule("daily", { time: "08:00" }, true)).toContain(
      "يُزاح لأول يوم عمل",
    );
  });

  it("«مرة واحدة» لا تُزاح — لا تكرار لها", () => {
    const text = describeSchedule("once", { at: "2026-12-01T10:00:00+03:00" }, true);
    expect(text).not.toContain("يُزاح");
  });

  it("يصف السنوية باسم الشهر", () => {
    expect(describeSchedule("yearly", { time: "08:00", month: 1, day: 1 })).toBe(
      "كل سنة 1 يناير الساعة 08:00",
    );
  });
});
