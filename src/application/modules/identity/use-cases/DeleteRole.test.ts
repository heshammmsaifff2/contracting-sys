import { describe, expect, it, vi } from "vitest";
import { ok, okVoid } from "@core/shared/result";
import type { IRoleRepository } from "../ports/role-repository";
import { DeleteRole } from "./DeleteRole";

function makeRoleRepo(opts?: { isSystem?: boolean; usersCount?: number }) {
  const isSystem = opts?.isSystem ?? false;
  const usersCount = opts?.usersCount ?? 0;

  const deleteRole = vi.fn(async () => okVoid());

  const repo: IRoleRepository = {
    listRoles: async () =>
      ok([
        {
          id: "r1",
          key: isSystem ? "admin" : "custom_role",
          name: "دور اختباري",
          description: null,
          isSystem,
          permissionKeys: [],
        },
      ]),
    listPermissions: async () => ok([]),
    createRole: async () => ok({ id: "r1", key: "k", name: "n", description: null, isSystem: false, permissionKeys: [] }),
    updateRole: async () => ok({ id: "r1", key: "k", name: "n", description: null, isSystem: false, permissionKeys: [] }),
    deleteRole,
    getUsersCountForRole: async () => ok(usersCount),
    setRolePermissions: async () => okVoid(),
    assignRoleToUser: async () => okVoid(),
    removeRoleFromUser: async () => okVoid(),
  };

  return { repo, deleteRole };
}

describe("DeleteRole", () => {
  it("يحذف دوراً مخصصاً ليس له موظفون مرتبطون", async () => {
    const { repo, deleteRole } = makeRoleRepo({ isSystem: false, usersCount: 0 });

    const result = await new DeleteRole(repo).execute({ id: "r1" });

    expect(result.ok).toBe(true);
    expect(deleteRole).toHaveBeenCalledWith("r1");
  });

  it("يمنع حذف أدوار النظام الأساسية", async () => {
    const { repo, deleteRole } = makeRoleRepo({ isSystem: true, usersCount: 0 });

    const result = await new DeleteRole(repo).execute({ id: "r1" });

    expect(result.ok).toBe(false);
    expect(deleteRole).not.toHaveBeenCalled();
  });

  it("يمنع حذف دور مسند لموظفين حاليين", async () => {
    const { repo, deleteRole } = makeRoleRepo({ isSystem: false, usersCount: 3 });

    const result = await new DeleteRole(repo).execute({ id: "r1" });

    expect(result.ok).toBe(false);
    expect(deleteRole).not.toHaveBeenCalled();
  });
});
