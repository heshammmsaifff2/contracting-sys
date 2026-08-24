import type { DomainError } from "@core/shared/errors/domain-error";
import type { Result } from "@core/shared/result";
import { BoqItem } from "@core/modules/catalog/entities/BoqItem";
import type { IIdGenerator } from "@application/shared/ports/id-generator";
import type { UseCase } from "@application/shared/use-case";
import type { BoqItemDto, CreateBoqItemDto } from "../dtos";
import type { IBoqRepository } from "../ports/boq-repository";

export class CreateBoqItem implements UseCase<CreateBoqItemDto, BoqItemDto> {
  private readonly boq: IBoqRepository;
  private readonly ids: IIdGenerator;

  constructor(boq: IBoqRepository, ids: IIdGenerator) {
    this.boq = boq;
    this.ids = ids;
  }

  async execute(input: CreateBoqItemDto): Promise<Result<BoqItemDto, DomainError>> {
    const validated = BoqItem.create({ id: this.ids.generate(), ...input });
    if (!validated.ok) return validated;

    return this.boq.create({
      code: validated.value.code.value,
      name: validated.value.name,
      unit: validated.value.unit,
      description: validated.value.description,
      isActive: validated.value.isActive,
    });
  }
}
