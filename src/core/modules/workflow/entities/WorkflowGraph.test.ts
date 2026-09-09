import { describe, expect, it } from "vitest";
import {
  autoLayoutStages,
  buildWorkflowEdges,
  hasBlockingIssue,
  resolveStagePositions,
  reachableStageIds,
  stageUsesDefaultNext,
  validateWorkflowGraph,
  type GraphAction,
  type GraphStage,
} from "./WorkflowGraph";

function stage(over: Partial<GraphStage> & { id: string }): GraphStage {
  return {
    stageKey: over.id,
    name: over.id,
    isStart: false,
    isFinal: false,
    isArchive: false,
    quorumCount: null,
    defaultNextStageId: null,
    posX: 0,
    posY: 0,
    participants: [{ kind: "user" }],
    actions: [],
    ...over,
  };
}

function action(over: Partial<GraphAction> & { id: string }): GraphAction {
  return {
    actionKey: over.id,
    label: over.id,
    kind: "forward",
    routes: [],
    ...over,
  };
}

/** مسار سليم أدنى: بداية → اعتماد → نهاية، والاعتماد يرجع للبداية. */
function healthyStages(): GraphStage[] {
  return [
    stage({
      id: "draft",
      isStart: true,
      actions: [
        action({
          id: "send",
          kind: "forward",
          routes: [
            { id: "r1", priority: 10, condition: null, targetStageId: "review" },
          ],
        }),
      ],
    }),
    stage({
      id: "review",
      actions: [
        action({
          id: "approve",
          kind: "forward",
          routes: [{ id: "r2", priority: 10, condition: null, targetStageId: "done" }],
        }),
        action({
          id: "reject",
          kind: "backward",
          routes: [{ id: "r3", priority: 10, condition: null, targetStageId: "draft" }],
        }),
      ],
    }),
    stage({ id: "done", isFinal: true }),
  ];
}

describe("WorkflowGraph — الأسهم", () => {
  it("يبني سهمًا لكل وجهة زرّ", () => {
    const edges = buildWorkflowEdges(healthyStages());
    expect(edges).toHaveLength(3);
    expect(edges.filter((e) => e.kind === "backward")).toHaveLength(1);
  });

  it("الزرّ الذي لا يحمل وجهة لا يصنع سهمًا", () => {
    const edges = buildWorkflowEdges([
      stage({
        id: "a",
        isStart: true,
        isFinal: true,
        actions: [
          action({ id: "n", kind: "note" }),
          action({ id: "f", kind: "final" }),
        ],
      }),
    ]);
    expect(edges).toHaveLength(0);
  });

  it("يُسقط السهم إلى وجهة خارج المسار بدل تركه معلَّقًا", () => {
    const edges = buildWorkflowEdges([
      stage({
        id: "a",
        isStart: true,
        actions: [
          action({
            id: "go",
            routes: [
              { id: "r", priority: 10, condition: null, targetStageId: "ghost" },
            ],
          }),
        ],
      }),
    ]);
    expect(edges).toHaveLength(0);
  });

  it("يصف الشرط على السهم، ويترك الافتراضي بلا وصف", () => {
    const edges = buildWorkflowEdges([
      stage({
        id: "a",
        isStart: true,
        actions: [
          action({
            id: "go",
            routes: [
              {
                id: "r1",
                priority: 1,
                condition: { op: "gt", field: "amount", value: 50000 },
                targetStageId: "b",
              },
              { id: "r2", priority: 2, condition: null, targetStageId: "b" },
            ],
          }),
        ],
      }),
      stage({ id: "b", isFinal: true }),
    ]);
    expect(edges[0]?.conditionLabel).toContain("amount");
    expect(edges[1]?.conditionLabel).toBeNull();
  });
});

