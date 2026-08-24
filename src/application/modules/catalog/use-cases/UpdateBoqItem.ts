import type { DomainError } from "@core/shared/errors/domain-error";
import type { Result } from "@core/shared/result";
import { BoqItem } from "@core/modules/catalog/entities/BoqItem";
import type { UseCase } from "@application/shared/use-case";
import type { BoqItemDto, UpdateBoqItemDto } from "../dtos";
import type { IBoqRepository } from "../ports/boq-repository";

export class UpdateBoqItem implements UseCase<UpdateBoqItemDto, BoqItemDto> {
  private readonly boq: IBoqRepository;

  constructor(boq: IBoqRepository) {
    this.boq = boq;
  }

  async execute(input: UpdateBoqItemDto): Promise<Result<BoqItemDto, DomainError>> {
    const validated = BoqItem.create(input);
    if (!validated.ok) return validated;

    return this.boq.update({
      id: input.id,
      code: validated.value.code.value,
      name: validated.value.name,
      unit: validated.value.unit,
      description: validated.value.description,
      isActive: validated.value.isActive,
    });
  }
}
