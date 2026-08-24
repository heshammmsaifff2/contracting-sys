import { describe, expect, it, vi } from "vitest";
import { ok, okVoid } from "@core/shared/result";
import type { IItemRepository } from "../ports/item-repository";
import { SearchItems } from "./SearchItems";

describe("SearchItems", () => {
  it("يمرّر الاستعلام كما هو إلى قاعدة البيانات بلا فلترة في المتصفّح", async () => {
    const search = vi.fn(async () => ok([]));
    const repo: IItemRepository = {
      search,
      create: async () =>
        ok({
          id: "1",
          code: "IT-001",
          name: "أسمنت",
          unit: "طن",
          category: null,
          description: null,
          isActive: true,
        }),
      update: async () =>
        ok({
          id: "1",
          code: "IT-001",
          name: "أسمنت",
          unit: "طن",
          category: null,
          description: null,
          isActive: true,
        }),
      remove: async () => okVoid(),
    };

    const result = await new SearchItems(repo).execute({ query: "  أسمنت  " });

    expect(result.ok).toBe(true);
    // التطبيع والقصّ من مسؤولية Postgres، لا الواجهة
    expect(search).toHaveBeenCalledWith("  أسمنت  ", undefined);
  });
});
