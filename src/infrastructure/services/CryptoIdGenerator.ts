import type { IIdGenerator } from "@application/shared/ports/id-generator";

/** تحقيق IIdGenerator عبر crypto.randomUUID المتاح في المتصفّحات الحديثة. */
export class CryptoIdGenerator implements IIdGenerator {
  generate(): string {
    return crypto.randomUUID();
  }
}
