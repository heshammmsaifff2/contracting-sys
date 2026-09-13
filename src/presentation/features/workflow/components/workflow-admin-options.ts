/**
 * ثوابت تحرير المسار وألوانه — بلا مكوّنات.
 *
 * فُصلت عن النوافذ ليصحّ تبادلها بين الشاشات: ملفّ يصدّر مكوّنًا وثابتًا معًا
 * يُبطل التحديث الساخن في التطوير، ولون السهم يقرؤه المحرّر والقائمة معًا.
 * وهذه الألوان **ليست اختيارًا للواجهة**: النوع يحدّد لونه في القرار ٠٠٠١.
 */
import type { ActionKind } from "@core/modules/workflow/entities/WorkflowAction";
import type { ConditionOp } from "@core/modules/workflow/entities/WorkflowCondition";
import type {
  ParticipantKind,
  StageParticipantDto,
} from "@application/modules/workflow/dtos";
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

/** ما يُختار لمشاركٍ جديد — مبنيٌّ على الأقسام والوظائف. */
export const KIND_OPTIONS: readonly { value: ParticipantKind; label: string }[] = [
  { value: "project_job", label: t.workflowAdmin.kindProjectJob },
  { value: "job", label: t.workflowAdmin.kindJob },
  { value: "department", label: t.workflowAdmin.kindDepartment },
  { value: "user", label: t.workflowAdmin.kindUser },
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

/** ترقيم Postgres لأيام الأسبوع: ٠ الأحد … ٦ السبت. */
export const WEEKDAY_OPTIONS = [
  { value: 6, label: t.workflowAdmin.sat },
  { value: 0, label: t.workflowAdmin.sun },
  { value: 1, label: t.workflowAdmin.mon },
  { value: 2, label: t.workflowAdmin.tue },
  { value: 3, label: t.workflowAdmin.wed },
  { value: 4, label: t.workflowAdmin.thu },
  { value: 5, label: t.workflowAdmin.fri },
];

export const DEADLINE_ACTION_OPTIONS = [
  { value: "notify", label: t.workflowAdmin.deadlineNotify },
  { value: "escalate", label: t.workflowAdmin.deadlineEscalate },
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
    case "job":
      return `${participant.jobName ?? "—"} · ${t.workflowAdmin.companyWide}`;
    case "project_job":
      return (
        `${participant.jobName ?? "—"} · ${t.workflowAdmin.ofProject}` +
        (participant.requiresSign ? ` · ${t.workflowAdmin.signersOnly}` : "")
      );
    case "department":
      return `${t.workflowAdmin.department}: ${participant.departmentName ?? "—"}`;
    case "requester":
      return t.workflowAdmin.kindRequester;
  }
}

/** «السبت والثلاثاء ١٢:٠٠» — يُقرأ على اللوحة بلا فتح النموذج. */
export function deadlineLabel(stage: {
  deadlineSpec: { time: string; days: readonly number[] } | null;
}): string | null {
  const spec = stage.deadlineSpec;
  if (spec === null) return null;
  const days = spec.days.flatMap((d) => {
    const found = WEEKDAY_OPTIONS.find((o) => o.value === d);
    return found === undefined ? [] : [found.label];
  });
  if (days.length === 0) return null;
  return `${days.join(" · ")} ${spec.time}`;
}
