/**
 * Use-case تجريبي للتحقق من سلامة الربط المعماري في Phase 0:
 * الواجهة ← use-case ← port ← adapter، بلا أي معرفة بـ Supabase.
 */
import type { DomainError } from "@core/shared/errors/domain-error";
import { ok, type Result } from "@core/shared/result";
import type { IClock } from "@application/shared/ports/clock";
import type { UseCase } from "@application/shared/use-case";
import type { SystemInfoDto } from "../dtos/system-info";
import type { ISystemInfoRepository } from "../ports/system-info-repository";

export interface GetSystemInfoInput {
  appName: string;
  environment: string;
  currentPhase: number;
}

export class GetSystemInfo implements UseCase<GetSystemInfoInput, SystemInfoDto> {
  private readonly repo: ISystemInfoRepository;
  private readonly clock: IClock;

  constructor(repo: ISystemInfoRepository, clock: IClock) {
    this.repo = repo;
    this.clock = clock;
  }

  async execute(
    input: GetSystemInfoInput,
  ): Promise<Result<SystemInfoDto, DomainError>> {
    const modules = await this.repo.listModules();
    if (!modules.ok) return modules;

    return ok({
      appName: input.appName,
      environment: input.environment,
      currentPhase: input.currentPhase,
      serverTime: this.clock.now(),
      modules: modules.value,
    });
  }
}
