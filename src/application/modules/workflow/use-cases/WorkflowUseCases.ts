/**
 * Use-cases محرّك سير العمل.
 * كل انتقال حالة يقع على الخادم؛ هذه الطبقة تتحقّق من المدخلات وتربط المنافذ.
 */
import type { DomainError } from "@core/shared/errors/domain-error";
import { ConflictError, ValidationError } from "@core/shared/errors/domain-error";
import { err, type Result } from "@core/shared/result";
import type { UseCase } from "@application/shared/use-case";
import type {
  CompleteStepDto,
  DurationChangeDto,
  InboxFilter,
  InboxItemDto,
  SetStepDurationDto,
  StartTransactionDto,
  TransactionBriefDto,
  TransactionDto,
} from "../dtos";
import type { IInboxRepository } from "../ports/inbox-repository";
import type { IWorkflowEngine } from "../ports/workflow-engine";
import type { IWorkflowDefinitionRepository } from "../ports/workflow-definition-repository";

// ── صندوق الوارد ────────────────────────────────────────────────────────
export class ListInbox implements UseCase<InboxFilter, readonly InboxItemDto[]> {
  private readonly inbox: IInboxRepository;

  constructor(inbox: IInboxRepository) {
    this.inbox = inbox;
  }

  async execute(
    input: InboxFilter,
  ): Promise<Result<readonly InboxItemDto[], DomainError>> {
    return this.inbox.list(input);
  }
}

export class GetTransaction implements UseCase<{ id: string }, TransactionDto | null> {
  private readonly inbox: IInboxRepository;

  constructor(inbox: IInboxRepository) {
    this.inbox = inbox;
  }

  async execute(input: {
    id: string;
  }): Promise<Result<TransactionDto | null, DomainError>> {
    return this.inbox.findTransaction(input.id);
  }
}

/** بحث يُظهر المعاملة بلا تفاصيل لغير الموقّعين [المراسلات 19]. */
export class SearchTransactions implements UseCase<
  { query: string },
  readonly TransactionBriefDto[]
> {
  private readonly inbox: IInboxRepository;

  constructor(inbox: IInboxRepository) {
    this.inbox = inbox;
  }

  async execute(input: {
    query: string;
  }): Promise<Result<readonly TransactionBriefDto[], DomainError>> {
    return this.inbox.searchBrief(input.query);
  }
}

// ── انتقالات الحالة ─────────────────────────────────────────────────────
export class StartTransaction implements UseCase<
  StartTransactionDto,
  { transactionId: string }
> {
  private readonly engine: IWorkflowEngine;

  constructor(engine: IWorkflowEngine) {
    this.engine = engine;
  }

  async execute(
    input: StartTransactionDto,
  ): Promise<Result<{ transactionId: string }, DomainError>> {
    if (input.type.trim() === "") {
      return err(new ValidationError("نوع المعاملة مطلوب", { type: "required" }));
    }
    if (input.subject.trim().length < 2) {
      return err(new ValidationError("موضوع المعاملة مطلوب", { subject: "required" }));
    }
    return this.engine.startTransaction(input);
  }
}

export class CompleteStep implements UseCase<
  CompleteStepDto,
  { nextStepInstanceId: string | null }
> {
  private readonly engine: IWorkflowEngine;

  constructor(engine: IWorkflowEngine) {
    this.engine = engine;
  }

  async execute(
    input: CompleteStepDto,
  ): Promise<Result<{ nextStepInstanceId: string | null }, DomainError>> {
    return this.engine.completeStep(input);
  }
}

/**
 * مدير البرنامج يحدّد المدة أو يعدّلها حتى بعد الإنجاز [المراسلات 3، 4].
 * التعديل يُعيد احتساب الدرجة على الخادم ويُسجَّل في تقرير المدد.
 */
export class SetStepDuration implements UseCase<SetStepDurationDto, void> {
  private readonly engine: IWorkflowEngine;

  constructor(engine: IWorkflowEngine) {
    this.engine = engine;
  }

  async execute(input: SetStepDurationDto): Promise<Result<void, DomainError>> {
    if (!Number.isFinite(input.minutes) || input.minutes <= 0) {
      return err(
        new ValidationError("المدة يجب أن تكون أكبر من صفر", { minutes: "invalid" }),
      );
    }
    return this.engine.setStepDuration(input);
  }
}

export interface CloseTransactionInput {
  transactionId: string;
  /** حالة المعاملة كما تعرفها الواجهة — للتحقّق قبل الاتصال. */
  status: TransactionDto["status"];
}

export class CloseTransaction implements UseCase<CloseTransactionInput, void> {
  private readonly engine: IWorkflowEngine;

  constructor(engine: IWorkflowEngine) {
    this.engine = engine;
  }

  async execute(input: CloseTransactionInput): Promise<Result<void, DomainError>> {
    if (input.status !== "awaiting_confirmation") {
      return err(
        new ConflictError("المعاملة لم تصل بعد لمرحلة تأكيد الإنجاز", {
          status: input.status,
        }),
      );
    }
    return this.engine.closeTransaction(input.transactionId);
  }
}

export class CancelTransaction implements UseCase<{ transactionId: string }, void> {
  private readonly engine: IWorkflowEngine;

  constructor(engine: IWorkflowEngine) {
    this.engine = engine;
  }

  async execute(input: { transactionId: string }): Promise<Result<void, DomainError>> {
    return this.engine.cancelTransaction(input.transactionId);
  }
}

// ── تقرير المدد المعدّلة [المراسلات 5] ──────────────────────────────────
export class ListDurationChanges implements UseCase<
  void,
  readonly DurationChangeDto[]
> {
  private readonly definitions: IWorkflowDefinitionRepository;

  constructor(definitions: IWorkflowDefinitionRepository) {
    this.definitions = definitions;
  }

  async execute(): Promise<Result<readonly DurationChangeDto[], DomainError>> {
    return this.definitions.listDurationChanges();
  }
}
