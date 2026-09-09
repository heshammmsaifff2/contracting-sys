import { describe, expect, it } from "vitest";
import {
  canClaim,
  canDecideArchive,
  canMoveNodes,
  canPublish,
  canRelease,
  canSubmitOriginal,
  isArchivePending,
  isDefinitionEditable,
  isDefinitionLive,
  isHeldByColleague,
  publishBlockers,
  requirementAppliesTo,
  type ClaimState,
  type PublishCandidateStage,
} from "./WorkflowGovernance";

function stage(over: Partial<PublishCandidateStage> = {}): PublishCandidateStage {
  return {
    name: "مرحلة",
    isStart: false,
    isFinal: false,
    participants: [{}],
    actions: [],
    ...over,
  };
}

describe("WorkflowGovernance — الإصدار", () => {
  it("المسودّة وحدها تُعدَّل", () => {
    expect(isDefinitionEditable("draft")).toBe(true);
    expect(isDefinitionEditable("published")).toBe(false);
    expect(isDefinitionEditable("retired")).toBe(false);
  });

  it("الموضع يُحرَّك في كل إصدار — عرضٌ لا تعريف", () => {
    expect(canMoveNodes("draft")).toBe(true);
    expect(canMoveNodes("published")).toBe(true);
    // والمتقاعد هو الأحوج: خريطته هي ما يُقرأ حين يُراجَع أثرٌ قديم
    expect(canMoveNodes("retired")).toBe(true);
  });

  it("الحيّ هو المنشور النشط وحده", () => {
    expect(isDefinitionLive("published", true)).toBe(true);
    expect(isDefinitionLive("published", false)).toBe(false);
    expect(isDefinitionLive("draft", true)).toBe(false);
  });
});

describe("WorkflowGovernance — موانع النشر", () => {
  const healthy: PublishCandidateStage[] = [
    stage({
      name: "الإعداد",
      isStart: true,
      actions: [{ label: "إرسال", kind: "forward", routes: [{}] }],
    }),
    stage({ name: "الأرشفة", isFinal: true }),
  ];

  it("المسار السليم يُنشَر", () => {
    expect(canPublish(healthy)).toBe(true);
    expect(publishBlockers(healthy)).toHaveLength(0);
  });

  it("المسار الفارغ لا يُنشَر", () => {
    expect(canPublish([])).toBe(false);
  });

  it("يرصد غياب البداية والنهاية", () => {
    const codes = publishBlockers([stage()]).map((b) => b.code);
    expect(codes).toContain("no_start");
    expect(codes).toContain("no_final");
  });

  /** النهائية تُفتَح كغيرها، وبلا مؤهَّل تقف فلا تُغلق المعاملة. */
  it("يمنع النشر لكل مرحلة بلا مشاركين، والنهائية منها", () => {
    const blocks = publishBlockers([
      stage({ name: "بلا أحد", isStart: true, participants: [] }),
      stage({ name: "النهاية", isFinal: true, participants: [] }),
    ]).filter((b) => b.code === "stage_without_participants");
    expect(blocks.map((b) => b.subject).sort()).toEqual(["النهاية", "بلا أحد"].sort());
  });

  it("يرصد الزرّ بلا وجهة، ويعفي الملاحظة والإغلاق النهائي", () => {
    const blocks = publishBlockers([
      stage({
        isStart: true,
        actions: [
          { label: "معلَّق", kind: "forward", routes: [] },
          { label: "ملاحظة", kind: "note", routes: [] },
          { label: "إنهاء", kind: "final", routes: [] },
        ],
      }),
      stage({ isFinal: true }),
    ]).filter((b) => b.code === "action_without_route");
    expect(blocks).toHaveLength(1);
    expect(blocks[0]?.subject).toBe("معلَّق");
  });
});

describe("WorkflowGovernance — الحجز", () => {
  const base: ClaimState = {
    status: "in_progress",
    claimedAt: null,
    claimPolicy: "exclusive",
  };

  it("لا حجز بلا سياسة حجز", () => {
    expect(canClaim({ ...base, claimPolicy: "none" })).toBe(false);
  });

  it("يُحجَز ما كان قيد التنفيذ ولم يُحجَز", () => {
    expect(canClaim(base)).toBe(true);
    expect(canClaim({ ...base, claimedAt: new Date() })).toBe(false);
    expect(canClaim({ ...base, status: "on_hold" })).toBe(false);
  });

  it("المعلَّق محجوز عند زميل", () => {
    expect(isHeldByColleague({ ...base, status: "on_hold" })).toBe(true);
    expect(isHeldByColleague(base)).toBe(false);
  });

  it("الإطلاق لصاحبه أو لمن يملك التحويل", () => {
    const held: ClaimState = { ...base, claimedAt: new Date() };
    expect(canRelease(held, true, false)).toBe(true);
    expect(canRelease(held, false, true)).toBe(true);
    expect(canRelease(held, false, false)).toBe(false);
  });

  it("لا يُطلَق حجز تكليف أُنجز", () => {
    const done: ClaimState = { ...base, claimedAt: new Date(), status: "done" };
    expect(canRelease(done, true, true)).toBe(false);
  });
});

describe("WorkflowGovernance — الأرشفة", () => {
  it("الإيداع بعد الإغلاق ومرّة واحدة", () => {
    expect(canSubmitOriginal("none", true)).toBe(true);
    expect(canSubmitOriginal("none", false)).toBe(false);
    expect(canSubmitOriginal("submitted", true)).toBe(false);
    expect(canSubmitOriginal("archived", true)).toBe(false);
  });

  it("القبول والردّ على المُودَع وحده", () => {
    expect(canDecideArchive("submitted")).toBe(true);
    expect(canDecideArchive("none")).toBe(false);
    expect(canDecideArchive("archived")).toBe(false);
  });

  it("الطابور: كل مغلق لم يُفهرس", () => {
    expect(isArchivePending("none", true)).toBe(true);
    expect(isArchivePending("submitted", true)).toBe(true);
    expect(isArchivePending("archived", true)).toBe(false);
    expect(isArchivePending("none", false)).toBe(false);
  });
});

describe("WorkflowGovernance — نطاق شرط الجاهزية", () => {
  it("الإرجاع معفى من الشرط الافتراضي", () => {
    expect(requirementAppliesTo("advancing", "backward")).toBe(false);
    expect(requirementAppliesTo("advancing", "forward")).toBe(true);
    expect(requirementAppliesTo("advancing", "closure")).toBe(true);
  });

  it("ما عُمّم يُقاس على الإرجاع أيضًا", () => {
    expect(requirementAppliesTo("any_action", "backward")).toBe(true);
  });
});
