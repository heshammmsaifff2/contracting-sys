/**
 * ProjectAssignment — خانة وظيفة على مشروع، يملؤها أحد شاغلي الوظيفة.
 *
 * هذا الكيان هو التجسيد المباشر للقاعدة الأمنية:
 * «ليس من حق أي أحد التوقيع على شيء يخص مشروعًا هو غير معتمد عليه».
 * والخانة الشاغرة (`userId = null`) لا تفتح المشروع لأحد.
 */
import type { EntityId } from "../../../shared/entities/base-entity";

export interface ProjectAssignmentProps {
  id: EntityId;
  projectId: EntityId;
  jobId: EntityId;
  /** null = خانة شاغرة. */
  userId: EntityId | null;
  canSign: boolean;
  createdAt: Date;
  createdBy: EntityId | null;
}

export class ProjectAssignment {
  readonly id: EntityId;
  readonly projectId: EntityId;
  readonly jobId: EntityId;
  readonly userId: EntityId | null;
  readonly canSign: boolean;
  readonly createdAt: Date;
  readonly createdBy: EntityId | null;

  private constructor(props: ProjectAssignmentProps) {
    this.id = props.id;
    this.projectId = props.projectId;
    this.jobId = props.jobId;
    this.userId = props.userId;
    this.canSign = props.canSign;
    this.createdAt = props.createdAt;
    this.createdBy = props.createdBy;
    Object.freeze(this);
  }

  static create(props: ProjectAssignmentProps): ProjectAssignment {
    return new ProjectAssignment(props);
  }

  static restore(props: ProjectAssignmentProps): ProjectAssignment {
    return new ProjectAssignment(props);
  }

  get isVacant(): boolean {
    return this.userId === null;
  }
}
