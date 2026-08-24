import type { DomainError } from "@core/shared/errors/domain-error";
import type { Result } from "@core/shared/result";
import { Project } from "@core/modules/projects/entities/Project";
import type { CurrencyCode } from "@core/shared/value-objects/money";
import type { IIdGenerator } from "@application/shared/ports/id-generator";
import type { UseCase } from "@application/shared/use-case";
import type { CreateProjectDto, ProjectDto } from "../dtos";
import type { IProjectRepository } from "../ports/project-repository";

export interface CreateProjectInput extends CreateProjectDto {
  currency: CurrencyCode;
}

export class CreateProject implements UseCase<CreateProjectInput, ProjectDto> {
  private readonly projects: IProjectRepository;
  private readonly ids: IIdGenerator;

  constructor(projects: IProjectRepository, ids: IIdGenerator) {
    this.projects = projects;
    this.ids = ids;
  }

  async execute(input: CreateProjectInput): Promise<Result<ProjectDto, DomainError>> {
    // قواعد الدومين تتحقّق من الكود والاسم وقيمة العقد قبل أي اتصال بالشبكة
    const validated = Project.create({
      id: this.ids.generate(),
      code: input.code,
      name: input.name,
      ownerEntity: input.ownerEntity,
      contractValue: input.contractValue,
      currency: input.currency,
      receivedAt: input.receivedAt === null ? null : new Date(input.receivedAt),
      managerId: input.managerId,
      extractsOfficerId: input.extractsOfficerId,
      status: input.status,
    });
    if (!validated.ok) return validated;

    return this.projects.create({
      code: validated.value.code.value,
      name: validated.value.name,
      ownerEntity: validated.value.ownerEntity,
      contractValue: validated.value.contractValue.toNumeric(),
      receivedAt: input.receivedAt,
      managerId: validated.value.managerId,
      extractsOfficerId: validated.value.extractsOfficerId,
      status: validated.value.status,
    });
  }
}
