/**
 * WorkflowAction — زرّ على مرحلة.
 *
 * النوع يحدّد اللون والسلوك، ولا يُقرَّر في الواجهة:
 *   forward  أخضر  انتقال للمرحلة التالية
 *   backward أحمر  إرجاع أو رفض لمرحلة سابقة
 *   note     رمادي ملاحظة أو مرفق بلا تحريك المرحلة
 *   closure  بنّي  انتقال لمرحلة الإغلاق
 *   final    كحلي  إغلاق نهائي للمسار
 */
export type ActionKind = "forward" | "backward" | "note" | "closure" | "final";

export const ACTION_KINDS: readonly ActionKind[] = [
  "forward",
  "backward",
  "note",
  "closure",
  "final",
];

/** لا يحمل وجهة: الملاحظة لا تحرّك المرحلة، والنهائي يغلق المسار. */
export function actionCarriesRoutes(kind: ActionKind): boolean {
  return kind !== "note" && kind !== "final";
}

/** الملاحظة لا تُنجز التكليف ولا تستهلك مدّته. */
export function actionCompletesAssignment(kind: ActionKind): boolean {
  return kind !== "note";
}

/** مدّة الإعادة تخصّ الإرجاع وحده. */
export function actionSupportsReturnMinutes(kind: ActionKind): boolean {
  return kind === "backward";
}

/**
 * زرّ بلا وجهة يوقف المعاملة بلا صاحب — تحذير يعرضه المحرِّر قبل الحفظ.
 */
export function actionNeedsRouteWarning(
  kind: ActionKind,
  routesCount: number,
): boolean {
  return actionCarriesRoutes(kind) && routesCount === 0;
}
