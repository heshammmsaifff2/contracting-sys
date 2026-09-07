/**
 * ثوابت تحرير المسار وألوانه — بلا مكوّنات.
 *
 * فُصلت عن النوافذ ليصحّ تبادلها بين الشاشات: ملفّ يصدّر مكوّنًا وثابتًا معًا
 * يُبطل التحديث الساخن في التطوير، ولون السهم يقرؤه المحرّر والقائمة معًا.
 * وهذه الألوان **ليست اختيارًا للواجهة**: النوع يحدّد لونه في القرار ٠٠٠١.
 */
import type { ActionKind } from "@core/modules/workflow/entities/WorkflowAction";
import type { ConditionOp } from "@core/modules/workflow/entities/WorkflowCondition";
import type { StageParticipantDto } from "@application/modules/workflow/dtos";
import { t } from "@i18n/index";

/** لون السهم على اللوحة — forward أخضر · backward أحمر · closure بنّي · final كحلي. */
export const EDGE_COLORS: Record<ActionKind, string> = {
  forward: "var(--color-success)",
  backward: "var(--color-danger)",
  note: "var(--color-content-muted)",
  closure: "var(--color-warning)",
  final: "var(--color-info)",
};

export const POLICY_OPTIONS = [
  { value: "all", label: t.workflowAdmin.policyAll },
  { value: "any", label: t.workflowAdmin.policyAny },
  { value: "quorum", label: t.workflowAdmin.policyQuorum },
];

// `department_role` مدعوم في المحرّك، ويظهر هنا حين تُضاف شاشة الأقسام
export const KIND_OPTIONS = [
  { value: "user", label: t.workflowAdmin.kindUser },
  { value: "project_role", label: t.workflowAdmin.kindProjectRole },
  { value: "role", label: t.workflowAdmin.kindRole },
  { value: "requester", label: t.workflowAdmin.kindRequester },
];

export const JOIN_OPTIONS = [
  { value: "none", label: t.workflowAdmin.joinNone },
  { value: "wait_all", label: t.workflowAdmin.joinWaitAll },
];

export const CLAIM_OPTIONS = [
  { value: "none", label: t.workflowAdmin.claimNone },
  { value: "exclusive", label: t.workflowAdmin.claimExclusive },
];

export const CONFLICT_OPTIONS = [
  { value: "backward_wins", label: t.workflowAdmin.conflictBackward },
  { value: "first_wins", label: t.workflowAdmin.conflictFirst },
  { value: "last_wins", label: t.workflowAdmin.conflictLast },
];

export const ACTION_KIND_OPTIONS = [
  { value: "forward", label: t.workflowAdmin.kindForward },
  { value: "backward", label: t.workflowAdmin.kindBackward },
  { value: "note", label: t.workflowAdmin.kindNote },
  { value: "closure", label: t.workflowAdmin.kindClosure },
  { value: "final", label: t.workflowAdmin.kindFinal },
];

export const ACTION_KIND_TONES: Record<
  ActionKind,
  "success" | "danger" | "neutral" | "warning" | "info"
> = {
  forward: "success",
  backward: "danger",
  note: "neutral",
  closure: "warning",
  final: "info",
};

// اللغة مغلقة: هذه كل المعاملات المسموحة، لا تُوسَّع من الواجهة
export const OP_OPTIONS: readonly { value: ConditionOp; label: string }[] = [
  { value: "eq", label: "يساوي" },
  { value: "ne", label: "لا يساوي" },
  { value: "gt", label: "أكبر من" },
  { value: "gte", label: "أكبر من أو يساوي" },
  { value: "lt", label: "أصغر من" },
  { value: "lte", label: "أصغر من أو يساوي" },
  { value: "in", label: "ضمن" },
  { value: "not_in", label: "ليس ضمن" },
  { value: "is_null", label: "غير محدَّد" },
  { value: "is_not_null", label: "محدَّد" },
];
export function participantLabel(participant: StageParticipantDto): string {
  switch (participant.kind) {
    case "user":
      return participant.userName ?? "—";
    case "role":
      return `${t.workflowAdmin.role}: ${participant.roleName ?? "—"}`;
    case "project_role":
      return (
        `${participant.roleName ?? "—"} · ${t.workflowAdmin.ofProject}` +
        (participant.requiresSign ? ` · ${t.workflowAdmin.signersOnly}` : "")
      );
    case "department_role":
      return `${participant.roleName ?? "—"} · ${participant.departmentName ?? "—"}`;
    case "requester":
      return t.workflowAdmin.kindRequester;
  }
}
