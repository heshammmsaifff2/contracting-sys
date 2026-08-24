import { describe, expect, it, vi } from "vitest";
import { ok, okVoid, type Result } from "@core/shared/result";
import type { DomainError } from "@core/shared/errors/domain-error";
import type {
  CreateUploadTicketInput,
  IFileStorage,
  StoredFile,
  UploadTicket,
} from "@application/shared/ports/file-storage";
import { RequestUploadTicket } from "./RequestUploadTicket";

function makeStorage(): IFileStorage & {
  createUploadTicket: ReturnType<typeof vi.fn>;
} {
  const createUploadTicket = vi.fn(
    async (
      _input: CreateUploadTicketInput,
    ): Promise<Result<UploadTicket, DomainError>> =>
      ok({ uploadUrl: "https://example.test/upload", params: { signature: "sig" } }),
  );

  return {
    createUploadTicket,
    buildUrl: (publicId: string) => `https://cdn.test/${publicId}`,
    upload: async (): Promise<Result<StoredFile, DomainError>> =>
      ok({ publicId: "erp/x/1", url: "https://cdn.test/erp/x/1" }),
    remove: async () => okVoid(),
  };
}

describe("RequestUploadTicket", () => {
  it("يصدر تذكرة رفع لمجلّد صالح", async () => {
    const storage = makeStorage();
    const useCase = new RequestUploadTicket(storage);

    const result = await useCase.execute({ folder: "erp/proj-1/invoices" });

    expect(result.ok).toBe(true);
    expect(storage.createUploadTicket).toHaveBeenCalledOnce();
  });

  it("يرفض أي مجلّد خارج الجذر erp/ ولا ينادي المزوّد", async () => {
    const storage = makeStorage();
    const useCase = new RequestUploadTicket(storage);

    const result = await useCase.execute({ folder: "../secrets" });

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe("VALIDATION");
    expect(storage.createUploadTicket).not.toHaveBeenCalled();
  });
});
