import type { IClock } from "@application/shared/ports/clock";

/** تحقيق IClock بالوقت الحقيقي. الاختبارات تستبدله بساعة ثابتة. */
export class SystemClock implements IClock {
  now(): Date {
    return new Date();
  }

  today(): Date {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d;
  }
}
