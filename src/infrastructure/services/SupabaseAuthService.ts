import type { DomainError } from "@core/shared/errors/domain-error";
import {
  DomainError as BaseDomainError,
  toDomainError,
} from "@core/shared/errors/domain-error";
import { err, ok, okVoid, type Result } from "@core/shared/result";
import type {
  IAuthService,
  SessionIdentity,
} from "@application/modules/identity/ports/auth-service";
import type { SignInInput } from "@application/modules/identity/dtos";
import type { AppSupabaseClient } from "../supabase/client";

export class SupabaseAuthService implements IAuthService {
  private readonly client: AppSupabaseClient;

  constructor(client: AppSupabaseClient) {
    this.client = client;
  }

  async signIn(input: SignInInput): Promise<Result<SessionIdentity, DomainError>> {
    try {
      const { data, error } = await this.client.auth.signInWithPassword({
        email: input.email,
        password: input.password,
      });

      if (error) {
        // لا نكشف أي الحقلين خاطئ — حماية من تعداد الحسابات
        return err(
          new BaseDomainError("UNAUTHENTICATED", "بيانات الدخول غير صحيحة", {
            cause: error.message,
          }),
        );
      }
      if (!data.user) {
        return err(new BaseDomainError("UNAUTHENTICATED", "تعذّر إنشاء الجلسة"));
      }

      return ok({ userId: data.user.id, email: data.user.email ?? null });
    } catch (e) {
      return err(toDomainError(e, "تعذّر الاتصال بخادم المصادقة"));
    }
  }

  async signOut(): Promise<Result<void, DomainError>> {
    try {
      const { error } = await this.client.auth.signOut();
      if (error) {
        return err(
          new BaseDomainError("UNEXPECTED", "تعذّر تسجيل الخروج", {
            cause: error.message,
          }),
        );
      }
      return okVoid();
    } catch (e) {
      return err(toDomainError(e, "تعذّر تسجيل الخروج"));
    }
  }

  async getSession(): Promise<Result<SessionIdentity | null, DomainError>> {
    try {
      const { data, error } = await this.client.auth.getSession();
      if (error) {
        return err(
          new BaseDomainError("UNEXPECTED", "تعذّر قراءة الجلسة", {
            cause: error.message,
          }),
        );
      }
      const user = data.session?.user;
      if (!user) return ok(null);

      return ok({ userId: user.id, email: user.email ?? null });
    } catch (e) {
      return err(toDomainError(e, "تعذّر قراءة الجلسة"));
    }
  }

  onAuthStateChange(listener: (identity: SessionIdentity | null) => void): () => void {
    const { data } = this.client.auth.onAuthStateChange((_event, session) => {
      const user = session?.user;
      listener(user ? { userId: user.id, email: user.email ?? null } : null);
    });

    return () => data.subscription.unsubscribe();
  }
}
