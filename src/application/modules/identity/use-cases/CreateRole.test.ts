import { describe, expect, it, vi } from "vitest";
import { ok, okVoid } from "@core/shared/result";
import type { IRoleRepository } from "../ports/role-repository";
import { CreateRole } from "./CreateRole";

function makeRoleRepo() {
  const createRole = vi.fn(async (role: { key: string; name: string; description: string | null }) =>
    ok({
      id: "r1",
      key: role.key,
      name: role.name,
      description: role.description,
      isSystem: false,
      permissionKeys: [],
    }),
  );
  const setRolePermissions = vi.fn(async () => okVoid());

  const repo: IRoleRepository = {
    listRoles: async () => ok([]),
    listPermissions: async () => ok([]),
    createRole,
    updateRole: async () => ok({ id: "r1", key: "k", name: "n", description: null, isSystem: false, permissionKeys: [] }),
    deleteRole: async () => okVoid(),
    getUsersCountForRole: async () => ok(0),
    setRolePermissions,
    assignRoleToUser: async () => okVoid(),
    removeRoleFromUser: async () => okVoid(),
  };

  return { repo, createRole, setRolePermissions };
}

describe("CreateRole", () => {
  it("ينشئ دوراً جديداً بنجاح مع الصلاحيات", async () => {
    const { repo, createRole, setRolePermissions } = makeRoleRepo();

    const result = await new CreateRole(repo).execute({
      key: "site_engineer",
      name: "مهندس موقع",
      description: "مسؤول عن متابعة الأعمال الميدانية",
      permissionIds: ["p1", "p2"],
    });

    expect(result.ok).toBe(true);
    expect(createRole).toHaveBeenCalledWith({
      key: "site_engineer",
      name: "مهندس موقع",
      description: "مسؤول عن متابعة الأعمال الميدانية",
    });
    expect(setRolePermissions).toHaveBeenCalledWith("r1", ["p1", "p2"]);
  });

  it("يرفض مفتاحاً غير صالح", async () => {
    const { repo, createRole } = makeRoleRepo();

    const result = await new CreateRole(repo).execute({
      key: "Invalid Key!",
      name: "مهندس موقع",
    });

    expect(result.ok).toBe(false);
    expect(createRole).not.toHaveBeenCalled();
  });

  it("يرفض اسماً قصيراً جداً", async () => {
    const { repo, createRole } = makeRoleRepo();

    const result = await new CreateRole(repo).execute({
      key: "site_engineer",
      name: "أ",
    });

    expect(result.ok).toBe(false);
    expect(createRole).not.toHaveBeenCalled();
  });
});
