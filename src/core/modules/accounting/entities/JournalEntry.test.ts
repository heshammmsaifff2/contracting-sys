import { describe, expect, it } from "vitest";
import { JournalEntry, type JournalLineProps } from "./JournalEntry";

function line(over: Partial<JournalLineProps>): JournalLineProps {
  return {
    id: "l1",
    accountId: "a1",
    accountCode: "1101",
    accountName: "البنك",
    debit: 0,
    credit: 0,
    description: "",
    partyType: null,
    partyId: null,
    ...over,
  };
}

const BASE = {
  id: "e1",
  entryNo: 1,
  entryDate: new Date("2026-01-01"),
  description: "رصيد افتتاحي",
  sourceType: "opening_balance",
  sourceId: "ob1",
  isManual: false,
  projectId: null,
  projectName: null,
  currency: "EGP" as const,
};

describe("JournalEntry", () => {
  it("يقبل القيد المتوازن ويجمع الطرفين", () => {
    const entry = JournalEntry.create({
      ...BASE,
      lines: [
        line({ id: "l1", debit: 250000 }),
        line({ id: "l2", accountCode: "3900", credit: 250000 }),
      ],
    });

    expect(entry.ok).toBe(true);
    if (!entry.ok) return;
    expect(entry.value.isBalanced).toBe(true);
    expect(entry.value.totalDebit.amount).toBe(250000);
    expect(entry.value.totalCredit.amount).toBe(250000);
  });

  it("يرفض القيد غير المتوازن", () => {
    const entry = JournalEntry.create({
      ...BASE,
      lines: [line({ id: "l1", debit: 100 }), line({ id: "l2", credit: 60 })],
    });

    expect(entry.ok).toBe(false);
    if (entry.ok) return;
    expect(entry.error.code).toBe("VALIDATION");
  });

  it("يرفض سطرًا مدينًا ودائنًا في آن واحد", () => {
    const entry = JournalEntry.create({
      ...BASE,
      lines: [
        line({ id: "l1", debit: 100, credit: 100 }),
        line({ id: "l2", credit: 0 }),
      ],
    });
    expect(entry.ok).toBe(false);
  });

  it("يرفض قيدًا بسطر واحد", () => {
    const entry = JournalEntry.create({ ...BASE, lines: [line({ debit: 100 })] });
    expect(entry.ok).toBe(false);
  });

  it("يحفظ الدقّة في مجاميع بها كسور", () => {
    const entry = JournalEntry.create({
      ...BASE,
      lines: [
        line({ id: "l1", debit: 0.1 }),
        line({ id: "l2", debit: 0.2 }),
        line({ id: "l3", credit: 0.3 }),
      ],
    });

    expect(entry.ok).toBe(true);
    if (!entry.ok) return;
    expect(entry.value.totalDebit.amount).toBe(0.3);
    expect(entry.value.isBalanced).toBe(true);
  });
});
