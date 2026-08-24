import { describe, expect, it } from "vitest";
import { WorkSchedule } from "./WorkSchedule";

const BASE = {
  id: "w1",
  scope: "global" as const,
  userId: null,
  dayOfWeek: 0 as const,
  startTime: "09:00",
  endTime: "17:00",
};

describe("WorkSchedule", () => {
  it("يقبل يوم دوام صالحًا ويحسب طوله", () => {
    const schedule = WorkSchedule.create(BASE);

    expect(schedule.ok).toBe(true);
    if (!schedule.ok) return;
    expect(schedule.value.durationMinutes).toBe(480);
  });

  it("يرفض نهاية قبل البداية", () => {
    const schedule = WorkSchedule.create({
      ...BASE,
      startTime: "17:00",
      endTime: "09:00",
    });

    expect(schedule.ok).toBe(false);
    if (schedule.ok) return;
    expect(schedule.error.fields.endTime).toBe("before_start");
  });

  it("يرفض صيغة وقت غير صالحة", () => {
    expect(WorkSchedule.create({ ...BASE, startTime: "9:00" }).ok).toBe(false);
    expect(WorkSchedule.create({ ...BASE, endTime: "25:00" }).ok).toBe(false);
  });

  it("الاستثناء الفردي يحتاج موظفًا محدَّدًا", () => {
    const missingUser = WorkSchedule.create({ ...BASE, scope: "user", userId: null });
    expect(missingUser.ok).toBe(false);

    const withUser = WorkSchedule.create({ ...BASE, scope: "user", userId: "u1" });
    expect(withUser.ok).toBe(true);
  });

  it("العام لا يحمل موظفًا", () => {
    const globalWithUser = WorkSchedule.create({ ...BASE, userId: "u1" });
    expect(globalWithUser.ok).toBe(false);
  });
});
