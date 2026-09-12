import { describe, it, expect, vi } from "vitest";
import { ok } from "@core/shared/result";
import type { IWorkflowDefinitionRepository } from "../ports/workflow-definition-repository";
import type { WorkflowDefinitionDto } from "../dtos";
import { SavePipelineWorkflow } from "./WorkflowAdminUseCases";

describe("SavePipelineWorkflow UseCase", () => {
  const mockRepo: Partial<IWorkflowDefinitionRepository> = {
    savePipeline: vi.fn().mockResolvedValue(
      ok({
        id: "def-123",
        name: "مسار اختبار",
        transactionType: "test_tx",
        version: 1,
        status: "draft",
        lineageId: "lineage-1",
        isActive: true,
        transactionCount: 0,
        publishedAt: null,
        retiredAt: null,
        stages: [],
      } as WorkflowDefinitionDto),
    ),
  };

  const useCase = new SavePipelineWorkflow(mockRepo as IWorkflowDefinitionRepository);

  it("fails if transactionType contains invalid characters or spaces", async () => {
    const res = await useCase.execute({
      name: "مسار مراسلات",
      transactionType: "Invalid Type!",
      stages: [{ name: "مرحلة 1" }],
    });

    expect(res.ok).toBe(false);
    if (!res.ok) {
      expect(res.error.message).toContain("نوع المعاملة يقبل الحروف الإنجليزية");
    }
  });

  it("fails if workflow name is too short", async () => {
    const res = await useCase.execute({
      name: " ",
      transactionType: "valid_type",
      stages: [{ name: "مرحلة 1" }],
    });

    expect(res.ok).toBe(false);
    if (!res.ok) {
      expect(res.error.message).toContain("اسم المسار مطلوب");
    }
  });

  it("fails if stages array is empty", async () => {
    const res = await useCase.execute({
      name: "مسار فارغ",
      transactionType: "valid_type",
      stages: [],
    });

    expect(res.ok).toBe(false);
    if (!res.ok) {
      expect(res.error.message).toContain("مرحلة واحدة على الأقل");
    }
  });

  it("fails if any stage has an empty name", async () => {
    const res = await useCase.execute({
      name: "مسار سليم",
      transactionType: "valid_type",
      stages: [
        { name: "المرحلة الأولى" },
        { name: "   " },
      ],
    });

    expect(res.ok).toBe(false);
    if (!res.ok) {
      expect(res.error.message).toContain("اسم المرحلة رقم 2 مطلوب");
    }
  });

  it("delegates to repository when input is valid", async () => {
    const res = await useCase.execute({
      name: "مسار مراجعة معتمد",
      transactionType: "correspondence_review",
      stages: [
        { name: "إعداد المراسلة" },
        { name: "اعتماد مدير المشروع" },
      ],
    });

    expect(res.ok).toBe(true);
    expect(mockRepo.savePipeline).toHaveBeenCalled();
  });

  it("fails if a stage targets itself", async () => {
    const res = await useCase.execute({
      name: "مسار تكراري",
      transactionType: "self_loop",
      stages: [
        { name: "المرحلة الأولى", stageKey: "start_stage", targetStageKeys: ["start_stage"] },
      ],
    });

    expect(res.ok).toBe(false);
    if (!res.ok) {
      expect(res.error.message).toContain("لا يمكن أن توجّه إلى نفسها");
    }
  });

  it("fails if a stage targets a non-existent stage key", async () => {
    const res = await useCase.execute({
      name: "مسار بوجهة وهمية",
      transactionType: "unknown_target",
      stages: [
        { name: "المرحلة الأولى", stageKey: "start_stage", targetStageKeys: ["non_existent"] },
      ],
    });

    expect(res.ok).toBe(false);
    if (!res.ok) {
      expect(res.error.message).toContain("غير موجودة");
    }
  });

  it("allows branching with valid targetStageKeys", async () => {
    const res = await useCase.execute({
      name: "مسار متفرع توازي",
      transactionType: "fork_workflow",
      stages: [
        { name: "البداية", stageKey: "start", targetStageKeys: ["branch_a", "branch_b"] },
        { name: "الفرع أ", stageKey: "branch_a", targetStageKeys: ["archive"] },
        { name: "الفرع ب", stageKey: "branch_b", targetStageKeys: ["archive"] },
        { name: "الأرشفة", stageKey: "archive", joinPolicy: "wait_all" },
      ],
    });

    expect(res.ok).toBe(true);
  });

  it("fails if custom action has empty label", async () => {
    const res = await useCase.execute({
      name: "مسار بإجراء بلا اسم",
      transactionType: "no_label",
      stages: [
        {
          name: "المرحلة الأولى",
          stageKey: "s1",
          actions: [
            {
              actionKey: "act1",
              label: "   ",
              kind: "forward",
            },
          ],
        },
      ],
    });

    expect(res.ok).toBe(false);
    if (!res.ok) {
      expect(res.error.message).toContain("اسم الإجراء رقم 1 في المرحلة «المرحلة الأولى» مطلوب");
    }
  });

  it("fails if custom action assigns returnMinutes to a non-backward action", async () => {
    const res = await useCase.execute({
      name: "مسار غير سليم",
      transactionType: "bad_action",
      stages: [
        {
          name: "المرحلة الأولى",
          stageKey: "s1",
          actions: [
            {
              actionKey: "act_forward",
              label: "اعتماد",
              kind: "forward",
              returnMinutes: 60,
            },
          ],
        },
      ],
    });

    expect(res.ok).toBe(false);
    if (!res.ok) {
      expect(res.error.message).toContain("مدّة الإعادة تخصّ إجراء الإرجاع وحده");
    }
  });

  it("fails if custom action route targets an unknown stage key", async () => {
    const res = await useCase.execute({
      name: "مسار بوجهة مجهولة للإجراء",
      transactionType: "unknown_route",
      stages: [
        {
          name: "المرحلة الأولى",
          stageKey: "s1",
          actions: [
            {
              actionKey: "act1",
              label: "اعتماد",
              kind: "forward",
              routes: [{ targetStageKey: "non_existent_stage" }],
            },
          ],
        },
      ],
    });

    expect(res.ok).toBe(false);
    if (!res.ok) {
      expect(res.error.message).toContain("غير موجودة في هذا المسار");
    }
  });

  it("successfully passes validation with custom actions, conditions, and deadlines", async () => {
    const res = await useCase.execute({
      name: "مسار متكامل شامل",
      transactionType: "full_workflow",
      autoPublish: true,
      stages: [
        {
          name: "المرحلة الأولى",
          stageKey: "s1",
          slaMinutes: 120,
          deadlineSpec: { time: "14:00", days: [4] },
          deadlineAction: "notify",
          requirements: [
            {
              kind: "condition",
              condition: { op: "gt", field: "amount", value: 1000 },
              message: "المبلغ يجب أن يكون أكبر من 1000",
            },
          ],
          actions: [
            {
              actionKey: "approve_high",
              label: "اعتماد المبالغ الكبيرة",
              kind: "forward",
              routes: [
                {
                  targetStageKey: "s2",
                  priority: 10,
                  condition: { op: "gt", field: "amount", value: 50000 },
                },
              ],
            },
            {
              actionKey: "reject_fix",
              label: "إرجاع للتصحيح",
              kind: "backward",
              returnMinutes: 30,
              requiresNote: true,
            },
          ],
        },
        {
          name: "المرحلة الثانية",
          stageKey: "s2",
          isArchive: true,
        },
      ],
    });

    expect(res.ok).toBe(true);
  });
});
