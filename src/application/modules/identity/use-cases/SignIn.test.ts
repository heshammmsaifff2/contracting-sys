import { describe, expect, it, vi } from "vitest";
import { ok, okVoid } from "@core/shared/result";
import type { IAuthService } from "../ports/auth-service";
import { SignIn } from "./SignIn";

function makeAuth() {
  const signIn = vi.fn(async () => ok({ userId: "u1", email: "a@b.co" }));
  const service: IAuthService = {
    signIn,
    signOut: async () => okVoid(),
    getSession: async () => ok(null),
    onAuthStateChange: () => () => undefined,
  };
  return { service, signIn };
}

describe("SignIn", () => {
  it("يطبّع البريد قبل إرساله للمزوّد", async () => {
    const { service, signIn } = makeAuth();

    const result = await new SignIn(service).execute({
      email: "  Admin@Test.LOCAL ",
      password: "secret123",
    });

    expect(result.ok).toBe(true);
    expect(signIn).toHaveBeenCalledWith({
      email: "admin@test.local",
      password: "secret123",
    });
  });

  it("يرفض بريدًا غير صالح بلا اتصال بالشبكة", async () => {
    const { service, signIn } = makeAuth();

    const result = await new SignIn(service).execute({
      email: "not-an-email",
      password: "secret123",
    });

    expect(result.ok).toBe(false);
    expect(signIn).not.toHaveBeenCalled();
  });
});
