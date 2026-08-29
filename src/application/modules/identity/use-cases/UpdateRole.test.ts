import { describe, expect, it, vi } from "vitest";
import { ok, okVoid } from "@core/shared/result";
import type { IRoleRepository } from "../ports/role-repository";
import { UpdateRole } from "./UpdateRole";

function makeRoleRepo() {
  const updateRole = vi.fn(async (role: { id: string; name: string; description: string | null }) =>
    ok({
      id: role.id,
      key: "custom_role",
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
    createRole: async () => ok({ id: "r1", key: "k", name: "n", description: null, isSystem: false, permissionKeys: [] }),
    updateRole,
    deleteRole: async () => okVoid(),
    getUsersCountForRole: async () => ok(0),
    setRolePermissions,
    assignRoleToUser: async () => okVoid(),
    removeRoleFromUser: async () => okVoid(),
  };

  return { repo, updateRole, setRolePermissions };
}

describe("UpdateRole", () => {
  it("يعدل بيانات الدور وصلاحياته بنجاح", async () => {
    const { repo, updateRole, setRolePermissions } = makeRoleRepo();

    const result = await new UpdateRole(repo).execute({
      id: "r1",
      name: "مشرف موقع عام",
      description: "وصف محدث",
      permissionIds: ["p1", "p3"],
    });

    expect(result.ok).toBe(true);
    expect(updateRole).toHaveBeenCalledWith({
      id: "r1",
      name: "مشرف موقع عام",
      description: "وصف محدث",
    });
    expect(setRolePermissions).toHaveBeenCalledWith("r1", ["p1", "p3"]);
  });

  it("يرفض اسماً فارغاً أو أقل من حرفين", async () => {
    const { repo, updateRole } = makeRoleRepo();

    const result = await new UpdateRole(repo).execute({
      id: "r1",
      name: "  ",
    });

    expect(result.ok).toBe(false);
    expect(updateRole).not.toHaveBeenCalled();
  });
});
