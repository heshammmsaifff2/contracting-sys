import type { DomainError } from "@core/shared/errors/domain-error";
import type { Result } from "@core/shared/result";
import type { UseCase } from "@application/shared/use-case";
import type { BoqComponentDto } from "../dtos";
import type { IBoqRepository } from "../ports/boq-repository";

export class ListBoqComponents implements UseCase<
  { boqItemId: string },
  readonly BoqComponentDto[]
> {
  private readonly boq: IBoqRepository;

  constructor(boq: IBoqRepository) {
    this.boq = boq;
  }

  async execute(input: {
    boqItemId: string;
  }): Promise<Result<readonly BoqComponentDto[], DomainError>> {
    return this.boq.listComponents(input.boqItemId);
  }
}
