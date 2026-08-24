/**
 * لوحة المتابعة — أول ما يراه المستخدم بعد الدخول.
 *
 * تجيب عن سؤال واحد: **ما الذي يخصّني الآن؟** لا عن حالة بناء البرنامج.
 * لذلك كل بطاقة هنا مشروطة بصلاحية صاحبها ومقصورة على مشاريعه المعتمدة،
 * وكل رقم فيها قابل للنقر يوصله إلى الشاشة التي يعالجه فيها.
 */
import { Link } from "react-router-dom";
import type { LucideIcon } from "lucide-react";
import {
  AlertTriangle,
  ArrowLeft,
  Bell,
  FolderKanban,
  Inbox,
  Timer,
  UserRound,
} from "lucide-react";
import { Card } from "@presentation/shared/ui/Card";
import { Badge } from "@presentation/shared/ui/Badge";
import { Spinner } from "@presentation/shared/ui/Spinner";
import { EmptyState } from "@presentation/shared/ui/EmptyState";
import { cn } from "@presentation/shared/lib/cn";
import { formatDuration, formatNumber } from "@presentation/shared/lib/formatters";
import { useAuth } from "@presentation/app/providers/auth-context";
import {
  useAnyPermission,
  usePermission,
} from "@presentation/shared/hooks/usePermission";
import { useProjects } from "@presentation/features/projects/hooks/useProjects";
import { useInbox } from "@presentation/features/workflow/hooks/useWorkflow";
import { useNotifications } from "@presentation/features/notifications/hooks/useNotifications";
import { t } from "@i18n/index";

