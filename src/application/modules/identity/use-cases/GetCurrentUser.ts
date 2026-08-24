/**
 * يبني صورة المستخدم الحالي: ملفه + صلاحياته + مشاريعه المعتمدة.
 * الصلاحيات والمشاريع تُقرأ من دوال قاعدة البيانات نفسها التي تستخدمها سياسات RLS،
 * فلا يمكن أن تختلف الواجهة عن الخادم.
 */
import type { DomainError } from "@core/shared/errors/domain-error";
import { ok, type Result } from "@core/shared/result";
import { AuthenticatedUser } from "@core/modules/identity/entities/AuthenticatedUser";
import type { UseCase } from "@application/shared/use-case";
import type { IAuthService } from "../ports/auth-service";
import type { IAuthorizationRepository } from "../ports/authorization-repository";
import type { IProfileRepository } from "../ports/profile-repository";

export class GetCurrentUser implements UseCase<void, AuthenticatedUser | null> {
  private readonly auth: IAuthService;
  private readonly profiles: IProfileRepository;
  private readonly authorization: IAuthorizationRepository;

  constructor(
    auth: IAuthService,
    profiles: IProfileRepository,
    authorization: IAuthorizationRepository,
  ) {
    this.auth = auth;
    this.profiles = profiles;
    this.authorization = authorization;
  }

  async execute(): Promise<Result<AuthenticatedUser | null, DomainError>> {
    const session = await this.auth.getSession();
    if (!session.ok) return session;
    if (session.value === null) return ok(null);

    const profile = await this.profiles.findById(session.value.userId);
    if (!profile.ok) return profile;
    if (profile.value === null) return ok(null);

    const permissions = await this.authorization.currentPermissions();
    if (!permissions.ok) return permissions;

    const projectIds = await this.authorization.currentProjectIds();
    if (!projectIds.ok) return projectIds;

    return ok(
      new AuthenticatedUser({
        profile: profile.value,
        permissions: permissions.value,
        assignedProjectIds: projectIds.value,
      }),
    );
  }
}
