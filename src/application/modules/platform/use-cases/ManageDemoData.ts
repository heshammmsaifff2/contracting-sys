/**
 * إدارة النسخة الاختبارية.
 * الطبقة هنا رقيقة عمدًا: القرار كله في الخادم (الصلاحية، منع الازدواج،
 * ترتيب الحذف)، فلا يوجد ما يُعاد تقريره في المتصفّح.
 */
import type { DomainError } from "@core/shared/errors/domain-error";
import type { Result } from "@core/shared/result";
import type { UseCase } from "@application/shared/use-case";
import type { DemoDataStatusDto } from "../dtos/demo-data";
import type { IDemoDataRepository } from "../ports/demo-data-repository";

export class GetDemoDataStatus implements UseCase<void, DemoDataStatusDto> {
  private readonly repo: IDemoDataRepository;

  constructor(repo: IDemoDataRepository) {
    this.repo = repo;
  }

  async execute(): Promise<Result<DemoDataStatusDto, DomainError>> {
    return this.repo.status();
  }
}

export class SeedDemoData implements UseCase<void, { trackedRows: number }> {
  private readonly repo: IDemoDataRepository;

  constructor(repo: IDemoDataRepository) {
    this.repo = repo;
  }

  async execute(): Promise<Result<{ trackedRows: number }, DomainError>> {
    return this.repo.seed();
  }
}

export class ClearDemoData implements UseCase<void, { removedRows: number }> {
  private readonly repo: IDemoDataRepository;

  constructor(repo: IDemoDataRepository) {
    this.repo = repo;
  }

  async execute(): Promise<Result<{ removedRows: number }, DomainError>> {
    return this.repo.clear();
  }
}
