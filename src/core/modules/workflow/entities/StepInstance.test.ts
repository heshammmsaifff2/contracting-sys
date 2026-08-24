import { describe, expect, it } from "vitest";
import { StepInstance, type StepInstanceProps } from "./StepInstance";

function step(over: Partial<StepInstanceProps>): StepInstance {
  return StepInstance.restore({
    id: "s1",
    transactionId: "t1",
    orderNo: 1,
    name: "مرحلة",
    assigneeId: "u1",
    assigneeName: "موظف",
    allocatedMinutes: 240,
    arrivedAt: new Date("2026-01-04T09:00:00Z"),
    completedAt: null,
    status: "in_progress",
    score: null,
    notes: "",
    managerNote: "",
    elapsedMinutes: 0,
    dueAt: null,
    ...over,
  });
}

describe("StepInstance — ألوان صندوق الوارد [المراسلات 25]", () => {
  it("منجَزة ⇒ أخضر مهما كانت النسبة", () => {
    expect(StepInstance.colorFor("done", 5)).toBe("success");
    expect(StepInstance.colorFor("done", 0.1)).toBe("success");
  });

  it("انتهت المدة ⇒ أحمر", () => {
    expect(StepInstance.colorFor("in_progress", 1)).toBe("danger");
    expect(StepInstance.colorFor("in_progress", 2.5)).toBe("danger");
  });

  it("مرّ 75٪ ⇒ أصفر", () => {
    expect(StepInstance.colorFor("in_progress", 0.75)).toBe("warning");
    expect(StepInstance.colorFor("in_progress", 0.99)).toBe("warning");
  });

  it("مرّ نصف المدة ⇒ أزرق", () => {
    expect(StepInstance.colorFor("in_progress", 0.5)).toBe("info");
    expect(StepInstance.colorFor("in_progress", 0.74)).toBe("info");
  });

  it("قبل نصف المدة ⇒ محايد", () => {
    expect(StepInstance.colorFor("in_progress", 0.49)).toBe("neutral");
    expect(StepInstance.colorFor("in_progress", 0)).toBe("neutral");
  });

  it("بلا مدة محدَّدة ⇒ محايد", () => {
    expect(StepInstance.colorFor("in_progress", null)).toBe("neutral");
  });
});

describe("StepInstance — العدّاد والمدة", () => {
  it("يحسب النسبة والمتبقّي من الزمن المستهلك", () => {
    const instance = step({ allocatedMinutes: 240, elapsedMinutes: 120 });

    expect(instance.elapsedRatio).toBe(0.5);
    expect(instance.remainingMinutes).toBe(120);
    expect(instance.color).toBe("info");
    expect(instance.isOverdue).toBe(false);
  });

  it("تجاوز المدة يجعل المتبقّي سالبًا ويعلن التأخّر", () => {
    const instance = step({ allocatedMinutes: 100, elapsedMinutes: 150 });

    expect(instance.remainingMinutes).toBe(-50);
    expect(instance.isOverdue).toBe(true);
    expect(instance.color).toBe("danger");
  });

  it("المنجَزة لا تُعدّ متأخّرة ولو تجاوزت مدّتها", () => {
    const instance = step({
      status: "done",
      allocatedMinutes: 100,
      elapsedMinutes: 500,
    });

    expect(instance.isOverdue).toBe(false);
    expect(instance.color).toBe("success");
  });

  it("بلا مدة ⇒ بانتظار مدير البرنامج ولا عدّاد", () => {
    const instance = step({ allocatedMinutes: null });

    expect(instance.isAwaitingDuration).toBe(true);
    expect(instance.elapsedRatio).toBeNull();
    expect(instance.remainingMinutes).toBeNull();
  });
});

describe("StepInstance — من يُنجز المرحلة", () => {
  it("صاحب المرحلة يُنجزها", () => {
    expect(step({}).canBeCompletedBy("u1", false)).toBe(true);
  });

  it("غيره لا يُنجزها إلا بصلاحية التجاوز", () => {
    expect(step({}).canBeCompletedBy("u2", false)).toBe(false);
    expect(step({}).canBeCompletedBy("u2", true)).toBe(true);
  });

  it("لا إنجاز قبل تحديد المدة", () => {
    expect(step({ allocatedMinutes: null }).canBeCompletedBy("u1", true)).toBe(false);
  });

  it("لا إنجاز لمرحلة منتهية", () => {
    expect(step({ status: "done" }).canBeCompletedBy("u1", true)).toBe(false);
  });
});
