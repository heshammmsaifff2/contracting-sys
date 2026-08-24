/**
 * يطلب توقيعًا مؤقّتًا للرفع المباشر إلى مزوّد التخزين.
 * الواجهة لا تعرف المزوّد ولا تملك api_secret إطلاقًا.
 */
import type { DomainError } from "@core/shared/errors/domain-error";
import { ValidationError } from "@core/shared/errors/domain-error";
import { err, type Result } from "@core/shared/result";
import type {
  IFileStorage,
  UploadTicket,
} from "@application/shared/ports/file-storage";
import type { UseCase } from "@application/shared/use-case";

export interface RequestUploadTicketInput {
  folder: string;
  authenticated?: boolean;
}

/** المجلّدات يجب أن تبقى تحت الجذر erp/ لتنظيم الصلاحيات في المزوّد. */
const FOLDER_PATTERN = /^erp(\/[A-Za-z0-9._-]+)+$/;

export class RequestUploadTicket implements UseCase<
  RequestUploadTicketInput,
  UploadTicket
> {
  private readonly storage: IFileStorage;

  constructor(storage: IFileStorage) {
    this.storage = storage;
  }

  async execute(
    input: RequestUploadTicketInput,
  ): Promise<Result<UploadTicket, DomainError>> {
    if (!FOLDER_PATTERN.test(input.folder)) {
      return err(
        new ValidationError("مسار المجلّد غير صالح، يجب أن يبدأ بـ erp/", {
          folder: "pattern",
        }),
      );
    }

    return this.storage.createUploadTicket({
      folder: input.folder,
      ...(input.authenticated === undefined
        ? {}
        : { authenticated: input.authenticated }),
    });
  }
}
