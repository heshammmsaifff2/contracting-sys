/**
 * AuthenticatedUser — المستخدم الحالي كما تراه الواجهة:
 * ملفه، صلاحياته، والمشاريع المعتمد عليها.
 * كل قرارات الإظهار/الإخفاء في الواجهة تُبنى على هذا الكيان،
 * مع التذكير أن الأمان الحقيقي في RLS لا هنا.
 */
import type { EntityId } from "../../../shared/entities/base-entity";
import type { Profile } from "./Profile";

export interface AuthenticatedUserProps {
  profile: Profile;
  permissions: readonly string[];
  assignedProjectIds: readonly EntityId[];
}

export class AuthenticatedUser {
  readonly profile: Profile;
  private readonly permissionSet: ReadonlySet<string>;
  private readonly projectSet: ReadonlySet<EntityId>;

  constructor(props: AuthenticatedUserProps) {
    this.profile = props.profile;
    this.permissionSet = new Set(props.permissions);
    this.projectSet = new Set(props.assignedProjectIds);
    Object.freeze(this);
  }

  get id(): EntityId {
    return this.profile.id;
  }

  get permissions(): readonly string[] {
    return [...this.permissionSet];
  }

  get assignedProjectIds(): readonly EntityId[] {
    return [...this.projectSet];
  }

  /** الموظف المعطَّل لا يملك أي صلاحية مهما كانت أدواره. */
  can(permissionKey: string): boolean {
    return this.profile.canOperate && this.permissionSet.has(permissionKey);
  }

  canAny(permissionKeys: readonly string[]): boolean {
    return permissionKeys.some((key) => this.can(key));
  }

  canAll(permissionKeys: readonly string[]): boolean {
    return permissionKeys.every((key) => this.can(key));
  }

  /** هل هذا المشروع ضمن المشاريع المعتمد عليها؟ */
  isAssignedTo(projectId: EntityId): boolean {
    return this.profile.canOperate && this.projectSet.has(projectId);
  }

  /** يرى كل المشاريع أم المعتمدة فقط؟ */
  get seesAllProjects(): boolean {
    return this.can("project.read_all");
  }
}
