/**
 * Result<T, E> — بديل رمي الاستثناءات للتحكّم في التدفّق.
 * كل use-case وكل قاعدة دومين تُعيد Result بدل throw.
 */
import type { DomainError } from "./errors/domain-error";

export type Ok<T> = { readonly ok: true; readonly value: T };
export type Err<E> = { readonly ok: false; readonly error: E };
export type Result<T, E = DomainError> = Ok<T> | Err<E>;

/** Build a successful result. */
export const ok = <T>(value: T): Ok<T> => ({ ok: true, value });

/** Build a failed result. */
export const err = <E>(error: E): Err<E> => ({ ok: false, error });

/** Success result carrying no value. */
export const okVoid = (): Ok<void> => ({ ok: true, value: undefined });

export const isOk = <T, E>(r: Result<T, E>): r is Ok<T> => r.ok;
export const isErr = <T, E>(r: Result<T, E>): r is Err<E> => !r.ok;

/** Transform the success value, leaving errors untouched. */
export function map<T, U, E>(r: Result<T, E>, fn: (v: T) => U): Result<U, E> {
  return r.ok ? ok(fn(r.value)) : r;
}

/** Transform the error, leaving success untouched. */
export function mapErr<T, E, F>(r: Result<T, E>, fn: (e: E) => F): Result<T, F> {
  return r.ok ? r : err(fn(r.error));
}

/** Chain another fallible step (flatMap). */
export function andThen<T, U, E>(
  r: Result<T, E>,
  fn: (v: T) => Result<U, E>,
): Result<U, E> {
  return r.ok ? fn(r.value) : r;
}

/** Read the value or fall back to a default. */
export function unwrapOr<T, E>(r: Result<T, E>, fallback: T): T {
  return r.ok ? r.value : fallback;
}

/**
 * اجمع عدّة نتائج: تنجح فقط إذا نجحت كلها، وإلا تُعيد أول خطأ.
 */
export function combine<T, E>(results: readonly Result<T, E>[]): Result<T[], E> {
  const values: T[] = [];
  for (const r of results) {
    if (!r.ok) return r;
    values.push(r.value);
  }
  return ok(values);
}
