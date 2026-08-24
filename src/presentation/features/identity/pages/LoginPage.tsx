import { useState, type FormEvent } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { LogIn } from "lucide-react";
import { useContainer } from "@presentation/app/providers/di-context";
import { useAuth } from "@presentation/app/providers/auth-context";
import { Button } from "@presentation/shared/ui/Button";
import { Input } from "@presentation/shared/ui/Input";
import { FormField } from "@presentation/shared/ui/FormField";
import { Spinner } from "@presentation/shared/ui/Spinner";
import { APP_NAME } from "@config/app";
import { t } from "@i18n/index";

interface LocationState {
  from?: string;
}

export function LoginPage() {
  const container = useContainer();
  const { user, isLoading, refresh } = useAuth();
  const location = useLocation();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (isLoading) {
    return (
      <div className="bg-surface-muted grid min-h-screen place-items-center">
        <Spinner />
      </div>
    );
  }

  if (user !== null) {
    const state = location.state as LocationState | null;
    return <Navigate to={state?.from ?? "/"} replace />;
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setIsSubmitting(true);

    const result = await container.useCases.signIn.execute({ email, password });

    if (!result.ok) {
      setError(result.error.message);
      setIsSubmitting(false);
      return;
    }

    await refresh();
    setIsSubmitting(false);
  }

  return (
    <div className="bg-surface-muted grid min-h-screen place-items-center px-4">
      <div className="border-border bg-surface w-full max-w-sm border p-6 shadow-sm">
        <div className="mb-6 text-center">
          <h1 className="text-content text-lg font-extrabold">{APP_NAME}</h1>
          <p className="text-content-muted mt-1 text-sm">{t.auth.loginSubtitle}</p>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <FormField label={t.auth.email} required>
            {(id) => (
              <Input
                id={id}
                type="email"
                autoComplete="username"
                dir="ltr"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            )}
          </FormField>

          <FormField label={t.auth.password} required>
            {(id) => (
              <Input
                id={id}
                type="password"
                autoComplete="current-password"
                dir="ltr"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            )}
          </FormField>

          {error !== null && (
            <p role="alert" className="text-danger text-sm">
              {error}
            </p>
          )}

          <Button
            type="submit"
            isLoading={isSubmitting}
            startIcon={<LogIn aria-hidden className="size-4" />}
          >
            {isSubmitting ? t.auth.signingIn : t.auth.signIn}
          </Button>
        </form>
      </div>
    </div>
  );
}
