/**
 * CountdownBadge — العدّاد التنازلي بلون الحالة.
 * الزمن محسوب على الخادم داخل مواعيد العمل: ما يمرّ ليلًا أو في إجازة
 * لا يُنقص من المتبقّي [المراسلات 3، 7]. اللون يتبع القاعدة الملزَمة
 * [المراسلات 25]: أخضر منجَزة · أزرق نصف المدة · أصفر 75٪ · أحمر انتهت.
 */
import { Clock, CheckCircle2, AlertTriangle, HelpCircle } from "lucide-react";
import type { InboxColor } from "@core/modules/workflow/entities/StepInstance";
import { Badge, type BadgeTone } from "./Badge";
import { formatDuration } from "../lib/formatters";
import { t } from "@i18n/index";

const TONE_BY_COLOR: Record<InboxColor, BadgeTone> = {
  neutral: "neutral",
  info: "info",
  warning: "warning",
  danger: "danger",
  success: "success",
};

export interface CountdownBadgeProps {
  color: InboxColor;
  /** المتبقّي بدقائق العمل — سالب يعني تجاوز المدة. */
  remainingMinutes: number | null;
  /** لم تُحدَّد المدة بعد ⇒ العدّاد لم يبدأ. */
  awaitingDuration?: boolean;
  isDone?: boolean;
}

export function CountdownBadge({
  color,
  remainingMinutes,
  awaitingDuration = false,
  isDone = false,
}: CountdownBadgeProps) {
  if (awaitingDuration) {
    return (
      <Badge tone="neutral">
        <HelpCircle aria-hidden className="size-3.5" />
        {t.inbox.awaitingDuration}
      </Badge>
    );
  }

  if (isDone) {
    return (
      <Badge tone="success">
        <CheckCircle2 aria-hidden className="size-3.5" />
        {t.inbox.completed}
      </Badge>
    );
  }

  if (remainingMinutes === null) {
    return (
      <Badge tone="neutral">
        <Clock aria-hidden className="size-3.5" />—
      </Badge>
    );
  }

  const isOverdue = remainingMinutes < 0;

  return (
    <Badge tone={TONE_BY_COLOR[color]}>
      {isOverdue ? (
        <AlertTriangle aria-hidden className="size-3.5" />
      ) : (
        <Clock aria-hidden className="size-3.5" />
      )}
      <span className="tabular">
        {isOverdue
          ? `${t.inbox.overdue} ${formatDuration(Math.abs(remainingMinutes))}`
          : formatDuration(remainingMinutes)}
      </span>
    </Badge>
  );
}
