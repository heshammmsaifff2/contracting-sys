/**
 * Use-cases أدوات التشغيل اليومي.
 *
 * كل فعل هنا يترك أثرًا: سببًا مكتوبًا وسطرًا في الخطّ الزمني. فالتحقّق من
 * السبب ليس تشدُّدًا — هو ما يجعل الفعل قابلًا للمراجعة بعد شهر.
 */
import type { DomainError } from "@core/shared/errors/domain-error";
import { ValidationError } from "@core/shared/errors/domain-error";
import { err, type Result } from "@core/shared/result";
import type { UseCase } from "@application/shared/use-case";
import type {
  ArchiveDecisionDto,
  ArchiveQueueItemDto,
  ExtendDeadlineDto,
  ForceCloseDto,
  MentionDto,
  SendAlertDto,
  TransferAssignmentDto,
  TransferTargetDto,
} from "../dtos";
import type { IOperationsRepository } from "../ports/operations-repository";

function requireReason(
  reason: string,
  message: string,
): Result<void, ValidationError> | null {
  if (reason.trim() === "") {
    return err(new ValidationError(message, { reason: "required" }));
  }
  return null;
}

export class ListTransferTargets implements UseCase<
  { assignmentId: string },
  readonly TransferTargetDto[]
> {
  private readonly repo: IOperationsRepository;

  constructor(repo: IOperationsRepository) {
    this.repo = repo;
  }

  async execute(input: {
    assignmentId: string;
  }): Promise<Result<readonly TransferTargetDto[], DomainError>> {
    return this.repo.transferTargets(input.assignmentId);
  }
}

/** التحويل لزميل في القسم نفسه — بعدّاد جديد لا يرث وقت سلفه. */
export class TransferAssignment implements UseCase<TransferAssignmentDto, void> {
  private readonly repo: IOperationsRepository;

  constructor(repo: IOperationsRepository) {
    this.repo = repo;
  }

  async execute(input: TransferAssignmentDto): Promise<Result<void, DomainError>> {
    const invalid = requireReason(input.reason, "سبب التحويل مطلوب");
    if (invalid !== null) return invalid;
    if (input.toUserId.trim() === "") {
      return err(new ValidationError("اختر المحوَّل إليه", { toUserId: "required" }));
    }
    return this.repo.transferAssignment(input);
  }
}

/** التذكير لا أثر له، والتحذير الرسمي يُخصَم من الدرجة — فسببه إلزامي. */
export class SendAssignmentAlert implements UseCase<SendAlertDto, void> {
  private readonly repo: IOperationsRepository;

  constructor(repo: IOperationsRepository) {
    this.repo = repo;
  }

  async execute(input: SendAlertDto): Promise<Result<void, DomainError>> {
    if (input.kind === "warning") {
      const invalid = requireReason(input.reason, "التحذير الرسمي يتطلّب سببًا");
      if (invalid !== null) return invalid;
    }
    return this.repo.sendAlert(input);
  }
}

/**
 * مدّ المهلة لا يُحفَظ للمرات القادمة — بخلاف تعديل المدة.
 * فالاستثناء يبقى استثناءً ولا يصير قاعدةً بلا قصد.
 */
export class ExtendAssignmentDeadline implements UseCase<ExtendDeadlineDto, void> {
  private readonly repo: IOperationsRepository;

  constructor(repo: IOperationsRepository) {
    this.repo = repo;
  }

  async execute(input: ExtendDeadlineDto): Promise<Result<void, DomainError>> {
    if (!Number.isFinite(input.extraMinutes) || input.extraMinutes <= 0) {
      return err(
        new ValidationError("المدّة المضافة يجب أن تكون أكبر من صفر", {
          extraMinutes: "invalid",
        }),
      );
    }
    const invalid = requireReason(input.reason, "سبب المدّ مطلوب");
    if (invalid !== null) return invalid;

    return this.repo.extendDeadline(input);
  }
}

/** الإغلاق الإداري: يُعلَّم فلا يُحتسب إنجازًا في التقارير. */
export class ForceCloseTransaction implements UseCase<ForceCloseDto, void> {
  private readonly repo: IOperationsRepository;

  constructor(repo: IOperationsRepository) {
    this.repo = repo;
  }

