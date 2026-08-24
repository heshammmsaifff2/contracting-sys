/**
 * العقد الموحّد لكل use-case في النظام.
 * يستقبل DTO، يستدعي Ports، يطبّق قواعد الدومين، ويعيد Result — بلا استثناءات.
 */
import type { DomainError } from "@core/shared/errors/domain-error";
import type { Result } from "@core/shared/result";

export interface UseCase<Input, Output> {
  execute(input: Input): Promise<Result<Output, DomainError>>;
}

/** use-case بلا مدخلات. */
export type QueryUseCase<Output> = UseCase<void, Output>;
