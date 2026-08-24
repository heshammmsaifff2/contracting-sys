import { describe, expect, it } from "vitest";
import { ok, type Result } from "@core/shared/result";
import type { DomainError } from "@core/shared/errors/domain-error";
import type { IClock } from "@application/shared/ports/clock";
import type { ModuleStatusDto } from "../dtos/system-info";
import type { ISystemInfoRepository } from "../ports/system-info-repository";
import { GetSystemInfo } from "./GetSystemInfo";

const FIXED_NOW = new Date("2026-08-23T10:00:00.000Z");

class FixedClock implements IClock {
  now(): Date {
    return FIXED_NOW;
  }
  today(): Date {
    return new Date("2026-08-23T00:00:00.000Z");
  }
}

class StubRepository implements ISystemInfoRepository {
  private readonly modules: readonly ModuleStatusDto[];

  constructor(modules: readonly ModuleStatusDto[]) {
    this.modules = modules;
  }

  async listModules(): Promise<Result<readonly ModuleStatusDto[], DomainError>> {
    return ok(this.modules);
  }
}

describe("GetSystemInfo", () => {
  it("يجمع بيانات المنفذ مع الوقت المحقون ويعيد Result ناجحًا", async () => {
    const modules: ModuleStatusDto[] = [
      { key: "procurement", nameAr: "المشتريات", phase: 3, status: "planned" },
    ];
    const useCase = new GetSystemInfo(new StubRepository(modules), new FixedClock());

    const result = await useCase.execute({
      appName: "اختبار",
      environment: "test",
      currentPhase: 0,
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.serverTime).toEqual(FIXED_NOW);
    expect(result.value.modules).toHaveLength(1);
    expect(result.value.currentPhase).toBe(0);
  });
});
