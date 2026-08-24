import type { DomainError } from "@core/shared/errors/domain-error";
import type { Result } from "@core/shared/result";
import type { UseCase } from "@application/shared/use-case";
import type { BoqItemDto } from "../dtos";
import type { IBoqRepository } from "../ports/boq-repository";

export interface SearchBoqItemsInput {
  query: string;
  limit?: number;
}

export class SearchBoqItems implements UseCase<
  SearchBoqItemsInput,
  readonly BoqItemDto[]
> {
  private readonly boq: IBoqRepository;

  constructor(boq: IBoqRepository) {
    this.boq = boq;
  }

  async execute(
    input: SearchBoqItemsInput,
  ): Promise<Result<readonly BoqItemDto[], DomainError>> {
    return this.boq.search(input.query, input.limit);
  }
}