describe("WorkflowGraph — الاحتياطي الخطّي", () => {
  it("مرحلة بلا أزرار تسير بالتسلسل الخطّي", () => {
    const s = stage({ id: "a", defaultNextStageId: "b" });
    expect(stageUsesDefaultNext(s)).toBe(true);
    expect(buildWorkflowEdges([s, stage({ id: "b" })])).toHaveLength(1);
  });

  it("الملاحظة لا تحسم، فالاحتياطي يبقى عاملًا", () => {
    const s = stage({
      id: "a",
      defaultNextStageId: "b",
      actions: [action({ id: "note", kind: "note" })],
    });
    expect(stageUsesDefaultNext(s)).toBe(true);
  });

  it("مرحلة لها زرّ حاسم لا تنظر إلى الاحتياطي", () => {
    const s = stage({
      id: "a",
      defaultNextStageId: "b",
      actions: [
        action({
          id: "go",
          routes: [{ id: "r", priority: 10, condition: null, targetStageId: "b" }],
        }),
      ],
    });
    expect(stageUsesDefaultNext(s)).toBe(false);
    expect(buildWorkflowEdges([s, stage({ id: "b" })])).toHaveLength(1);
  });
});

describe("WorkflowGraph — الفحص", () => {
  it("المسار السليم بلا إشكال مانع", () => {
    const issues = validateWorkflowGraph(healthyStages());
    expect(hasBlockingIssue(issues)).toBe(false);
  });

  it("يرصد غياب البداية والنهاية", () => {
    const codes = validateWorkflowGraph([
      stage({ id: "a", defaultNextStageId: "b" }),
      stage({ id: "b" }),
    ]).map((i) => i.code);
    expect(codes).toContain("no_start");
    expect(codes).toContain("no_final");
  });

  it("يرصد الزرّ بلا وجهة", () => {
    const stages = healthyStages();
    stages[0] = stage({
      id: "draft",
      isStart: true,
      actions: [action({ id: "send", kind: "forward", routes: [] })],
    });
    const issue = validateWorkflowGraph(stages).find(
      (i) => i.code === "action_without_route",
    );
    expect(issue?.actionId).toBe("send");
  });

  it("يرصد المرحلة التي لا مخرج لها", () => {
    const codes = validateWorkflowGraph([
      stage({ id: "a", isStart: true }),
      stage({ id: "z", isFinal: true }),
    ]).map((i) => i.code);
    expect(codes).toContain("dead_end");
  });

  it("المرحلة التي فيها زرّ إغلاق نهائي ليست بلا مخرج", () => {
    const codes = validateWorkflowGraph([
      stage({
        id: "a",
        isStart: true,
        actions: [action({ id: "close", kind: "final" })],
      }),
      stage({ id: "z", isFinal: true }),
    ]).map((i) => i.code);
    expect(codes).not.toContain("dead_end");
  });

  it("يرصد المرحلة التي لا تصلها المعاملة", () => {
    const stages = healthyStages();
    stages.push(stage({ id: "orphan" }));
    const issue = validateWorkflowGraph(stages).find((i) => i.code === "unreachable");
    expect(issue?.stageId).toBe("orphan");
    expect(issue?.severity).toBe("warning");
  });

  /**
   * النهائية ليست استثناءً: المحرّك يفتحها كغيرها، وبلا مؤهَّل تقف `pending`
   * فلا تُغلق المعاملة أبدًا. أوقعني الإعفاء في مسار بذرةٍ وقف عند الأرشفة.
   */
  it("يرصد كل مرحلة بلا مشاركين، والنهائية منها", () => {
    const stages = validateWorkflowGraph([
      stage({ id: "a", isStart: true, participants: [], defaultNextStageId: "z" }),
      stage({ id: "z", isFinal: true, participants: [] }),
    ]).filter((i) => i.code === "no_participants");
    expect(stages.map((i) => i.stageId).sort()).toEqual(["a", "z"]);
  });

  it("يرصد نصابًا يفوق المشاركين المعدودين", () => {
    const codes = validateWorkflowGraph([
      stage({
        id: "a",
        isStart: true,
        isFinal: true,
        quorumCount: 3,
        participants: [{ kind: "user" }, { kind: "user" }],
      }),
    ]).map((i) => i.code);
    expect(codes).toContain("quorum_exceeds_participants");
  });

  it("لا يتّهم النصاب حين يتمدّد الدور وقت التشغيل", () => {
    const codes = validateWorkflowGraph([
      stage({
        id: "a",
        isStart: true,
        isFinal: true,
        quorumCount: 5,
        participants: [{ kind: "role" }],
      }),
    ]).map((i) => i.code);
    expect(codes).not.toContain("quorum_exceeds_participants");
  });

  /**
   * المراقب يرى ولا يُكلَّف. فمرحلةٌ ليس فيها غيره تقف بلا صاحب — ويجب أن
   * يُقال ذلك عند الفحص، لا بعد أن تقف عليها معاملة.
   */
  it("يرصد مرحلةً كلّ من فيها مراقب", () => {
    const issues = validateWorkflowGraph([
      stage({
        id: "a",
        isStart: true,
        isFinal: true,
        participants: [{ kind: "role", isObserver: true }],
      }),
    ]);
    const bad = issues.find((i) => i.code === "no_participants");
    expect(bad?.detail).toContain("مراقبين فقط");
  });

  it("ولا يرصدها إن كان معه عاملٌ واحد", () => {
    const codes = validateWorkflowGraph([
      stage({
        id: "a",
        isStart: true,
        isFinal: true,
        participants: [{ kind: "role", isObserver: true }, { kind: "user" }],
      }),
    ]).map((i) => i.code);
    expect(codes).not.toContain("no_participants");
  });

  /** والمراقب لا يُحتسب في النصاب كذلك — لأنه لا يتصرّف. */
  it("لا يحتسب المراقب في النصاب", () => {
    const codes = validateWorkflowGraph([
      stage({
        id: "a",
        isStart: true,
        isFinal: true,
        quorumCount: 2,
        participants: [{ kind: "user" }, { kind: "user", isObserver: true }],
      }),
    ]).map((i) => i.code);
    expect(codes).toContain("quorum_exceeds_participants");
  });

  /**
   * `project_role` يتمدّد كذلك — إلى مسنَدي مشروع المعاملة. وعددهم لا يُعرف
   * قبل التشغيل، فاتّهامه بتجاوز النصاب حكمٌ على غيب.
   */
  it("ولا حين يتمدّد الدور داخل المشروع", () => {
    const codes = validateWorkflowGraph([
      stage({
        id: "a",
        isStart: true,
        isFinal: true,
        quorumCount: 5,
        participants: [{ kind: "project_role" }],
      }),
    ]).map((i) => i.code);
    expect(codes).not.toContain("quorum_exceeds_participants");
  });

  it("دورة الإرجاع مقصودة فلا تُعدّ حلقة", () => {
    const codes = validateWorkflowGraph(healthyStages()).map((i) => i.code);
    expect(codes).not.toContain("cycle");
  });

  it("يرصد الحلقة المغلقة بين الأسهم الأمامية", () => {
    const issue = validateWorkflowGraph([
      stage({
        id: "a",
        isStart: true,
        actions: [
          action({
            id: "g1",
            routes: [{ id: "r1", priority: 1, condition: null, targetStageId: "b" }],
          }),
        ],
      }),
      stage({
        id: "b",
        actions: [
          action({
            id: "g2",
            routes: [{ id: "r2", priority: 1, condition: null, targetStageId: "a" }],
          }),
        ],
      }),
      stage({ id: "z", isFinal: true, participants: [] }),
    ]).find((i) => i.code === "cycle");
    expect(issue).toBeDefined();
    expect(issue?.detail).toContain("←");
  });

  it("المسار الفارغ لا يُتّهم بشيء", () => {
    expect(validateWorkflowGraph([])).toHaveLength(0);
  });
});

