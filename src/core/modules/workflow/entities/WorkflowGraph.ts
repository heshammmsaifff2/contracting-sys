/**
 * WorkflowGraph — المسار بوصفه شبكة، لا جدولًا.
 *
 * بعد التفريع في المرحلة ٠٢ صار للمرحلة الواحدة أكثر من مخرج، وصار المخرج
 * مشروطًا. القائمة المسطّحة لا تُظهر ذلك: تُظهر أن هناك وجهات، لا أين تلتقي
 * ولا أين تنقطع. هذه الوحدة تحوّل التعريف إلى عُقَد وأسهم، وتفحصها.
 *
 * **الفحص هنا لا في القاعدة عمدًا.** فحص الرسم البياني *مساعدة تأليف* لا
 * حدّ أمان: الحدود الحقيقية مفروضة أصلًا في القاعدة (الشرط المعطوب،
 * الوجهة خارج المسار، الزرّ بلا وجهة عند التنفيذ). وكتابة خوارزمية
 * الوصول والحلقات مرّتين — plpgsql وTypeScript — تعني نسختين تتباعدان.
 * فبقي الفحص في نسخة واحدة، هنا، حيث يعمل **فورًا** أثناء السحب بلا
 * ذهاب إلى الخادم.
 *
 * وحدة نقيّة: لا تعرف React ولا Supabase، وتقبل أي شيء يطابق شكلها.
 */
import { actionCarriesRoutes, type ActionKind } from "./WorkflowAction";
import { describeCondition, type WorkflowCondition } from "./WorkflowCondition";

// ── الشكل الذي تقرؤه ────────────────────────────────────────────────────
// بنيويّ لا اسميّ: `WorkflowStageDto` يطابقه فلا يحتاج القلب أن يعرف طبقة
// التطبيق ليفحص رسمها.
export interface GraphRoute {
  readonly id: string;
  readonly priority: number;
  readonly condition: WorkflowCondition | null;
  readonly targetStageId: string;
}

export interface GraphAction {
  readonly id: string;
  readonly actionKey: string;
  readonly label: string;
  readonly kind: ActionKind;
  readonly routes: readonly GraphRoute[];
}

export interface GraphStage {
  readonly id: string;
  readonly stageKey: string;
  readonly name: string;
  readonly isStart: boolean;
  readonly isFinal: boolean;
  readonly isArchive: boolean;
  readonly quorumCount: number | null;
  readonly defaultNextStageId: string | null;
  readonly posX: number;
  readonly posY: number;
  readonly participants: readonly { readonly kind: string }[];
  readonly actions: readonly GraphAction[];
}

// ── العُقَد والأسهم ──────────────────────────────────────────────────────
/** `default` = التسلسل الخطّي الاحتياطي من المرحلة ٠١، لا زرًّا. */
export type EdgeSource = "action" | "default";

export interface GraphEdge {
  readonly id: string;
  readonly fromStageId: string;
  readonly toStageId: string;
  /** لون السهم من نوع الزرّ؛ والاحتياطي يُرسم انتقالًا عاديًّا. */
  readonly kind: ActionKind;
  readonly source: EdgeSource;
  readonly label: string;
  readonly priority: number;
  /** وصف الشرط بالعربية، أو null للمسار الافتراضي. */
  readonly conditionLabel: string | null;
}

/**
 * هل ينظر المحرّك إلى `default_next_stage_id` في هذه المرحلة؟
 *
 * يطابق `complete_assignment` في القاعدة: الاحتياطي لا يُستعمل إلا حين لا
 * يُسجَّل زرٌّ حاسم، والملاحظة لا تُنجز تكليفًا فلا تحسم. فمرحلةٌ كل أزرارها
 * ملاحظات ما زالت تسير بالتسلسل الخطّي.
 */
export function stageUsesDefaultNext(stage: GraphStage): boolean {
  return stage.actions.every((action) => action.kind === "note");
}

/** كل الأسهم الخارجة من مرحلة، من أزرارها ومن احتياطيّها. */
export function stageEdges(stage: GraphStage): readonly GraphEdge[] {
  const edges: GraphEdge[] = [];

  for (const action of stage.actions) {
    if (!actionCarriesRoutes(action.kind)) continue;
    for (const route of action.routes) {
      edges.push({
        id: route.id,
        fromStageId: stage.id,
        toStageId: route.targetStageId,
        kind: action.kind,
        source: "action",
        label: action.label,
        priority: route.priority,
        conditionLabel:
          route.condition === null ? null : describeCondition(route.condition),
      });
    }
  }

  if (stageUsesDefaultNext(stage) && stage.defaultNextStageId !== null) {
    edges.push({
      id: `default:${stage.id}`,
      fromStageId: stage.id,
      toStageId: stage.defaultNextStageId,
      kind: "forward",
      source: "default",
      label: "",
      priority: 999,
      conditionLabel: null,
    });
  }

  return edges;
}