export function DashboardPage() {
  const { user } = useAuth();
  const canSeeInbox = usePermission("transaction.read");
  const canSeeReports = useAnyPermission(["report.read", "report.financial"]);

  const projects = useProjects();
  // بريدي أنا وحدي، وغير المنجَز فقط — هذه لوحة «ما ينتظرني» لا أرشيف
  const inbox = useInbox({ mineOnly: true, openOnly: true });
  const notifications = useNotifications(5);

  const mine = inbox.data ?? [];
  const overdue = mine.filter((item) => item.color === "danger");
  const nearDue = mine.filter((item) => item.color === "warning");
  const unread = (notifications.data ?? []).filter((n) => !n.isRead);

  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-6">
      <header>
        <h1 className="text-content text-xl font-extrabold">
          {t.dashboard.greeting}
          {user !== null ? ` ${user.profile.fullName}` : ""}
        </h1>
        <p className="text-content-muted mt-1 text-sm">{t.dashboard.subtitle}</p>
      </header>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatTile
          icon={FolderKanban}
          label={t.dashboard.myProjects}
          value={projects.isPending ? null : (projects.data ?? []).length}
          to="/projects"
          tone="neutral"
        />
        {canSeeInbox && (
          <>
            <StatTile
              icon={Inbox}
              label={t.dashboard.awaitingMe}
              value={inbox.isPending ? null : mine.length}
              to="/inbox"
              tone={mine.length > 0 ? "brand" : "neutral"}
            />
            <StatTile
              icon={Timer}
              label={t.dashboard.nearDue}
              value={inbox.isPending ? null : nearDue.length}
              to="/inbox"
              tone={nearDue.length > 0 ? "warning" : "neutral"}
            />
            <StatTile
              icon={AlertTriangle}
              label={t.dashboard.overdue}
              value={inbox.isPending ? null : overdue.length}
              to="/inbox"
              tone={overdue.length > 0 ? "danger" : "neutral"}
            />
          </>
        )}
        {!canSeeInbox && (
          <StatTile
            icon={Bell}
            label={t.dashboard.unreadNotifications}
            value={notifications.isPending ? null : unread.length}
            to="/me"
            tone={unread.length > 0 ? "brand" : "neutral"}
          />
        )}
      </div>

      {canSeeInbox && (
        <Card
          title={t.dashboard.awaitingMe}
          description={t.dashboard.awaitingHint}
          actions={
            <Link
              to="/inbox"
              className="text-brand-700 flex items-center gap-1 text-sm hover:underline"
            >
              {t.dashboard.openInbox}
              <ArrowLeft aria-hidden className="size-4" />
            </Link>
          }
        >
          {inbox.isPending ? (
            <div className="p-6">
              <Spinner />
            </div>
          ) : mine.length === 0 ? (
            <EmptyState
              title={t.dashboard.inboxEmpty}
              description={t.dashboard.inboxEmptyHint}
            />
          ) : (
            <ul className="divide-border divide-y">
              {/* الأكثر إلحاحًا أولًا: المتأخّر ثم ما قارب على الانتهاء */}
              {[...overdue, ...nearDue, ...mine.filter((i) => i.color === "info")]
                .slice(0, 6)
                .map((item) => (
                  <li key={item.stepInstanceId}>
                    <Link
                      to={`/transactions/${item.transactionId}`}
                      className="hover:bg-surface-sunken flex items-center justify-between gap-3 px-5 py-3 transition-colors"
                    >
                      <span className="flex min-w-0 flex-col">
                        <span className="text-content truncate text-sm font-medium">
                          {item.subject || item.transactionType}
                        </span>
                        <span className="text-content-muted truncate text-xs">
                          {item.stepName}
                          {item.projectName !== null ? ` · ${item.projectName}` : ""}
                        </span>
                      </span>
                      <Badge
                        tone={
                          item.color === "danger"
                            ? "danger"
                            : item.color === "warning"
                              ? "warning"
                              : item.color === "info"
                                ? "info"
                                : "neutral"
                        }
                      >
                        {item.remainingMinutes === null
                          ? t.dashboard.noDuration
                          : item.remainingMinutes < 0
                            ? `${t.dashboard.lateBy} ${formatDuration(Math.abs(item.remainingMinutes))}`
                            : formatDuration(item.remainingMinutes)}
                      </Badge>
                    </Link>
                  </li>
                ))}
            </ul>
          )}
        </Card>
      )}

      <div className="grid gap-6 lg:grid-cols-2">
        <Card title={t.dashboard.myProjects} description={t.dashboard.projectsHint}>
          {projects.isPending ? (
            <div className="p-6">
              <Spinner />
            </div>
          ) : (projects.data ?? []).length === 0 ? (
            <EmptyState
              title={t.dashboard.noProjects}
              description={t.dashboard.noProjectsHint}
            />
          ) : (
            <ul className="divide-border divide-y">
              {(projects.data ?? []).slice(0, 6).map((project) => (
                <li
                  key={project.id}
                  className="flex items-center justify-between gap-3 px-5 py-3"
                >
                  <span className="flex min-w-0 flex-col">
                    <span className="text-content truncate text-sm font-medium">
                      {project.name}
                    </span>
                    <span className="text-content-muted font-mono text-xs">
                      {project.code}
                    </span>
                  </span>
                  <Badge tone={project.status === "active" ? "success" : "neutral"}>
                    {project.status === "active"
                      ? t.dashboard.projectActive
                      : project.status}
                  </Badge>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card title={t.dashboard.notifications}>
          {notifications.isPending ? (
            <div className="p-6">
              <Spinner />
            </div>
          ) : (notifications.data ?? []).length === 0 ? (
            <EmptyState title={t.dashboard.noNotifications} />
          ) : (
            <ul className="divide-border divide-y">
              {(notifications.data ?? []).map((n) => (
                <li key={n.id} className="flex items-start gap-3 px-5 py-3">
                  <span
                    aria-hidden
                    className={cn(
                      "mt-1.5 size-2 shrink-0 rounded-full",
                      n.isRead ? "bg-border" : "bg-brand-600",
                    )}
                  />
                  <span className="flex min-w-0 flex-col">
                    <span className="text-content truncate text-sm">{n.title}</span>
                    <span className="text-content-muted truncate text-xs">
                      {n.body}
                    </span>
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>

      <Card title={t.dashboard.quickLinks}>
        <div className="flex flex-wrap gap-2 p-5">
          <QuickLink to="/me" icon={UserRound} label={t.nav.selfService} />
          {canSeeInbox && <QuickLink to="/inbox" icon={Inbox} label={t.nav.inbox2} />}
          {canSeeReports && (
            <QuickLink to="/reports" icon={FolderKanban} label={t.nav.reports} />
          )}
        </div>
      </Card>
    </div>
  );
}

// ── بطاقة رقم ──────────────────────────────────────────────────────────
const TILE_TONES = {
  neutral: "border-border bg-surface",
  brand: "border-brand-200 bg-brand-50",
  warning: "border-warning/30 bg-warning-soft",
  danger: "border-danger/25 bg-danger-soft",
} as const;

interface StatTileProps {
  icon: LucideIcon;
  label: string;
  /** null أثناء التحميل — الصفر رقم صادق ويجب ألّا يُخلط به. */
  value: number | null;
  to: string;
  tone: keyof typeof TILE_TONES;
}

function StatTile({ icon: Icon, label, value, to, tone }: StatTileProps) {
  return (
    <Link
      to={to}
      className={cn(
        "flex items-center gap-3 rounded-[var(--radius-card)] border p-4 transition-shadow hover:shadow-sm",
        TILE_TONES[tone],
      )}
    >
      <Icon aria-hidden className="text-content-muted size-5 shrink-0" />
      <span className="flex min-w-0 flex-col">
        <span className="text-content-muted truncate text-xs">{label}</span>
        <span className="tabular text-content text-lg font-bold">
          {value === null ? "…" : formatNumber(value)}
        </span>
      </span>
    </Link>
  );
}

function QuickLink({
  to,
  icon: Icon,
  label,
}: {
  to: string;
  icon: LucideIcon;
  label: string;
}) {
  return (
    <Link
      to={to}
      className="border-border bg-surface hover:bg-surface-sunken flex items-center gap-2 rounded-[var(--radius-control)] border px-3 py-2 text-sm transition-colors"
    >
      <Icon aria-hidden className="size-4" />
      {label}
    </Link>
  );
}
