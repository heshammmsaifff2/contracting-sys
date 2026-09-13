import { describe, expect, it, vi } from "vitest";
import { ok, okVoid } from "@core/shared/result";
import type { IProjectAssignmentRepository } from "../ports/project-assignment-repository";
import { AssignUserToProject } from "./AssignUserToProject";
import { SetAssignmentHolder } from "./SetAssignmentHolder";

function makeRepo() {
  const repo: IProjectAssignmentRepository = {
    listByProject: async () => ok([]),
    listMembers: async () => ok([]),
    assign: vi.fn(async (input) =>
      ok({
        id: "a1",
        projectId: input.projectId,
        jobId: input.jobId,
        jobName: "مهندس",
        departmentName: null,
        userId: input.userId,
        userName: null,
        userCode: null,
        canSign: input.canSign,
      }),
    ),
    setCanSign: async () => okVoid(),
    setHolder: vi.fn(async () => okVoid()),
    remove: async () => okVoid(),
  };
  return repo;
}

describe("AssignUserToProject — خانة وظيفة على المشروع", () => {
  it("يشترط الوظيفة", async () => {
    const repo = makeRepo();
    const result = await new AssignUserToProject(repo).execute({
      projectId: "p1",
      jobId: "",
      userId: "u1",
      canSign: false,
    });
    expect(result.ok).toBe(false);
    expect(repo.assign).not.toHaveBeenCalled();
  });

  /** الشركة قد تضيف الوظيفة قبل أن تعرف من يشغلها في هذا المشروع. */
  it("يقبل الخانة شاغرةً ويطوي الشاغل الفارغ إلى null", async () => {
    const repo = makeRepo();
    const result = await new AssignUserToProject(repo).execute({
      projectId: "p1",
      jobId: "j1",
      userId: "  ",
      canSign: true,
    });
    expect(result.ok).toBe(true);
    expect(repo.assign).toHaveBeenCalledWith(
      expect.objectContaining({ jobId: "j1", userId: null, canSign: true }),
    );
  });
});

describe("SetAssignmentHolder", () => {
  it("يُفرغ الخانة حين يُمرَّر شاغلٌ فارغ", async () => {
    const repo = makeRepo();
    await new SetAssignmentHolder(repo).execute({ id: "a1", userId: "" });
    expect(repo.setHolder).toHaveBeenCalledWith("a1", null);
  });
});
