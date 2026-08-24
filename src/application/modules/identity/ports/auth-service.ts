import type { DomainError } from "@core/shared/errors/domain-error";
import type { Result } from "@core/shared/result";
import type { SignInInput } from "../dtos";

/** هوية الجلسة الخام كما يعرفها مزوّد المصادقة — بلا أي منطق أعمال. */
export interface SessionIdentity {
  userId: string;
  email: string | null;
}

export interface IAuthService {
  signIn(input: SignInInput): Promise<Result<SessionIdentity, DomainError>>;
  signOut(): Promise<Result<void, DomainError>>;
  /** الجلسة الحالية إن وُجدت. */
  getSession(): Promise<Result<SessionIdentity | null, DomainError>>;
  /** يُخطر عند تسجيل الدخول أو الخروج أو تجديد الرمز. يعيد دالة إلغاء الاشتراك. */
  onAuthStateChange(listener: (identity: SessionIdentity | null) => void): () => void;
}
