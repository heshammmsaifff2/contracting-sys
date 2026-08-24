/**
 * تدفّق الرفع الكامل: تذكرة موقّعة ← رفع مباشر ← مرجع تخزين جاهز للحفظ في قاعدة البيانات.
 */
import type { DomainError } from "@core/shared/errors/domain-error";
import type { Result } from "@core/shared/result";
import type { IFileStorage, StoredFile } from "@application/shared/ports/file-storage";
import type { UseCase } from "@application/shared/use-case";
import { RequestUploadTicket } from "./RequestUploadTicket";

export interface UploadFileInput {
  folder: string;
  file: File;
  authenticated?: boolean;
}

export class UploadFile implements UseCase<UploadFileInput, StoredFile> {
  private readonly storage: IFileStorage;
  private readonly requestTicket: RequestUploadTicket;

  constructor(storage: IFileStorage) {
    this.storage = storage;
    this.requestTicket = new RequestUploadTicket(storage);
  }

  async execute(input: UploadFileInput): Promise<Result<StoredFile, DomainError>> {
    const ticket = await this.requestTicket.execute({
      folder: input.folder,
      ...(input.authenticated === undefined
        ? {}
        : { authenticated: input.authenticated }),
    });
    if (!ticket.ok) return ticket;

    return this.storage.upload(ticket.value, input.file);
  }
}
