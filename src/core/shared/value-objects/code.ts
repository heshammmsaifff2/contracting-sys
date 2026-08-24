/**
 * Code — الكود المُوحَّد لأي كيان مُكوَّد (صنف، مورد، مقاول، مشروع، بند).
 * تجسيد لقاعدة «تُدخَل المعلومة مرة واحدة وتُستدعى بالكود».
 */
import { ValidationError } from "../errors/domain-error";
import { err, ok, type Result } from "../result";

const CODE_PATTERN = /^[A-Z0-9][A-Z0-9-_/]{0,31}$/;

export class Code {
  readonly value: string;

  private constructor(value: string) {
    this.value = value;
    Object.freeze(this);
  }

  static create(raw: string): Result<Code, ValidationError> {
    const normalized = raw.trim().toUpperCase();
    if (normalized.length === 0) {
      return err(new ValidationError("الكود مطلوب", { code: "required" }));
    }
    if (!CODE_PATTERN.test(normalized)) {
      return err(
        new ValidationError(
          "الكود يقبل الحروف الإنجليزية والأرقام و - _ / فقط (32 حرفًا كحد أقصى)",
          { code: "pattern" },
        ),
      );
    }
    return ok(new Code(normalized));
  }

  equals(other: Code): boolean {
    return this.value === other.value;
  }

  toString(): string {
    return this.value;
  }
}
