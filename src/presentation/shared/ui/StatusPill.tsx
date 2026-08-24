import { Badge } from "./Badge";
import {
  LABEL_BY_STATUS,
  TONE_BY_STATUS,
  type WorkflowStatus,
} from "../lib/workflow-status";

export type { WorkflowStatus };

export interface StatusPillProps {
  status: WorkflowStatus;
  /** نص بديل عند الحاجة لتسمية أدق (مثل حالة مستند بعينه). */
  label?: string;
}

/** شارة حالة معاملة — الألوان تأتي من منطق سير العمل الموحّد. */
export function StatusPill({ status, label }: StatusPillProps) {
  return (
    <Badge tone={TONE_BY_STATUS[status]}>{label ?? LABEL_BY_STATUS[status]}</Badge>
  );
}
