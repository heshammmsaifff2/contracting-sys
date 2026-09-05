import type { DomainError } from "@core/shared/errors/domain-error";
import type { Result } from "@core/shared/result";
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

/**
 * أدوات التشغيل اليومي. كلّها تكتب في الخطّ الزمني نفسه الذي تظهر فيه
 * الإجراءات — لا في سجلّ منفصل لا ينظر إليه أحد.
 */
export interface IOperationsRepository {
  /** زملاء القسم الصالحون لاستلام هذا التكليف. */
  transferTargets(
    assignmentId: string,
  ): Promise<Result<readonly TransferTargetDto[], DomainError>>;
  transferAssignment(input: TransferAssignmentDto): Promise<Result<void, DomainError>>;
  sendAlert(input: SendAlertDto): Promise<Result<void, DomainError>>;
  extendDeadline(input: ExtendDeadlineDto): Promise<Result<void, DomainError>>;
  forceClose(input: ForceCloseDto): Promise<Result<void, DomainError>>;
  mention(input: MentionDto): Promise<Result<{ notified: number }, DomainError>>;

  /** الحجز الحصريّ: أوّل من يعلن أخذها تخرج من صناديق الباقين [المرحلة ٠٧]. */
  claimAssignment(assignmentId: string): Promise<Result<void, DomainError>>;
  releaseClaim(
    assignmentId: string,
    reason: string,
  ): Promise<Result<void, DomainError>>;

  /** الأرشفة على مرحلتين: صاحبها يُودِع، وأمين الأرشيف يقبل أو يردّ. */
  listArchiveQueue(): Promise<Result<readonly ArchiveQueueItemDto[], DomainError>>;
  submitOriginal(
    transactionId: string,
    notes: string,
  ): Promise<Result<void, DomainError>>;
  acceptArchive(input: ArchiveDecisionDto): Promise<Result<void, DomainError>>;
  rejectArchive(input: ArchiveDecisionDto): Promise<Result<void, DomainError>>;
}