describe("WorkflowGraph — الوصول", () => {
  it("بلا مرحلة بداية لا شيء موصول", () => {
    const stages = [stage({ id: "a", defaultNextStageId: "b" }), stage({ id: "b" })];
    expect(reachableStageIds(stages, buildWorkflowEdges(stages)).size).toBe(0);
  });

  it("يتبع الأسهم من البداية", () => {
    const stages = healthyStages();
    const reached = reachableStageIds(stages, buildWorkflowEdges(stages));
    expect([...reached].sort()).toEqual(["done", "draft", "review"]);
  });
});

describe("WorkflowGraph — التخطيط التلقائي", () => {
  it("يضع كل طبقة أسفل سابقتها", () => {
    const positions = autoLayoutStages(healthyStages());
    const y = (id: string) => positions.find((p) => p.id === id)?.y ?? -1;
    expect(y("draft")).toBe(0);
    expect(y("review")).toBeGreaterThan(y("draft"));
    expect(y("done")).toBeGreaterThan(y("review"));
  });

  it("السهم الراجع لا يسحب المرحلة إلى الأعلى", () => {
    const positions = autoLayoutStages(healthyStages());
    const draft = positions.find((p) => p.id === "draft");
    expect(draft?.y).toBe(0);
  });

  it("المرحلة المعزولة تُصفّ في طبقة أخيرة لا فوق غيرها", () => {
    const stages = healthyStages();
    stages.push(stage({ id: "orphan" }));
    const positions = autoLayoutStages(stages);
    const orphan = positions.find((p) => p.id === "orphan")?.y ?? 0;
    const done = positions.find((p) => p.id === "done")?.y ?? 0;
    expect(orphan).toBeGreaterThan(done);
  });

  it("مراحل الطبقة الواحدة لا تتراكب", () => {
    const positions = autoLayoutStages([
      stage({
        id: "a",
        isStart: true,
        actions: [
          action({
            id: "split",
            routes: [
              { id: "r1", priority: 1, condition: null, targetStageId: "b" },
              { id: "r2", priority: 1, condition: null, targetStageId: "c" },
            ],
          }),
        ],
      }),
      stage({ id: "b", isFinal: true }),
      stage({ id: "c", isFinal: true }),
    ]);
    const b = positions.find((p) => p.id === "b");
    const c = positions.find((p) => p.id === "c");
    expect(b?.y).toBe(c?.y);
    expect(Math.abs((b?.x ?? 0) - (c?.x ?? 0))).toBeGreaterThanOrEqual(208);
  });

  it("لوحةٌ لم تُرسم قطّ تُخطَّط كلّها بلا تراكب", () => {
    const placed = resolveStagePositions(healthyStages());
    const spots = new Set([...placed.values()].map((p) => `${p.x},${p.y}`));
    expect(spots.size).toBe(placed.size);
  });

  it("ما رُسم يبقى في موضعه", () => {
    const drawn = healthyStages().map((s, index) =>
      index === 1 ? { ...s, posX: 40, posY: 160 } : s,
    );
    const placed = resolveStagePositions(drawn);
    expect(placed.get(drawn[1]!.id)).toEqual({ x: 40, y: 160 });
  });

  /**
   * مرحلةٌ تُضاف إلى مسارٍ مرتَّب تصل بموضع صفر. وكان التخطيط كلَّ شيء أو
   * لا شيء، فتسقط في الركن فوق غيرها ولا تُرتَّب — والبقيّة موضوعة.
   */
  it("والمُضافة حديثًا تأخذ موضعًا لا ركن اللوحة", () => {
    const drawn = healthyStages().map((s) => ({ ...s, posX: 40, posY: 160 }));
    const withNew = [...drawn, stage({ id: "fresh" })];
    const placed = resolveStagePositions(withNew);
    expect(placed.get("fresh")).not.toEqual({ x: 0, y: 0 });
  });
});