  async execute(input: ForceCloseDto): Promise<Result<void, DomainError>> {
    const invalid = requireReason(input.reason, "سبب الإغلاق الإجباري مطلوب");
    if (invalid !== null) return invalid;
    return this.repo.forceClose(input);
  }
}

export class MentionInTransaction implements UseCase<MentionDto, { notified: number }> {
  private readonly repo: IOperationsRepository;

  constructor(repo: IOperationsRepository) {
    this.repo = repo;
  }

  async execute(input: MentionDto): Promise<Result<{ notified: number }, DomainError>> {
    if (input.userIds.length === 0) {
      return err(new ValidationError("اختر من تشير إليه", { userIds: "required" }));
    }
    return this.repo.mention(input);
  }
}

// ── حسم التكليف عند تعدّد المؤهَّلين [المرحلة ٠٧] ────────────────────────
/**
 * الحجز إعلانٌ لا إجراء: تحت السياسة الحصريّة تخرج المرحلة من صناديق بقيّة
 * المؤهَّلين، فلا يقرأ عشرةٌ الملفَّ نفسه ليعمله واحد.
 */
export class ClaimAssignment implements UseCase<{ assignmentId: string }, void> {
  private readonly repo: IOperationsRepository;

  constructor(repo: IOperationsRepository) {
    this.repo = repo;
  }

  async execute(input: { assignmentId: string }): Promise<Result<void, DomainError>> {
    return this.repo.claimAssignment(input.assignmentId);
  }
}

/** إطلاق الحجز فتعود إلى صناديق الباقين — بلا سبب إلزاميّ: التراجع ليس تدخّلًا. */
export class ReleaseAssignmentClaim implements UseCase<
  { assignmentId: string; reason: string },
  void
> {
  private readonly repo: IOperationsRepository;

  constructor(repo: IOperationsRepository) {
    this.repo = repo;
  }

  async execute(input: {
    assignmentId: string;
    reason: string;
  }): Promise<Result<void, DomainError>> {
    return this.repo.releaseClaim(input.assignmentId, input.reason);
  }
}

// ── الأرشفة على مرحلتين [المرحلة ٠٧] ────────────────────────────────────
export class ListArchiveQueue implements UseCase<void, readonly ArchiveQueueItemDto[]> {
  private readonly repo: IOperationsRepository;

  constructor(repo: IOperationsRepository) {
    this.repo = repo;
  }

  async execute(): Promise<Result<readonly ArchiveQueueItemDto[], DomainError>> {
    return this.repo.listArchiveQueue();
  }
}

/** الإيداع: صاحب المعاملة يُقرّ أنه سلّم الأصل الورقيّ. */
export class SubmitTransactionOriginal implements UseCase<
  { transactionId: string; notes: string },
  void
> {
  private readonly repo: IOperationsRepository;

  constructor(repo: IOperationsRepository) {
    this.repo = repo;
  }

  async execute(input: {
    transactionId: string;
    notes: string;
  }): Promise<Result<void, DomainError>> {
    return this.repo.submitOriginal(input.transactionId, input.notes);
  }
}

/** القبول: موضع الحفظ إلزاميّ — أرشفةٌ بلا موضع إقرارٌ لا أثر له. */
export class AcceptTransactionArchive implements UseCase<ArchiveDecisionDto, void> {
  private readonly repo: IOperationsRepository;

  constructor(repo: IOperationsRepository) {
    this.repo = repo;
  }

  async execute(input: ArchiveDecisionDto): Promise<Result<void, DomainError>> {
    const invalid = requireReason(input.text, "موضع الحفظ مطلوب (رقم الملفّ أو الرفّ)");
    if (invalid !== null) return invalid;
    return this.repo.acceptArchive(input);
  }
}

/** الردّ: «لم يصلني» بسبب مكتوب — وهذا هو ما تشتريه المرحلتان. */
export class RejectTransactionArchive implements UseCase<ArchiveDecisionDto, void> {
  private readonly repo: IOperationsRepository;

  constructor(repo: IOperationsRepository) {
    this.repo = repo;
  }

  async execute(input: ArchiveDecisionDto): Promise<Result<void, DomainError>> {
    const invalid = requireReason(input.text, "سبب الردّ مطلوب");
    if (invalid !== null) return invalid;
    return this.repo.rejectArchive(input);
  }
}
