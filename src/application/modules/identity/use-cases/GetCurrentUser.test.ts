import { describe, expect, it } from "vitest";
import { ok, okVoid, type Result } from "@core/shared/result";
import type { DomainError } from "@core/shared/errors/domain-error";
import { Profile } from "@core/modules/identity/entities/Profile";
import type { IAuthService, SessionIdentity } from "../ports/auth-service";
import type { IAuthorizationRepository } from "../ports/authorization-repository";
import type { IProfileRepository } from "../ports/profile-repository";
import { GetCurrentUser } from "./GetCurrentUser";

const USER_ID = "22222222-2222-2222-2222-222222222222";
const PROJECT_ID = "aaaaaaaa-0000-0000-0000-000000000001";

function makeProfile(): Profile {
  const profile = Profile.create({
    id: USER_ID,
    fullName: "مهندس الاختبار",
    employeeType: "engineer",
  });
  if (!profile.ok) throw new Error("setup failed");
  return profile.value;
}

function makeAuth(session: SessionIdentity | null): IAuthService {
  return {
    signIn: async () => ok({ userId: USER_ID, email: null }),
    signOut: async () => okVoid(),
    getSession: async () => ok(session),
    onAuthStateChange: () => () => undefined,
  };
}

const authorization: IAuthorizationRepository = {
  currentPermissions: async () => ok(["user.read"]),
  currentProjectIds: async () => ok([PROJECT_ID]),
};

function makeProfiles(profile: Profile | null): IProfileRepository {
  return {
    findById: async (): Promise<Result<Profile | null, DomainError>> => ok(profile),
    list: async () => ok([]),
    update: async () => ok(makeProfile()),
    setActive: async () => okVoid(),
  };
}

describe("GetCurrentUser", () => {
  it("يجمع الملف والصلاحيات والمشاريع المعتمدة", async () => {
    const useCase = new GetCurrentUser(
      makeAuth({ userId: USER_ID, email: "eng@test.local" }),
      makeProfiles(makeProfile()),
      authorization,
    );

    const result = await useCase.execute();

    expect(result.ok).toBe(true);
    if (!result.ok || result.value === null) return;
    expect(result.value.can("user.read")).toBe(true);
    expect(result.value.can("project.create")).toBe(false);
    expect(result.value.isAssignedTo(PROJECT_ID)).toBe(true);
  });

  it("يعيد null بلا جلسة — ولا يستدعي المستودعات", async () => {
    const useCase = new GetCurrentUser(
      makeAuth(null),
      makeProfiles(makeProfile()),
      authorization,
    );

    const result = await useCase.execute();

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value).toBeNull();
  });

  it("يعيد null إن لم يكن للحساب ملف موظف", async () => {
    const useCase = new GetCurrentUser(
      makeAuth({ userId: USER_ID, email: null }),
      makeProfiles(null),
      authorization,
    );

    const result = await useCase.execute();

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value).toBeNull();
  });
});
