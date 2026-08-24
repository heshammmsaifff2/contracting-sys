/**
 * المواد الزائدة عن الحاجة — تُعرض لبقية المشاريع قبل أي شراء جديد.
 */
import type { DomainError } from "@core/shared/errors/domain-error";
import { ValidationError } from "@core/shared/errors/domain-error";
import { err, type Result } from "@core/shared/result";
import type { UseCase } from "@application/shared/use-case";
import type { SaveSurplusDto, SurplusMaterialDto } from "../dtos";
import type { ISurplusRepository } from "../ports/surplus-repository";

export class ListSurplusMaterials implements UseCase<
  { projectId: string | null },
  readonly SurplusMaterialDto[]
> {
  private readonly repo: ISurplusRepository;

  constructor(repo: ISurplusRepository) {
    this.repo = repo;
  }

  async execute(input: {
    projectId: string | null;
  }): Promise<Result<readonly SurplusMaterialDto[], DomainError>> {
    return this.repo.list(input.projectId);
  }
}

export class SaveSurplusMaterial implements UseCase<
  SaveSurplusDto,
  SurplusMaterialDto
> {
  private readonly repo: ISurplusRepository;

  constructor(repo: ISurplusRepository) {
    this.repo = repo;
  }

  async execute(
    input: SaveSurplusDto,
  ): Promise<Result<SurplusMaterialDto, DomainError>> {
    if (input.projectId === "") {
      return err(new ValidationError("المشروع مطلوب", { projectId: "required" }));
    }
    if (input.itemId === "") {
      return err(new ValidationError("الصنف مطلوب", { itemId: "required" }));
    }
    if (!Number.isFinite(input.qty) || input.qty <= 0) {
      return err(
        new ValidationError("الكمية يجب أن تكون أكبر من صفر", { qty: "invalid" }),
      );
    }
    return this.repo.save(input);
  }
}

export class RemoveSurplusMaterial implements UseCase<{ id: string }, void> {
  private readonly repo: ISurplusRepository;

  constructor(repo: ISurplusRepository) {
    this.repo = repo;
  }

  async execute(input: { id: string }): Promise<Result<void, DomainError>> {
    return this.repo.remove(input.id);
  }
}
