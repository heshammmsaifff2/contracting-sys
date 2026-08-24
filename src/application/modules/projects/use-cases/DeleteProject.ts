import type { DomainError } from "@core/shared/errors/domain-error";
import type { Result } from "@core/shared/result";
import type { UseCase } from "@application/shared/use-case";
import type { IProjectRepository } from "../ports/project-repository";

export class DeleteProject implements UseCase<{ id: string }, void> {
  private readonly projects: IProjectRepository;

  constructor(projects: IProjectRepository) {
    this.projects = projects;
  }

  async execute(input: { id: string }): Promise<Result<void, DomainError>> {
    return this.projects.remove(input.id);
  }
}