export function buildWorkflowEdges(
  stages: readonly GraphStage[],
): readonly GraphEdge[] {
  const known = new Set(stages.map((stage) => stage.id));
  // الوجهة المفقودة تُرصد إشكالًا لا سهمًا معلَّقًا في الفراغ
  return stages.flatMap((stage) =>
    stageEdges(stage).filter((edge) => known.has(edge.toStageId)),
  );
}

// ── الفحص ───────────────────────────────────────────────────────────────
export type GraphIssueCode =
  | "no_start"
  | "no_final"
  | "unreachable"
  | "dead_end"
  | "action_without_route"
  | "route_to_missing"
  | "no_participants"
  | "quorum_exceeds_participants"
  | "cycle";

export type GraphSeverity = "error" | "warning";

export interface GraphIssue {
  readonly code: GraphIssueCode;
  readonly severity: GraphSeverity;
  /** المرحلة المعنيّة — null لما يخصّ المسار كلّه. */
  readonly stageId: string | null;
  readonly stageName: string;
  /** الزرّ المعنيّ، إن كان الإشكال زرًّا بعينه. */
  readonly actionId: string | null;
  readonly detail: string;
}

const SEVERITY: Record<GraphIssueCode, GraphSeverity> = {
  no_start: "error",
  no_final: "error",
  unreachable: "warning",
  dead_end: "error",
  action_without_route: "error",
  route_to_missing: "error",
  no_participants: "error",
  quorum_exceeds_participants: "warning",
  cycle: "warning",
};

export function issueSeverity(code: GraphIssueCode): GraphSeverity {
  return SEVERITY[code];
}

/** المرحلة تُغلق المسار بنفسها فلا يُطلب منها مخرج. */
function stageCloses(stage: GraphStage): boolean {
  return stage.isFinal || stage.actions.some((action) => action.kind === "final");
}

/**
 * حلقة مغلقة **بين الأسهم الأمامية وحدها**.
 *
 * الإرجاع سهم راجع بطبعه: «رفض → أعد إلى المُعِدّ» يصنع دورةً مقصودة تنتهي
 * حين يعتمد المعتمِد. فلو عُدّت حلقةً لامتلأت اللوحة بتحذيرات كاذبة وأهملها
 * من يقرؤها. الدورة التي تستحقّ التحذير هي التي لا مخرج منها إلى الأمام.
 */
function findForwardCycle(
  stages: readonly GraphStage[],
  edges: readonly GraphEdge[],
): readonly string[] {
  const forward = new Map<string, string[]>();
  for (const stage of stages) forward.set(stage.id, []);
  for (const edge of edges) {
    if (edge.kind === "backward") continue;
    forward.get(edge.fromStageId)?.push(edge.toStageId);
  }

  const WHITE = 0;
  const GREY = 1;
  const BLACK = 2;
  const color = new Map<string, number>(stages.map((stage) => [stage.id, WHITE]));
  const parent = new Map<string, string | null>();
  let cycleFrom: string | null = null;
  let cycleTo: string | null = null;

  // تكرار صريح لا استدعاء ذاتيّ: عمق المسار ليس مضمونًا
  for (const root of stages) {
    if (color.get(root.id) !== WHITE || cycleFrom !== null) continue;
    const work: { id: string; next: number }[] = [{ id: root.id, next: 0 }];
    color.set(root.id, GREY);
    parent.set(root.id, null);

    while (cycleFrom === null) {
      const frame = work[work.length - 1];
      if (frame === undefined) break;

      const neighbours = forward.get(frame.id) ?? [];
      const child = neighbours[frame.next];
      if (child === undefined) {
        color.set(frame.id, BLACK);
        work.pop();
        continue;
      }
      frame.next += 1;

      const state = color.get(child) ?? WHITE;
      if (state === GREY) {
        cycleFrom = frame.id;
        cycleTo = child;
      } else if (state === WHITE) {
        color.set(child, GREY);
        parent.set(child, frame.id);
        work.push({ id: child, next: 0 });
      }
    }
  }

  if (cycleFrom === null || cycleTo === null) return [];

  // نُعيد بناء الدورة صعودًا من موضع الاكتشاف إلى العقدة المتكرّرة
  const path: string[] = [cycleFrom];
  let cursor: string | null = cycleFrom;
  while (cursor !== null && cursor !== cycleTo) {
    cursor = parent.get(cursor) ?? null;
    if (cursor !== null) path.push(cursor);
  }
  return path.reverse();
}

