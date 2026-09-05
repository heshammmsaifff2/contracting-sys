/**
 * Use-cases مرفقات المعاملات.
 *
 * الحذف عمليّتان لا واحدة: صفّ القاعدة ثم الأصل عند المزوّد. وترتيبهما مقصود
 * — القاعدة أولًا، فإن رفضت (مرفق مختوم بإجراء) لم يُحذف الأصل، ولو عُكس
 * الترتيب لضاع الملفّ وبقي السجلّ يشير إلى عدم.
 */
import type { DomainError } from "@core/shared/errors/domain-error";
import { ValidationError } from "@core/shared/errors/domain-error";
import { err, okVoid, type Result } from "@core/shared/result";
import type { IFileStorage } from "@application/shared/ports/file-storage";
import type { UseCase } from "@application/shared/use-case";
import type { AddAttachmentDto, TransactionAttachmentDto } from "../dtos";
import type { IAttachmentRepository } from "../ports/attachment-repository";

export class ListTransactionAttachments implements UseCase<
  { transactionId: string },
  readonly TransactionAttachmentDto[]
> {
  private readonly repo: IAttachmentRepository;

  constructor(repo: IAttachmentRepository) {
    this.repo = repo;
  }

  async execute(input: {
    transactionId: string;
  }): Promise<Result<readonly TransactionAttachmentDto[], DomainError>> {
    return this.repo.list(input.transactionId);
  }
}

export class AddTransactionAttachment implements UseCase<
  AddAttachmentDto,
  { id: string }
> {
  private readonly repo: IAttachmentRepository;

  constructor(repo: IAttachmentRepository) {
    this.repo = repo;
  }

  async execute(input: AddAttachmentDto): Promise<Result<{ id: string }, DomainError>> {
    if (input.name.trim() === "") {
      return err(new ValidationError("اسم المرفق مطلوب", { name: "required" }));
    }
    if (input.file.publicId.trim() === "" || input.file.url.trim() === "") {
      return err(new ValidationError("لم يكتمل رفع الملف", { file: "incomplete" }));
    }
    if (input.visibility === "department" && input.departmentId === null) {
      return err(new ValidationError("اختر القسم", { departmentId: "required" }));
    }
    if (
      input.visibility === "permission" &&
      (input.requiredPermission ?? "").trim() === ""
    ) {
      return err(
        new ValidationError("اختر الصلاحية", { requiredPermission: "required" }),
      );
    }
    return this.repo.add(input);
  }
}

/**
 * يحذف الصفّ ثم الأصل. فشل حذف الأصل لا يُفشل العملية: الصفّ زال، والملفّ
 * اليتيم يُنظَّف لاحقًا — أهون من صفٍّ يشير إلى ملفّ محذوف.
 */
export class RemoveTransactionAttachment implements UseCase<{ id: string }, void> {
  private readonly repo: IAttachmentRepository;
  private readonly storage: IFileStorage;

  constructor(repo: IAttachmentRepository, storage: IFileStorage) {
    this.repo = repo;
    this.storage = storage;
  }

  async execute(input: { id: string }): Promise<Result<void, DomainError>> {
    const removed = await this.repo.remove(input.id);
    if (!removed.ok) return removed;

    if (removed.value !== null) {
      await this.storage.remove(removed.value.publicId);
    }
    return okVoid();
  }
}

/** مجلّد Cloudinary المنظَّم للمعاملة — اصطلاح المشروع: erp/{وحدة}/{معرّف}. */
export function transactionAttachmentFolder(transactionId: string): string {
  return `erp/transactions/${transactionId}`;
}
