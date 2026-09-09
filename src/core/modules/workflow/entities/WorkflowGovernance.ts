/**
 * WorkflowGovernance — أسئلة «من يملك ماذا، ومتى يجوز أن يتغيّر».
 *
 * ثلاث دورات حياة صغيرة، كلٌّ منها انتقالاتها معدودة: إصدار المسار،
 * وحجز التكليف، وأرشفة الأصل. جُمعت هنا لأنها تتكرّر في الواجهة كلها،
 * ونسخُها في كل شاشة يعني أن تتباعد الشاشات في أول تعديل.
 *
 * نقيّة: لا تعرف React ولا Supabase — نسخة مطابقة لما تفرضه القاعدة.
 */

// ── إصدار المسار ────────────────────────────────────────────────────────
export type DefinitionStatus = "draft" | "published" | "retired";

/**
 * المسودّة وحدها تُعدَّل.
 *
 * تعديل المنشور يغيّر توجيه معاملاتٍ سائرة: نسخة المرحلة تحمل لقطتها، لكن
 * **الوجهة** تُقرأ من التعريف لحظة الإنجاز. فمعاملة بدأت بمسار تنتهي بآخر
 * لم يوافق عليه أحد.
 */
export function isDefinitionEditable(status: DefinitionStatus): boolean {
  return status === "draft";
}

/**
 * الموضع على اللوحة عرضٌ لا تعريف — يُحرَّك في أي إصدار، **والمتقاعد منها**.
 *
 * كان المتقاعد مستثنًى، وهو الأحوج: خريطته هي ما يُقرأ حين يُراجَع أثر
 * معاملة قديمة، وقراءتها وهي كومة لا تُفيد. والقاعدة لا تمنعه أصلًا —
 * `set_stage_positions` لا تسأل عن الحالة، و`guard_definition_frozen`
 * يستثني `pos_x`/`pos_y` من التجميد. فكان المنع في الواجهة وحدها بلا سند.
 */
export function canMoveNodes(_status: DefinitionStatus): boolean {
  return true;
}

export function isDefinitionLive(status: DefinitionStatus, isActive: boolean): boolean {
  return status === "published" && isActive;
}

/**
 * ثوابت النشر — نسخة مطابقة لما يفرضه `publish_workflow_version`.
 *
 * هذه ليست فحص الرسم الكامل (الوصول والحلقات) الذي في `WorkflowGraph`:
 * ذاك مساعدة تأليف تنبّه ولا تمنع، وهذه أربعة شروط **تمنع** — والقاعدة
 * تفرضها على كل حال، فلا تُنشَر مسودّة معطوبة بتجاوز الواجهة.
 */
export type PublishBlocker =
  "no_start" | "no_final" | "stage_without_participants" | "action_without_route";

export interface PublishCandidateStage {
  readonly name: string;
  readonly isStart: boolean;
  readonly isFinal: boolean;
  readonly participants: readonly unknown[];
  readonly actions: readonly {
    readonly label: string;
    readonly kind: string;
    readonly routes: readonly unknown[];
  }[];
}

export interface PublishBlock {
  readonly code: PublishBlocker;
  readonly subject: string;
}

export function publishBlockers(
  stages: readonly PublishCandidateStage[],
): readonly PublishBlock[] {
  const blocks: PublishBlock[] = [];

  if (!stages.some((stage) => stage.isStart)) {
    blocks.push({ code: "no_start", subject: "" });
  }
  if (!stages.some((stage) => stage.isFinal)) {
    blocks.push({ code: "no_final", subject: "" });
  }

  for (const stage of stages) {
    // النهائية ليست استثناءً: المحرّك يفتحها كغيرها، وبلا مؤهَّل تقف
    // `pending` فلا تُغلق المعاملة أبدًا.
    if (stage.participants.length === 0) {
      blocks.push({ code: "stage_without_participants", subject: stage.name });
    }
    for (const action of stage.actions) {
      if (
        action.kind !== "note" &&
        action.kind !== "final" &&
        action.routes.length === 0
      ) {
        blocks.push({ code: "action_without_route", subject: action.label });
      }
    }
  }

  return blocks;
}

export function canPublish(stages: readonly PublishCandidateStage[]): boolean {
  return stages.length > 0 && publishBlockers(stages).length === 0;
}

// ── حجز التكليف ─────────────────────────────────────────────────────────
export type ClaimPolicy = "none" | "exclusive";

export interface ClaimState {
  readonly status: string;
  readonly claimedAt: Date | string | null;
  readonly claimPolicy: ClaimPolicy;
}

/** المتاح للحجز: مؤهَّل، لم يحجزه، ولم يحجزه غيره. */
export function canClaim(state: ClaimState): boolean {
  return (
    state.claimPolicy === "exclusive" &&
    state.claimedAt === null &&
    state.status === "in_progress"
  );
}

/** الإطلاق لصاحب الحجز ما لم يكن قد أنجز؛ ومن يملك التحويل يطلق حجز غيره. */
export function canRelease(state: ClaimState, isOwner: boolean, canTransfer: boolean) {
  return (
    state.claimPolicy === "exclusive" &&
    state.claimedAt !== null &&
    state.status !== "done" &&
    (isOwner || canTransfer)
  );
}

/** محجوزة عند زميل: تُعرَض ولا تُعمَل. */
export function isHeldByColleague(state: ClaimState): boolean {
  return state.status === "on_hold";
}

// ── الأرشفة على مرحلتين ─────────────────────────────────────────────────
export type ArchiveState = "none" | "submitted" | "archived";

/**
 * الإيداع بعد الإغلاق وحده: إيداع أصل معاملةٍ ما تزال تسير يعني أن الورقة
 * غادرت وهي مطلوبة.
 */
export function canSubmitOriginal(
  archiveState: ArchiveState,
  isClosed: boolean,
): boolean {
  return isClosed && archiveState === "none";
}

/** القبول والردّ كلاهما على المُودَع وحده — لأمين الأرشيف. */
export function canDecideArchive(archiveState: ArchiveState): boolean {
  return archiveState === "submitted";
}

/** ما زال على الطابور: أُغلق ولم يصل أصله. */
export function isArchivePending(
  archiveState: ArchiveState,
  isClosed: boolean,
): boolean {
  return isClosed && archiveState !== "archived";
}

// ── شروط الجاهزية ───────────────────────────────────────────────────────
export type RequirementKind = "condition" | "attachment";

/** `advancing` = التقدّم وحده؛ الإرجاع معفى لأن النقص سببُ الردّ لا مانعُه. */
export type RequirementScope = "advancing" | "any_action";

export function requirementAppliesTo(
  scope: RequirementScope,
  actionKind: string,
): boolean {
  return scope === "any_action" || actionKind !== "backward";
}
