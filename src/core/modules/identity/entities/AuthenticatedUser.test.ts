import { describe, expect, it } from "vitest";
import { Profile } from "./Profile";
import { AuthenticatedUser } from "./AuthenticatedUser";

const PROJECT_A = "aaaaaaaa-0000-0000-0000-000000000001";
const PROJECT_B = "aaaaaaaa-0000-0000-0000-000000000002";

function makeUser(options: {
  isActive?: boolean;
  permissions?: string[];
  projectIds?: string[];
}) {
  const profile = Profile.create({
    id: "22222222-2222-2222-2222-222222222222",
    fullName: "مهندس الاختبار",
    employeeType: "engineer",
    isActive: options.isActive ?? true,
  });
  if (!profile.ok) throw new Error("setup failed");

  return new AuthenticatedUser({
    profile: profile.value,
    permissions: options.permissions ?? [],
    assignedProjectIds: options.projectIds ?? [],
  });
}

describe("AuthenticatedUser", () => {
  it("يرى المشاريع المعتمد عليها فقط", () => {
    const user = makeUser({ projectIds: [PROJECT_A] });

    expect(user.isAssignedTo(PROJECT_A)).toBe(true);
    expect(user.isAssignedTo(PROJECT_B)).toBe(false);
  });

  it("الموظف المعطَّل يفقد كل صلاحياته مهما كانت أدواره", () => {
    const user = makeUser({
      isActive: false,
      permissions: ["project.read_all", "user.read"],
      projectIds: [PROJECT_A],
    });

    expect(user.can("project.read_all")).toBe(false);
    expect(user.can("user.read")).toBe(false);
    // ولا حتى المشاريع المعتمدة عليه
    expect(user.isAssignedTo(PROJECT_A)).toBe(false);
  });

  it("canAny يكفيه امتلاك إحدى الصلاحيات", () => {
    const user = makeUser({ permissions: ["user.read"] });

    expect(user.canAny(["role.manage", "user.read"])).toBe(true);
    expect(user.canAny(["role.manage", "project.delete"])).toBe(false);
    expect(user.canAll(["role.manage", "user.read"])).toBe(false);
  });

  it("seesAllProjects يعتمد على صلاحية project.read_all", () => {
    expect(makeUser({ permissions: ["project.read_all"] }).seesAllProjects).toBe(true);
    expect(makeUser({}).seesAllProjects).toBe(false);
  });
});
