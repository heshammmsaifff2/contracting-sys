/** مولّد المعرّفات (uuid v4) — مُجرّد حتى تُختبر الـ use-cases بمعرّفات ثابتة. */
export interface IIdGenerator {
  generate(): string;
}
