/**
 * تحقيق وهمي (in-memory) لمنفذ ISystemInfoRepository — غرضه إثبات أن الربط
 * عبر DI يعمل في Phase 0 قبل وجود أي جداول. يُستبدل بمحوّل Supabase لاحقًا
 * دون تغيير سطر واحد في الواجهة أو الـ use-case.
 */
import type { DomainError } from "@core/shared/errors/domain-error";
import { ok, type Result } from "@core/shared/result";
import type { ModuleStatusDto } from "@application/modules/platform/dtos/system-info";
import type { ISystemInfoRepository } from "@application/modules/platform/ports/system-info-repository";

export class InMemorySystemInfoRepository implements ISystemInfoRepository {
  private readonly modules: readonly ModuleStatusDto[];

  constructor(modules: readonly ModuleStatusDto[]) {
    this.modules = modules;
  }

  async listModules(): Promise<Result<readonly ModuleStatusDto[], DomainError>> {
    return ok(this.modules);
  }
}
