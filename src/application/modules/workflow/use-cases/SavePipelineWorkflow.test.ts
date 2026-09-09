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
});
