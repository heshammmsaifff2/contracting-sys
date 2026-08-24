/**
 * ProjectAssignment — اعتماد موظف على مشروع.
 * هذا الكيان هو التجسيد المباشر للقاعدة الأمنية:
 * «ليس من حق أي أحد التوقيع على شيء يخص مشروعًا هو غير معتمد عليه».
 */
import type { EntityId } from "../../../shared/entities/base-entity";

export interface ProjectAssignmentProps {
  id: EntityId;
  projectId: EntityId;
  userId: EntityId;
  canSign: boolean;
  createdAt: Date;
  createdBy: EntityId | null;
}

export class ProjectAssignment {
  readonly id: EntityId;
  readonly projectId: EntityId;
  readonly userId: EntityId;
  readonly canSign: boolean;
  readonly createdAt: Date;
  readonly createdBy: EntityId | null;

  private constructor(props: ProjectAssignmentProps) {
    this.id = props.id;
    this.projectId = props.projectId;
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
}
