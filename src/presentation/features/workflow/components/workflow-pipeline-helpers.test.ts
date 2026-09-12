import { describe, expect, it } from "vitest";
import type { WorkflowDefinitionDto } from "@application/modules/workflow/dtos";
import {
  conditionToItem,
  definitionToPipelineStages,
  unrepresentableConditions,
  type DefinitionShape,
} from "./workflow-pipeline-helpers";

type Stage = WorkflowDefinitionDto["stages"][number];

function stage(over: Partial<Stage> & { id: string; stageKey: string }): Stage {
  return {
    definitionId: "d1",
    name: over.stageKey,
    sortOrder: 1,
    completionPolicy: "all",
    quorumCount: null,
    isStart: false,
    isFinal: false,
    isArchive: false,
    isProgramManager: false,
    requiresReceive: false,
    slaMinutes: null,
    defaultNextStageId: null,
    defaultNextStageName: null,
    joinPolicy: "none",
    conflictPolicy: "backward_wins",
    claimPolicy: "none",
    deadlineSpec: null,
    deadlineAction: "notify",
    posX: 0,
    posY: 0,
    participants: [],
    actions: [],
    requirements: [],
    ...over,
  } as Stage;
}

// الدوالّ تقرأ المراحل وحدها، فهذا كلّ ما تحتاجه الحالة
function definition(stages: Stage[]): DefinitionShape {
  return { stages };
}

describe("conditionToItem — فكّ الشرط إلى حقوله", () => {
  it("المقارنة تُفكّ حقلًا ومعاملًا وقيمة", () => {
    expect(conditionToItem({ op: "gt", field: "amount", value: 50000 })).toEqual({
      field: "amount",
      op: "gt",
      value: "50000",
    });
  });

  it("والعضوية تُجمع قيمها بفاصلة كما يكتبها المستخدم", () => {
    expect(
      conditionToItem({ op: "in", field: "type", value: ["contract", "rental"] }),
    ).toEqual({ field: "type", op: "in", value: "contract, rental" });
  });

  it("وما لا قيمة له يُفكّ بقيمة فارغة", () => {
    expect(conditionToItem({ op: "is_not_null", field: "project_id" })).toEqual({
      field: "project_id",
      op: "is_not_null",
      value: "",
    });
  });

  /** المنشئ لا نموذج فيه للشرط المركّب، فيُعلَن عجزه بدلًا من تمثيله ناقصًا. */
  it("والمركّب يُعاد null لا شرطًا منقوصًا", () => {
    expect(
      conditionToItem({
        op: "and",
        args: [
          { op: "gt", field: "amount", value: 1 },
          { op: "is_null", field: "project_id" },
        ],
      }),
    ).toBeNull();
  });
});

describe("unrepresentableConditions — ما يسقط لو حُفِظ من المنشئ", () => {
  const compound = {
    op: "or" as const,
    args: [
      { op: "gt" as const, field: "amount", value: 10 },
      { op: "eq" as const, field: "type", value: "x" },
    ],
  };

  it("يرصد شرط جاهزية مركّبًا باسم مرحلته", () => {
    const lost = unrepresentableConditions(
      definition([
        stage({
          id: "s1",
          stageKey: "review",
          name: "المراجعة",
          requirements: [
            {
              id: "r1",
              stageId: "s1",
              kind: "condition",
              condition: compound,
              minAttachments: null,
              message: "",
              appliesTo: "advancing",
              sortOrder: 1,
            },
          ],
        }),
      ]),
    );
    expect(lost).toHaveLength(1);
    expect(lost[0]).toContain("المراجعة");
  });

  it("ويرصد وجهةً مركّبة الشرط باسم زرّها", () => {
    const lost = unrepresentableConditions(
      definition([
        stage({
          id: "s1",
          stageKey: "review",
          name: "المراجعة",
          actions: [
            {
              id: "a1",
              stageId: "s1",
              actionKey: "send",
              label: "إرسال",
              kind: "forward",
              sortOrder: 1,
              requiresNote: false,
              requiresAttachment: false,
              requiresEvaluation: false,
              returnMinutes: null,
              routes: [
                {
                  id: "rt1",
                  actionId: "a1",
                  priority: 1,
                  condition: compound,
                  targetStageId: "s1",
                  targetStageName: null,
                },
              ],
            },
          ],
        }),
      ]),
    );
    expect(lost).toHaveLength(1);
    expect(lost[0]).toContain("إرسال");
  });

  it("ولا يرصد شيئًا حين كل الشروط بسيطة", () => {
    expect(
      unrepresentableConditions(definition([stage({ id: "s1", stageKey: "review" })])),
    ).toHaveLength(0);
  });
});

describe("definitionToPipelineStages — المسار المحفوظ إلى شكل المنشئ", () => {
  it("يفكّ المهلة إلى ساعات ودقائق", () => {
    const [first] = definitionToPipelineStages(
      definition([stage({ id: "s1", stageKey: "a", slaMinutes: 500 })]),
    );
    expect(first?.slaHours).toBe(8);
    expect(first?.slaMinutes).toBe(20);
  });

  it("ويصف الوجهات بمفاتيح المراحل لا بمعرّفاتها", () => {
    const stages = definitionToPipelineStages(
      definition([
        stage({
          id: "s1",
          stageKey: "draft",
          sortOrder: 1,
          actions: [
            {
              id: "a1",
              stageId: "s1",
              actionKey: "send",
              label: "إرسال",
              kind: "forward",
              sortOrder: 1,
              requiresNote: false,
              requiresAttachment: false,
              requiresEvaluation: false,
              returnMinutes: null,
              routes: [
                {
                  id: "rt1",
                  actionId: "a1",
                  priority: 1,
                  condition: null,
                  targetStageId: "s2",
                  targetStageName: null,
                },
              ],
            },
          ],
        }),
        stage({ id: "s2", stageKey: "review", sortOrder: 2 }),
      ]),
    );
    expect(stages[0]?.actions[0]?.routes[0]?.targetStageKey).toBe("review");
  });

  it("ويحمل علامة الأرشيف كما هي لا كما يوحي الموضع", () => {
    const stages = definitionToPipelineStages(
      definition([
        stage({ id: "s1", stageKey: "a", sortOrder: 1 }),
        stage({ id: "s2", stageKey: "b", sortOrder: 2, isFinal: true }),
      ]),
    );
    expect(stages[1]?.isArchive).toBe(false);
  });
});