/** المراحل التي تصلها المعاملة فعلًا انطلاقًا من البداية. */
export function reachableStageIds(
  stages: readonly GraphStage[],
  edges: readonly GraphEdge[],
): ReadonlySet<string> {
  const start = stages.find((stage) => stage.isStart);
  const reached = new Set<string>();
  if (start === undefined) return reached;

  const outgoing = new Map<string, string[]>();
  for (const edge of edges) {
    const list = outgoing.get(edge.fromStageId);
    if (list === undefined) outgoing.set(edge.fromStageId, [edge.toStageId]);
    else list.push(edge.toStageId);
  }

  const queue = [start.id];
  reached.add(start.id);
  while (queue.length > 0) {
    const current = queue.shift() as string;
    for (const next of outgoing.get(current) ?? []) {
      if (reached.has(next)) continue;
      reached.add(next);
      queue.push(next);
    }
  }
  return reached;
}

/**
 * فحص المسار كاملًا. يُستدعى على كل تغيير في المحرّر، فالترتيب خطّي في
 * عدد المراحل والأسهم — لا استعلام ولا انتظار.
 */
export function validateWorkflowGraph(
  stages: readonly GraphStage[],
): readonly GraphIssue[] {
  const issues: GraphIssue[] = [];
  const add = (
    code: GraphIssueCode,
    stage: GraphStage | null,
    detail: string,
    actionId: string | null = null,
  ) => {
    issues.push({
      code,
      severity: SEVERITY[code],
      stageId: stage?.id ?? null,
      stageName: stage?.name ?? "",
      actionId,
      detail,
    });
  };

  if (stages.length === 0) return issues;

  const known = new Set(stages.map((stage) => stage.id));
  const edges = buildWorkflowEdges(stages);

  if (!stages.some((stage) => stage.isStart)) {
    add("no_start", null, "لا مرحلة بداية — المعاملة لا تجد أين تبدأ");
  }
  if (!stages.some((stage) => stage.isFinal)) {
    add("no_final", null, "لا مرحلة نهائية — المسار لا يعرف أين ينتهي");
  }

  const reached = reachableStageIds(stages, edges);
  const outDegree = new Map<string, number>();
  for (const edge of edges) {
    outDegree.set(edge.fromStageId, (outDegree.get(edge.fromStageId) ?? 0) + 1);
  }

  for (const stage of stages) {
    /**
     * النهائية ليست استثناءً.
     *
     * كان الفحص يعفيها ظنًّا أنها لا تُعمَل. لكنّ المحرّك **يفتحها** كغيرها،
     * وبلا مؤهَّل تقف `pending` إلى الأبد فلا تُغلق المعاملة أبدًا. أوقعني
     * هذا في مسار البذرة نفسه: «اعتماد وإغلاق» فتح الأرشفة، ووقفت هناك.
     * والمرحلة التي لا تُدخَل أصلًا يرصدها `unreachable` لا هذا الفحص.
     */
    if (stage.participants.length === 0) {
      add("no_participants", stage, "مرحلة بلا مشاركين — المعاملة تقف بلا صاحب");
    }

    // النصاب يُحسب على المشاركين المعدودين؛ الدور يتمدّد وقت التشغيل فلا يُحسب
    if (stage.quorumCount !== null) {
      const countable = stage.participants.filter(
        (p) => p.kind === "user" || p.kind === "requester",
      ).length;
      const expands = stage.participants.some(
        (p) =>
          p.kind === "role" ||
          p.kind === "project_role" ||
          p.kind === "department_role",
      );
      if (!expands && stage.quorumCount > countable) {
        add(
          "quorum_exceeds_participants",
          stage,
          `النصاب ${stage.quorumCount} والمشاركون ${countable} — لن تُغلق المرحلة أبدًا`,
        );
      }
    }

    for (const action of stage.actions) {
      if (actionCarriesRoutes(action.kind) && action.routes.length === 0) {
        add(
          "action_without_route",
          stage,
          `الزرّ «${action.label}» بلا وجهة — يقف المسار عنده`,
          action.id,
        );
      }
      for (const route of action.routes) {
        if (!known.has(route.targetStageId)) {
          add(
            "route_to_missing",
            stage,
            `وجهة الزرّ «${action.label}» خارج هذا المسار`,
            action.id,
          );
        }
      }
    }

    if (!stageCloses(stage) && (outDegree.get(stage.id) ?? 0) === 0) {
      add("dead_end", stage, "مرحلة بلا مخرج ولا علامة نهاية — المعاملة تعلق فيها");
    }

    if (!reached.has(stage.id) && !stage.isStart) {
      add("unreachable", stage, "مرحلة لا تصلها المعاملة من البداية");
    }
  }

  const cycle = findForwardCycle(stages, edges);
  if (cycle.length > 0) {
    const names = cycle
      .map((id) => stages.find((stage) => stage.id === id)?.name ?? "")
      .filter((name) => name !== "");
    const head = stages.find((stage) => stage.id === cycle[0]) ?? null;
    add("cycle", head, `حلقة مغلقة بلا إرجاع: ${names.join(" ← ")}`);
  }

  return issues;
}

