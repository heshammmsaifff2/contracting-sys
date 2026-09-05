import { describe, expect, it } from "vitest";
import { Assignment, type AssignmentProps } from "./Assignment";

function assignment(over: Partial<AssignmentProps>): Assignment {
  return Assignment.restore({
    id: "a1",
    stageInstanceId: "si1",
    transactionId: "t1",
    assigneeId: "u1",
    assigneeName: "موظف",
    isOptional: false,
    allocatedMinutes: 240,
    arrivedAt: new Date("2026-01-04T09:00:00Z"),
    receivedAt: null,
    claimedAt: null,
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

describe("Assignment — ألوان صندوق الوارد [المراسلات 25]", () => {
  it("منجَزة ⇒ أخضر مهما كانت النسبة", () => {
    expect(Assignment.colorFor("done", 5)).toBe("success");
    expect(Assignment.colorFor("done", 0.1)).toBe("success");
  });

  it("انتهت المدة ⇒ أحمر", () => {
    expect(Assignment.colorFor("in_progress", 1)).toBe("danger");
    expect(Assignment.colorFor("in_progress", 2.5)).toBe("danger");
  });

  it("مرّ 75٪ ⇒ أصفر", () => {
    expect(Assignment.colorFor("in_progress", 0.75)).toBe("warning");
    expect(Assignment.colorFor("in_progress", 0.99)).toBe("warning");
  });

  it("مرّ نصف المدة ⇒ أزرق", () => {
    expect(Assignment.colorFor("in_progress", 0.5)).toBe("info");
    expect(Assignment.colorFor("in_progress", 0.74)).toBe("info");
  });

  it("قبل نصف المدة ⇒ محايد", () => {
    expect(Assignment.colorFor("in_progress", 0.49)).toBe("neutral");
    expect(Assignment.colorFor("in_progress", 0)).toBe("neutral");
  });

  it("بلا مدة محدَّدة ⇒ محايد", () => {
    expect(Assignment.colorFor("in_progress", null)).toBe("neutral");
  });
});

describe("Assignment — العدّاد والمدة", () => {
  it("يحسب النسبة والمتبقّي من الزمن المستهلك", () => {
    const a = assignment({ allocatedMinutes: 240, elapsedMinutes: 120 });

    expect(a.elapsedRatio).toBe(0.5);
    expect(a.remainingMinutes).toBe(120);
    expect(a.color).toBe("info");
    expect(a.isOverdue).toBe(false);
  });

  it("تجاوز المدة يجعل المتبقّي سالبًا ويعلن التأخّر", () => {
    const a = assignment({ allocatedMinutes: 100, elapsedMinutes: 150 });

    expect(a.remainingMinutes).toBe(-50);
    expect(a.isOverdue).toBe(true);
    expect(a.color).toBe("danger");
  });

  it("المنجَز لا يُعدّ متأخّرًا ولو تجاوز مدّته", () => {
    const a = assignment({
      status: "done",
      allocatedMinutes: 100,
      elapsedMinutes: 500,
    });

    expect(a.isOverdue).toBe(false);
    expect(a.color).toBe("success");
  });

  it("بلا مدة ⇒ بانتظار مدير البرنامج ولا عدّاد", () => {
    const a = assignment({ allocatedMinutes: null });

    expect(a.isAwaitingDuration).toBe(true);
    expect(a.elapsedRatio).toBeNull();
    expect(a.remainingMinutes).toBeNull();
  });
});

describe("Assignment — من يُنجز التكليف", () => {
  it("صاحب التكليف يُنجزه", () => {
    expect(assignment({}).canBeCompletedBy("u1", false)).toBe(true);
  });

  it("غيره لا يُنجزه إلا بصلاحية التجاوز", () => {
    expect(assignment({}).canBeCompletedBy("u2", false)).toBe(false);
    expect(assignment({}).canBeCompletedBy("u2", true)).toBe(true);
  });

  it("لا إنجاز قبل تحديد المدة", () => {
    expect(assignment({ allocatedMinutes: null }).canBeCompletedBy("u1", true)).toBe(
      false,
    );
  });

  it("لا إنجاز لتكليف منتهٍ", () => {
    expect(assignment({ status: "done" }).canBeCompletedBy("u1", true)).toBe(false);
  });

  it("مرحلة تشترط الاستلام: لا إنجاز قبل الضغط على «استلام»", () => {
    expect(assignment({}).canBeCompletedBy("u1", false, true)).toBe(false);
    expect(
      assignment({ receivedAt: new Date("2026-01-04T09:05:00Z") }).canBeCompletedBy(
        "u1",
        false,
        true,
      ),
    ).toBe(true);
  });
});
