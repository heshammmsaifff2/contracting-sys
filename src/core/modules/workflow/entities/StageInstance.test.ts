import { describe, expect, it } from "vitest";
import { Assignment, type AssignmentStatus } from "./Assignment";
import { StageInstance, type StageInstanceProps } from "./StageInstance";

function assignment(
  id: string,
  status: AssignmentStatus,
  isOptional = false,
): Assignment {
  return Assignment.restore({
    id,
    stageInstanceId: "si1",
    transactionId: "t1",
    assigneeId: id,
    assigneeName: id,
    isOptional,
    allocatedMinutes: 240,
    arrivedAt: new Date("2026-01-04T09:00:00Z"),
    receivedAt: null,
    claimedAt: null,
    completedAt: status === "done" ? new Date("2026-01-04T10:00:00Z") : null,
    status,
    score: status === "done" ? 75 : null,
    notes: "",
    managerNote: "",
    elapsedMinutes: 60,
    dueAt: null,
  });
}

function stage(over: Partial<StageInstanceProps>): StageInstance {
  return StageInstance.restore({
    id: "si1",
    transactionId: "t1",
    stageKey: "review",
    name: "مراجعة",
    seq: 1,
    status: "in_progress",
    completionPolicy: "all",
    quorumCount: null,
    isFinal: false,
    isArchive: false,
    requiresReceive: false,
    enteredAt: new Date("2026-01-04T09:00:00Z"),
    completedAt: null,
    assignments: [],
    ...over,
  });
}

describe("StageInstance — سياسة «الكل»", () => {
  it("لا تُغلق حتى ينجز كل المشاركين", () => {
    const s = stage({
      assignments: [assignment("u1", "done"), assignment("u2", "in_progress")],
    });

    expect(s.participantsCount).toBe(2);
    expect(s.doneCount).toBe(1);
    expect(s.isPolicySatisfied).toBe(false);
    expect(s.remainingToClose).toBe(1);
  });

  it("تُغلق حين ينجز الجميع", () => {
    const s = stage({
      assignments: [assignment("u1", "done"), assignment("u2", "done")],
    });

    expect(s.isPolicySatisfied).toBe(true);
    expect(s.remainingToClose).toBe(0);
  });

  it("المشارك الاختياري لا يمنع الإغلاق", () => {
    const s = stage({
      assignments: [assignment("u1", "done"), assignment("u2", "in_progress", true)],
    });

    expect(s.requiredCount).toBe(1);
    expect(s.isPolicySatisfied).toBe(true);
  });

  it("إنجاز الاختياري وحده لا يُغلق مرحلة عليها إلزاميّان", () => {
    const s = stage({
      assignments: [
        assignment("u1", "in_progress"),
        assignment("u2", "in_progress"),
        assignment("u3", "done", true),
      ],
    });

    expect(s.doneCount).toBe(1);
    expect(s.doneRequiredCount).toBe(0);
    expect(s.isPolicySatisfied).toBe(false);
  });

  it("الملغى لا يُحتسب في المطلوب", () => {
    const s = stage({
      assignments: [assignment("u1", "done"), assignment("u2", "cancelled")],
    });

    expect(s.requiredCount).toBe(1);
    expect(s.isPolicySatisfied).toBe(true);
  });
});

describe("StageInstance — سياسة «أوّلهم»", () => {
  it("أوّل منجِز يكفي", () => {
    const s = stage({
      completionPolicy: "any",
      assignments: [assignment("u1", "done"), assignment("u2", "in_progress")],
    });

    expect(s.isPolicySatisfied).toBe(true);
    expect(s.remainingToClose).toBe(0);
  });

  it("بلا منجِز لا تُغلق", () => {
    const s = stage({
      completionPolicy: "any",
      assignments: [assignment("u1", "in_progress"), assignment("u2", "in_progress")],
    });

    expect(s.isPolicySatisfied).toBe(false);
    expect(s.remainingToClose).toBe(1);
  });
});

describe("StageInstance — سياسة النصاب", () => {
  it("تُغلق ببلوغ العدد لا قبله", () => {
    const two = [assignment("u1", "done"), assignment("u2", "in_progress")];
    const three = [...two, assignment("u3", "done")];

    expect(
      stage({ completionPolicy: "quorum", quorumCount: 2, assignments: two })
        .isPolicySatisfied,
    ).toBe(false);
    expect(
      stage({ completionPolicy: "quorum", quorumCount: 2, assignments: three })
        .isPolicySatisfied,
    ).toBe(true);
  });

  it("النصاب يحتسب الاختياري", () => {
    const s = stage({
      completionPolicy: "quorum",
      quorumCount: 2,
      assignments: [assignment("u1", "done"), assignment("u2", "done", true)],
    });

    expect(s.isPolicySatisfied).toBe(true);
  });
});

describe("StageInstance — حالة المرحلة", () => {
  it("بلا مشارك مؤهَّل ⇒ معلَّقة تنتظر تدخّلًا", () => {
    const s = stage({ status: "pending", assignments: [] });

    expect(s.isUnassigned).toBe(true);
    expect(s.isOpen).toBe(true);
  });

  it("متوسّط الدرجات عبر المشاركين لا درجة واحدة", () => {
    const s = stage({
      assignments: [assignment("u1", "done"), assignment("u2", "done")],
    });

    expect(s.averageScore).toBe(75);
    expect(s.assignmentFor("u2")?.id).toBe("u2");
    expect(s.assignmentFor("nobody")).toBeNull();
  });

  it("تحصي من ينتظر تحديد مدّته", () => {
    const waiting = Assignment.restore({
      ...assignment("u3", "in_progress"),
      id: "u3",
      stageInstanceId: "si1",
      transactionId: "t1",
      assigneeId: "u3",
      assigneeName: "u3",
      isOptional: false,
      allocatedMinutes: null,
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
    });
    const s = stage({ assignments: [assignment("u1", "done"), waiting] });

    expect(s.awaitingDurationCount).toBe(1);
  });
});
