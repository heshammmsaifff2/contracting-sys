import { describe, expect, it, vi } from "vitest";
import { ok, okVoid } from "@core/shared/result";
import type { DepartmentDto, JobDto, SaveDepartmentInput } from "../dtos";
import type { IOrganizationRepository } from "../ports/organization-repository";
import {
  DeleteDepartment,
  DeleteJob,
  SaveDepartment,
  SaveJob,
} from "./OrganizationUseCases";

function job(over: Partial<JobDto> = {}): JobDto {
  return {
    id: "j1",
    departmentId: "d1",
    name: "مهندس",
    description: "",
    sortOrder: 1,
    roleId: "r1",
    roleKey: "engineer",
    roleName: "مهندس",
    holderCount: 0,
    ...over,
  };
}

function department(over: Partial<DepartmentDto> = {}): DepartmentDto {
  return {
    id: "d1",
    name: "الإدارة الهندسية",
    classification: "operational",
    description: "",
    restrictAttachments: false,
    sortOrder: 1,
    employeeCount: 0,
    jobs: [],
    ...over,
  };
}

function makeRepo(departments: DepartmentDto[] = []) {
  const repo: IOrganizationRepository = {
    listDepartments: async () => ok(departments),
    listAttachmentAccess: async () => ok([]),
    saveDepartment: vi.fn(async () => ok("d1")),
    deleteDepartment: vi.fn(async () => okVoid()),
    saveJob: vi.fn(async () => ok("j1")),
    deleteJob: vi.fn(async () => okVoid()),
  };
  return repo;
}

const baseDepartment: SaveDepartmentInput = {
  id: "d1",
  name: "  الإدارة الهندسية ",
  classification: "operational",
  description: "",
  restrictAttachments: true,
  sortOrder: 1,
  access: [],
};

describe("SaveDepartment", () => {
  it("يقصّ الاسم ويطوي الاستثناء المكرّر ويُسقط الناقص", async () => {
    const repo = makeRepo();
    const result = await new SaveDepartment(repo).execute({
      ...baseDepartment,
      access: [
        { kind: "user", userId: "u1", departmentId: null },
        { kind: "user", userId: "u1", departmentId: null },
        { kind: "department", userId: null, departmentId: "" },
        { kind: "department", userId: null, departmentId: "d2" },
      ],
    });

    expect(result.ok).toBe(true);
    expect(repo.saveDepartment).toHaveBeenCalledWith(
      expect.objectContaining({
        name: "الإدارة الهندسية",
        access: [
          { kind: "user", userId: "u1", departmentId: null },
          { kind: "department", userId: null, departmentId: "d2" },
        ],
      }),
    );
  });

  /** الاستثناء بلا إخفاء يبقى في القاعدة بلا أثر، ثم يعود حيًّا لو أُعيد الإخفاء. */
  it("يمحو الاستثناءات حين يُرفع الإخفاء", async () => {
    const repo = makeRepo();
    await new SaveDepartment(repo).execute({
      ...baseDepartment,
      restrictAttachments: false,
      access: [{ kind: "user", userId: "u1", departmentId: null }],
    });
    expect(repo.saveDepartment).toHaveBeenCalledWith(
      expect.objectContaining({ access: [] }),
    );
  });

  it("يرفض استثناء القسم من نفسه", async () => {
    const repo = makeRepo();
    const result = await new SaveDepartment(repo).execute({
      ...baseDepartment,
      access: [{ kind: "department", userId: null, departmentId: "d1" }],
    });
    expect(result.ok).toBe(false);
    expect(repo.saveDepartment).not.toHaveBeenCalled();
  });

  it("يرفض اسمًا فارغًا", async () => {
    const repo = makeRepo();
    const result = await new SaveDepartment(repo).execute({
      ...baseDepartment,
      name: " ",
    });
    expect(result.ok).toBe(false);
  });
});

describe("DeleteDepartment", () => {
  it("يمنع حذف قسمٍ فيه وظائف ويذكر عددها", async () => {
    const repo = makeRepo([department({ jobs: [job(), job({ id: "j2" })] })]);
    const result = await new DeleteDepartment(repo).execute({ id: "d1" });

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.message).toContain("2 وظيفة");
    expect(repo.deleteDepartment).not.toHaveBeenCalled();
  });

  it("يحذف القسم الفارغ", async () => {
    const repo = makeRepo([department()]);
    const result = await new DeleteDepartment(repo).execute({ id: "d1" });
    expect(result.ok).toBe(true);
    expect(repo.deleteDepartment).toHaveBeenCalledWith("d1");
  });
});

describe("DeleteJob", () => {
  it("يمنع حذف وظيفةٍ يشغلها موظفون", async () => {
    const repo = makeRepo([department({ jobs: [job({ holderCount: 3 })] })]);
    const result = await new DeleteJob(repo).execute({ id: "j1" });
    expect(result.ok).toBe(false);
    expect(repo.deleteJob).not.toHaveBeenCalled();
  });

  it("يحذف الوظيفة الشاغرة", async () => {
    const repo = makeRepo([department({ jobs: [job()] })]);
    const result = await new DeleteJob(repo).execute({ id: "j1" });
    expect(result.ok).toBe(true);
    expect(repo.deleteJob).toHaveBeenCalledWith("j1");
  });
});

describe("SaveJob", () => {
  it("يشترط دور صلاحيات للوظيفة", async () => {
    const repo = makeRepo();
    const result = await new SaveJob(repo).execute({
      id: null,
      departmentId: "d1",
      name: "مهندس",
      roleId: "",
      description: "",
      sortOrder: 1,
    });
    expect(result.ok).toBe(false);
    expect(repo.saveJob).not.toHaveBeenCalled();
  });
});
