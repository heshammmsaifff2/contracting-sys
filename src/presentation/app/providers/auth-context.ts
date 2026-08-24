import { createContext, useContext } from "react";
import type { AuthenticatedUser } from "@core/modules/identity/entities/AuthenticatedUser";

export interface AuthContextValue {
  /** null = غير مسجّل الدخول أو ملفه غير موجود. */
  user: AuthenticatedUser | null;
  isLoading: boolean;
  /** يُعاد تحميل الصلاحيات والمشاريع بعد أي تغيير عليها. */
  refresh: () => Promise<void>;
}

export const AuthContext = createContext<AuthContextValue | null>(null);

export function useAuth(): AuthContextValue {
  const value = useContext(AuthContext);
  if (value === null) {
    throw new Error("useAuth يجب أن يُستخدم داخل <AuthProvider>");
  }
  return value;
}
