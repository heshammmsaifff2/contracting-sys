import type { DomainError } from "@core/shared/errors/domain-error";
import { ValidationError } from "@core/shared/errors/domain-error";
import { err, type Result } from "@core/shared/result";
import type { UseCase } from "@application/shared/use-case";
import type { SetBoqComponentsDto } from "../dtos";
import type { IBoqRepository } from "../ports/boq-repository";

/**
 * يضبط تكوين البند من الأصناف. هذا التكوين هو ما يجعل النظام يحسب
 * احتياج الأصناف من كمية البند لاحقًا بلا إدخال يدوي مكرّر.
 */
export class SetBoqComponents implements UseCase<SetBoqComponentsDto, void> {
  private readonly boq: IBoqRepository;

  constructor(boq: IBoqRepository) {
    this.boq = boq;
  }

  async execute(input: SetBoqComponentsDto): Promise<Result<void, DomainError>> {
    if (input.components.some((c) => c.quantityPerUnit <= 0)) {
      return err(
        new ValidationError("كمية الصنف في البند يجب أن تكون أكبر من صفر", {
          components: "invalid_quantity",
        }),
      );
    }

    const unique = new Set(input.components.map((c) => c.itemId));
    if (unique.size !== input.components.length) {
      return err(
        new ValidationError("لا يجوز تكرار الصنف نفسه في تكوين البند", {
          components: "duplicate",
        }),
      );
    }

    return this.boq.setComponents(input);
  }
}
