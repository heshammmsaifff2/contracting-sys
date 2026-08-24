/**
 * جرس الإشعارات — «الإشعار الفوري» الذي تتطلّبه المخازن عند تنزيل الكميات.
 * يُحدَّث دوريًا في الخلفية، فيصل الخبر دون تحديث الصفحة.
 */
import { useEffect, useRef, useState } from "react";
import { Bell } from "lucide-react";
import { Badge } from "@presentation/shared/ui/Badge";
import { Button } from "@presentation/shared/ui/Button";
import { cn } from "@presentation/shared/lib/cn";
import { formatRelative } from "@presentation/shared/lib/formatters";
import { useMarkNotificationsRead, useNotifications } from "../hooks/useNotifications";
import { t } from "@i18n/index";

export function NotificationBell() {
  const notifications = useNotifications();
  const markRead = useMarkNotificationsRead();
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const rows = notifications.data ?? [];
  const unread = rows.filter((row) => !row.isRead).length;

  // الإغلاق بالنقر خارج القائمة أو بمفتاح Escape
  useEffect(() => {
    if (!isOpen) return;

    function handlePointer(event: MouseEvent) {
      if (!containerRef.current?.contains(event.target as Node)) setIsOpen(false);
    }
    function handleKey(event: KeyboardEvent) {
      if (event.key === "Escape") setIsOpen(false);
    }

    document.addEventListener("mousedown", handlePointer);
    document.addEventListener("keydown", handleKey);
    return () => {
      document.removeEventListener("mousedown", handlePointer);
      document.removeEventListener("keydown", handleKey);
    };
  }, [isOpen]);

  return (
    <div ref={containerRef} className="relative">
      <Button
        variant="ghost"
        size="sm"
        aria-label={t.notifications.open}
        aria-expanded={isOpen}
        onClick={() => setIsOpen(!isOpen)}
        startIcon={<Bell aria-hidden className="size-4" />}
      >
        {unread > 0 && <Badge tone="danger">{unread}</Badge>}
      </Button>

      {isOpen && (
        <div
          className={cn(
            "border-border bg-surface absolute end-0 top-11 z-30 w-80 rounded-[var(--radius-card)]",
            "border shadow-lg",
          )}
        >
          <div className="border-border flex items-center justify-between border-b px-4 py-2">
            <span className="text-content text-sm font-bold">
              {t.notifications.title}
            </span>
            {unread > 0 && (
              <Button
                variant="ghost"
                size="sm"
                isLoading={markRead.isPending}
                onClick={() => markRead.mutate([])}
              >
                {t.notifications.markAllRead}
              </Button>
            )}
          </div>

          <ul className="divide-border max-h-96 divide-y overflow-y-auto">
            {rows.map((row) => (
              <li
                key={row.id}
                className={cn("px-4 py-2.5", !row.isRead && "bg-brand-50/60")}
              >
                <div className="flex items-start justify-between gap-2">
                  <span className="text-content text-sm font-medium">{row.title}</span>
                  {!row.isRead && <Badge tone="info">{t.notifications.unread}</Badge>}
                </div>
                <p className="text-content-muted mt-0.5 text-xs">{row.body}</p>
                <p className="text-content-muted mt-1 text-[11px]">
                  {formatRelative(row.createdAt)}
                </p>
              </li>
            ))}
            {rows.length === 0 && (
              <li className="text-content-muted px-4 py-6 text-center text-sm">
                {t.notifications.empty}
              </li>
            )}
          </ul>
        </div>
      )}
    </div>
  );
}
