/**
 * صفحة قبول المرحلة صفر: تثبت أن الطبقات مربوطة، وأن الواجهة تقرأ بيانات
 * من use-case محقون عبر DI دون أي معرفة بـ Supabase أو Cloudinary.
 */
import { Card } from "@presentation/shared/ui/Card";
import { Badge } from "@presentation/shared/ui/Badge";
import { Button } from "@presentation/shared/ui/Button";
import { Spinner } from "@presentation/shared/ui/Spinner";
import { EmptyState } from "@presentation/shared/ui/EmptyState";
import { StatusPill } from "@presentation/shared/ui/StatusPill";
import { formatDateTime } from "@presentation/shared/lib/formatters";
import { errorMessage } from "@presentation/shared/lib/query";
import { useSystemInfo } from "../hooks/useSystemInfo";
import { ArchitectureCheck } from "../components/ArchitectureCheck";
import { IdentityCheck } from "../components/IdentityCheck";
import { UploadCheck } from "../components/UploadCheck";
import { t } from "@i18n/index";

export function SetupCheckPage() {
  const { data, isPending, isError, error, refetch } = useSystemInfo();

  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-6">
      <header>
        <h1 className="text-content text-xl font-extrabold">{t.setup.title}</h1>
        <p className="text-content-muted mt-1 text-sm">{t.setup.subtitle}</p>
      </header>

      <Card
        title={t.setup.modules}
        description={t.setup.diSource}
        actions={
          <Button variant="outline" size="sm" onClick={() => void refetch()}>
            {t.common.retry}
          </Button>
        }
      >
        {isPending && <Spinner />}

        {isError && (
          <EmptyState title={t.common.error} description={errorMessage(error)} />
        )}

        {data !== undefined && (
          <div className="flex flex-col gap-4">
            <dl className="grid gap-3 sm:grid-cols-3">
              <div className="bg-surface-sunken rounded-[var(--radius-control)] p-3">
                <dt className="text-content-muted text-xs">{t.setup.environment}</dt>
                <dd className="text-content mt-0.5 text-sm font-medium">
                  {data.environment}
                </dd>
              </div>
              <div className="bg-surface-sunken rounded-[var(--radius-control)] p-3">
                <dt className="text-content-muted text-xs">{t.setup.phase}</dt>
                <dd className="tabular text-content mt-0.5 text-sm font-medium">
                  {data.currentPhase}
                </dd>
              </div>
              <div className="bg-surface-sunken rounded-[var(--radius-control)] p-3">
                <dt className="text-content-muted text-xs">{t.setup.serverTime}</dt>
                <dd className="tabular text-content mt-0.5 text-sm font-medium">
                  {formatDateTime(data.serverTime)}
                </dd>
              </div>
            </dl>

            <ul className="divide-border divide-y">
              {data.modules.map((m) => (
                <li
                  key={m.key}
                  className="flex items-center justify-between gap-3 py-2.5"
                >
                  <span className="text-content text-sm font-medium">{m.nameAr}</span>
                  <span className="flex items-center gap-2">
                    <Badge tone="neutral">
                      {t.setup.modulePhase} {m.phase}
                    </Badge>
                    <Badge tone={m.status === "ready" ? "success" : "neutral"}>
                      {t.status[m.status === "ready" ? "ready" : "planned"]}
                    </Badge>
                  </span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </Card>

      <Card title={t.setup.identity} description={t.setup.identityHint}>
        <IdentityCheck />
      </Card>

      <Card title={t.setup.valueObjects} description={t.setup.architecture}>
        <ArchitectureCheck />
      </Card>

      <Card title={t.setup.designSystem}>
        <div className="flex flex-col gap-4">
          <div className="flex flex-wrap items-center gap-2">
            <Button>{t.common.save}</Button>
            <Button variant="secondary">{t.common.edit}</Button>
            <Button variant="outline">{t.common.search}</Button>
            <Button variant="ghost">{t.common.cancel}</Button>
            <Button variant="danger">{t.common.delete}</Button>
            <Button isLoading>{t.common.loading}</Button>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <StatusPill status="in_progress" />
            <StatusPill status="half_elapsed" label="مرّ نصف المدة" />
            <StatusPill status="near_due" label="مرّ 75٪ من المدة" />
            <StatusPill status="overdue" />
            <StatusPill status="done" />
          </div>
        </div>
      </Card>

      <Card title={t.setup.fileUpload}>
        <UploadCheck />
      </Card>
    </div>
  );
}
