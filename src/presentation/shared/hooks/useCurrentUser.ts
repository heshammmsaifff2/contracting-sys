import { useAuth } from "@presentation/app/providers/auth-context";
import type { AuthenticatedUser } from "@core/modules/identity/entities/AuthenticatedUser";

/** المستخدم الحالي — يرمي إن استُخدم في شجرة غير محميّة. */
export function useCurrentUser(): AuthenticatedUser {
  const { user } = useAuth();
  if (user === null) {
    throw new Error("useCurrentUser يتطلّب مستخدمًا مسجّل الدخول");
  }
  return user;
}
