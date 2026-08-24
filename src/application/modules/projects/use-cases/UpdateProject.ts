import type { DomainError } from "@core/shared/errors/domain-error";
import type { Result } from "@core/shared/result";
import { Project } from "@core/modules/projects/entities/Project";
import type { CurrencyCode } from "@core/shared/value-objects/money";
import type { UseCase } from "@application/shared/use-case";
import type { ProjectDto, UpdateProjectDto } from "../dtos";
import type { IProjectRepository } from "../ports/project-repository";

export interface UpdateProjectInput extends UpdateProjectDto {
  currency: CurrencyCode;
}

export class UpdateProject implements UseCase<UpdateProjectInput, ProjectDto> {
  private readonly projects: IProjectRepository;

  constructor(projects: IProjectRepository) {
    this.projects = projects;
  }

  async execute(input: UpdateProjectInput): Promise<Result<ProjectDto, DomainError>> {
    const validated = Project.create({
      id: input.id,
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

    return this.projects.update({
      id: input.id,
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