export function hasBlockingIssue(issues: readonly GraphIssue[]): boolean {
  return issues.some((issue) => issue.severity === "error");
}

// ── التخطيط التلقائي ────────────────────────────────────────────────────
/** أبعاد العقدة — تُشاركها اللوحة فيبقى الحساب في مكان واحد. */
export const NODE_WIDTH = 208;
export const NODE_HEIGHT = 88;
export const LAYER_GAP = 76;
export const COLUMN_GAP = 40;

export interface StagePosition {
  readonly id: string;
  readonly x: number;
  readonly y: number;
}

/**
 * ترتيب طبقيّ من الأعلى إلى الأسفل.
 *
 * رأسيّ لا أفقيّ: الواجهة عربية من اليمين لليسار، والسهم الأفقيّ يوهم
 * اتّجاهًا يعاكس القراءة. والنزول لا اتّجاه له فلا يلتبس.
 *
 * المراحل التي لا تصلها المعاملة تُصفّ في طبقة أخيرة بدل أن تُكوَّم في
 * الأصل — فيراها من يفتح اللوحة بدل أن يظنّها غير موجودة.
 */
export function autoLayoutStages(
  stages: readonly GraphStage[],
): readonly StagePosition[] {
  if (stages.length === 0) return [];

  const edges = buildWorkflowEdges(stages);
  const outgoing = new Map<string, string[]>();
  for (const edge of edges) {
    // السهم الراجع لا يحدّد طبقة: وإلّا لَسحب المعتمِد فوق المُعِدّ
    if (edge.kind === "backward") continue;
    const list = outgoing.get(edge.fromStageId);
    if (list === undefined) outgoing.set(edge.fromStageId, [edge.toStageId]);
    else list.push(edge.toStageId);
  }

  const depth = new Map<string, number>();
  const [first] = stages;
  const start = stages.find((stage) => stage.isStart) ?? first;
  if (start === undefined) return [];
  const queue: string[] = [start.id];
  depth.set(start.id, 0);
  while (queue.length > 0) {
    const current = queue.shift() as string;
    const currentDepth = depth.get(current) ?? 0;
    for (const next of outgoing.get(current) ?? []) {
      if (depth.has(next)) continue;
      depth.set(next, currentDepth + 1);
      queue.push(next);
    }
  }

  const maxDepth = Math.max(0, ...depth.values());
  const orphanDepth = maxDepth + 1;
  const layers = new Map<number, string[]>();
  for (const stage of stages) {
    const level = depth.get(stage.id) ?? orphanDepth;
    const list = layers.get(level);
    if (list === undefined) layers.set(level, [stage.id]);
    else list.push(stage.id);
  }

  const positions: StagePosition[] = [];
  for (const [level, ids] of [...layers.entries()].sort((a, b) => a[0] - b[0])) {
    const span = ids.length * NODE_WIDTH + (ids.length - 1) * COLUMN_GAP;
    ids.forEach((id, index) => {
      positions.push({
        id,
        x: Math.round(-span / 2 + index * (NODE_WIDTH + COLUMN_GAP)),
        y: level * (NODE_HEIGHT + LAYER_GAP),
      });
    });
  }
  return positions;
}

/** مسار لم يُرسم بعد: كل عُقَده على الأصل، فالتخطيط التلقائي أولى. */
export function needsAutoLayout(stages: readonly GraphStage[]): boolean {
  return (
    stages.length > 1 && stages.every((stage) => stage.posX === 0 && stage.posY === 0)
  );
}
