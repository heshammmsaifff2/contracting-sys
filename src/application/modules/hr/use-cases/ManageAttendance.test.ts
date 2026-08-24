import { describe, expect, it, vi } from "vitest";
import { ok } from "@core/shared/result";
import type { IAttendanceRepository } from "../ports";
import { RegisterAttendance, SuggestAttendance } from "./ManageAttendance";

const PROJECT = "11111111-0000-0000-0000-000000000001";

function makeRepo() {
  const register = vi.fn(async () => ok(2));
  const suggest = vi.fn(async () => ok([]));
  const repo: IAttendanceRepository = {
    suggest,
    list: async () => ok([]),
    register,
    settings: async () =>
      ok({
        cutoffTime: "12:00",
        dayValues: { present: 1, sick: 0.5, excused: -1, absent: -2 },
      }),
    laborDays: async () => ok([]),
    laborCost: async () => ok([]),
  };
  return { repo, register, suggest };
}

describe("RegisterAttendance — كشف اليومية", () => {
  it("يمرّر الكشف السليم إلى الخادم", async () => {
    const { repo, register } = makeRepo();

    const result = await new RegisterAttendance(repo).execute({
      projectId: PROJECT,
      workDate: "2026-08-24",
      entries: [
        { workerId: "w1", status: "present", isTemp: false, note: "" },
        { workerId: "w2", status: "excused", isTemp: false, note: "" },
      ],
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value).toBe(2);
    expect(register).toHaveBeenCalledTimes(1);
  });

  it("يرفض تكرار العامل في الكشف ولا يصل الخادم", async () => {
    const { repo, register } = makeRepo();

    const result = await new RegisterAttendance(repo).execute({
      projectId: PROJECT,
      workDate: "2026-08-24",
      entries: [
        { workerId: "w1", status: "present", isTemp: false, note: "" },
        { workerId: "w1", status: "absent", isTemp: false, note: "" },
      ],
    });

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe("VALIDATION");
    expect(register).not.toHaveBeenCalled();
  });

  it("يرفض الكشف بلا مشروع", async () => {
    const { repo, register } = makeRepo();

    const result = await new RegisterAttendance(repo).execute({
      projectId: "",
      workDate: "2026-08-24",
      entries: [{ workerId: "w1", status: "present", isTemp: false, note: "" }],
    });

    expect(result.ok).toBe(false);
    expect(register).not.toHaveBeenCalled();
  });

  it("يرفض الكشف الفارغ", async () => {
    const { repo, register } = makeRepo();

    const result = await new RegisterAttendance(repo).execute({
      projectId: PROJECT,
      workDate: "2026-08-24",
      entries: [],
    });

    expect(result.ok).toBe(false);
    expect(register).not.toHaveBeenCalled();
  });
});

describe("SuggestAttendance — اقتراح أسماء الأمس [2]", () => {
  it("يطلب اقتراح المشروع لليوم المحدّد", async () => {
    const { repo, suggest } = makeRepo();

    const result = await new SuggestAttendance(repo).execute({
      projectId: PROJECT,
      workDate: "2026-08-24",
    });

    expect(result.ok).toBe(true);
    expect(suggest).toHaveBeenCalledWith(PROJECT, "2026-08-24");
  });

  it("لا اقتراح بلا مشروع", async () => {
    const { repo, suggest } = makeRepo();

    const result = await new SuggestAttendance(repo).execute({
      projectId: "",
      workDate: "2026-08-24",
    });

    expect(result.ok).toBe(false);
    expect(suggest).not.toHaveBeenCalled();
  });
});
