/**
 * المنشآت — هرم تجمّع/حي/منشأة بوزن نسبي.
 * الوزن ليس تفصيلًا شكليًا: عليه يقوم كشف الهدر، فلا يُقبل صفرًا [المخازن 9].
 */
import type { DomainError } from "@core/shared/errors/domain-error";
import { ValidationError } from "@core/shared/errors/domain-error";
import { err, type Result } from "@core/shared/result";
import type { UseCase } from "@application/shared/use-case";
import type { FacilityDto, SaveFacilityDto } from "../dtos";
import type { IFacilityRepository } from "../ports/facility-repository";

export class ListFacilities implements UseCase<
  { projectId: string | null },
  readonly FacilityDto[]
> {
  private readonly repo: IFacilityRepository;

  constructor(repo: IFacilityRepository) {
    this.repo = repo;
  }

  async execute(input: {
    projectId: string | null;
  }): Promise<Result<readonly FacilityDto[], DomainError>> {
    return this.repo.list(input.projectId);
  }
}

export class SaveFacility implements UseCase<SaveFacilityDto, FacilityDto> {
  private readonly repo: IFacilityRepository;

  constructor(repo: IFacilityRepository) {
    this.repo = repo;
  }

  async execute(input: SaveFacilityDto): Promise<Result<FacilityDto, DomainError>> {
    if (input.projectId === "") {
      return err(new ValidationError("المشروع مطلوب", { projectId: "required" }));
    }
    if (input.code.trim() === "") {
      return err(new ValidationError("كود المنشأة مطلوب", { code: "required" }));
    }
    if (input.name.trim().length < 2) {
      return err(new ValidationError("اسم المنشأة مطلوب", { name: "required" }));
    }
    if (!Number.isFinite(input.weight) || input.weight <= 0) {
      return err(
        new ValidationError("الوزن النسبي يجب أن يكون أكبر من صفر", {
          weight: "invalid",
        }),
      );
    }

    return this.repo.save({
      ...input,
      code: input.code.trim().toUpperCase(),
      name: input.name.trim(),
      groupName: input.groupName.trim(),
      district: input.district.trim(),
    });
  }
}

export class RemoveFacility implements UseCase<{ id: string }, void> {
  private readonly repo: IFacilityRepository;

  constructor(repo: IFacilityRepository) {
    this.repo = repo;
  }

  async execute(input: { id: string }): Promise<Result<void, DomainError>> {
    return this.repo.remove(input.id);
  }
}
