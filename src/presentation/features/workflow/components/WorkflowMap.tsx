/**
 * لوحة المسار — عُقَد وأسهم، سحب وتكبير.
 *
 * لا مكتبة رسم: العُقَد عناصر HTML مطلقة الموضع فوق طبقة SVG للأسهم، وكلتاهما
 * داخل حاوية واحدة تحمل `transform`. فالنصّ العربي يُخطَّط بمحرّك المتصفّح
 * كبقيّة الشاشات — لا `<text>` في SVG تُقصّ يدويًّا — والعقدة تبقى زرًّا
 * حقيقيًّا يصله لوحة المفاتيح.
 *
 * اللوحة `dir="ltr"` عمدًا وإن كانت الشاشة عربية: `left` و`top` خصائص
 * فيزيائية، فخلطها بسياق منطقيّ مقلوب يجعل الحساب يكذب على العين. محتوى
 * العقدة وحده يعود إلى `rtl`.
 */
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type KeyboardEvent as ReactKeyboardEvent,
  type PointerEvent as ReactPointerEvent,
  type WheelEvent as ReactWheelEvent,
} from "react";
import { Maximize2, Minus, Plus } from "lucide-react";
import type { ActionKind } from "@core/modules/workflow/entities/WorkflowAction";
import {
  buildWorkflowEdges,
  NODE_HEIGHT,
  NODE_WIDTH,
  type GraphEdge,
  type GraphStage,
} from "@core/modules/workflow/entities/WorkflowGraph";
import { Button } from "@presentation/shared/ui/Button";
import { cn } from "@presentation/shared/lib/cn";
import { EDGE_COLORS } from "./workflow-admin-options";
import { t } from "@i18n/index";

/** حالة المرحلة على معاملة بعينها — للخريطة القرائية داخل التفاصيل. */
export type MapStageStatus = "current" | "done" | "skipped" | "pending";

export interface MapPosition {
  readonly x: number;
  readonly y: number;
}

export interface WorkflowMapProps {
  stages: readonly GraphStage[];
  /** المواضع السارية — تشمل ما لم يُحفَظ بعد أثناء السحب. */
  positions: ReadonlyMap<string, MapPosition>;
  selectedStageId?: string | null;
  onSelectStage?: (stageId: string | null) => void;
  /** يُنادى مرارًا أثناء السحب؛ الحفظ عند `onCommitStage`. */
  onMoveStage?: (stageId: string, position: MapPosition) => void;
  onCommitStage?: (stageId: string) => void;
  onOpenStage?: (stageId: string) => void;
  editable?: boolean;
  statusByStageKey?: ReadonlyMap<string, MapStageStatus>;
  /** المراحل المُشكِلة — إطار محذِّر على العقدة. */
  issueStageIds?: ReadonlySet<string>;
  height?: number;
  className?: string;
}

const MIN_SCALE = 0.35;
const MAX_SCALE = 2;
const KEYBOARD_STEP = 8;
const PADDING = 64;

interface Viewport {
  x: number;
  y: number;
  k: number;
}

/**
 * منحنى بين عقدتين.
 *
 * الأمامي ينزل من أسفل المصدر إلى أعلى الوجهة. والراجع يصعد، فيُدفع جانبًا
 * بقوس عريض: لولا ذلك لانطبق على السهم الأمامي المقابل له وصارا خطًّا واحدًا
 * لا يُقرأ منه إلى أين يمضي أيّهما.
 */
function edgePath(from: MapPosition, to: MapPosition, isBackward: boolean): string {
  const x1 = from.x + NODE_WIDTH / 2;
  const y1 = from.y + NODE_HEIGHT;
  const x2 = to.x + NODE_WIDTH / 2;
  const y2 = to.y;

  if (!isBackward && y2 > y1) {
    const bend = Math.max(28, (y2 - y1) / 2);
    return `M ${x1} ${y1} C ${x1} ${y1 + bend}, ${x2} ${y2 - bend}, ${x2} ${y2}`;
  }

  // صاعد أو جانبيّ: نخرج من الجانب ونعود إليه بقوس بعيد عن جسم العُقَد
  const startX = from.x + NODE_WIDTH;
  const startY = from.y + NODE_HEIGHT / 2;
  const endX = to.x + NODE_WIDTH;
  const endY = to.y + NODE_HEIGHT / 2;
  const reach = 72 + Math.abs(endY - startY) * 0.12;
  return `M ${startX} ${startY} C ${startX + reach} ${startY}, ${endX + reach} ${endY}, ${endX} ${endY}`;
}

/** وسط المنحنى تقريبًا — موضع بطاقة الشرط. */
function edgeLabelPoint(
  from: MapPosition,
  to: MapPosition,
  isBackward: boolean,
): MapPosition {
  if (!isBackward && to.y > from.y + NODE_HEIGHT) {
    return {
      x: (from.x + to.x) / 2 + NODE_WIDTH / 2,
      y: (from.y + NODE_HEIGHT + to.y) / 2,
    };
  }
  return {
    x: Math.max(from.x, to.x) + NODE_WIDTH + 44,
    y: (from.y + to.y) / 2 + NODE_HEIGHT / 2,
  };
}

const STATUS_RING: Record<MapStageStatus, string> = {
  current: "ring-2 ring-brand-500 border-brand-500",
  done: "border-success/60 bg-success-soft",
  skipped: "border-border opacity-50",
  pending: "border-border",
};

export function WorkflowMap({
  stages,
  positions,
  selectedStageId = null,
  onSelectStage,
  onMoveStage,
  onCommitStage,
  onOpenStage,
  editable = false,
  statusByStageKey,
  issueStageIds,
  height = 520,
  className,
}: WorkflowMapProps) {
  const frameRef = useRef<HTMLDivElement>(null);
  const [viewport, setViewport] = useState<Viewport>({ x: 0, y: 0, k: 1 });
  const [isPanning, setIsPanning] = useState(false);
  const panRef = useRef<{ x: number; y: number; vx: number; vy: number } | null>(null);
  const dragRef = useRef<{ id: string; dx: number; dy: number } | null>(null);

  const edges = useMemo(() => buildWorkflowEdges(stages), [stages]);

  const at = useCallback(
    (stageId: string): MapPosition => positions.get(stageId) ?? { x: 0, y: 0 },
    [positions],
  );

  /** يضبط اللوحة على محتواها — أول فتحة، وزرّ إعادة الضبط. */
  const fit = useCallback(() => {
    const frame = frameRef.current;
    if (frame === null || stages.length === 0) return;

    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;
    for (const stage of stages) {
      const p = at(stage.id);
      minX = Math.min(minX, p.x);
      minY = Math.min(minY, p.y);
      maxX = Math.max(maxX, p.x + NODE_WIDTH);
      maxY = Math.max(maxY, p.y + NODE_HEIGHT);
    }

    const width = frame.clientWidth;
    const boxHeight = frame.clientHeight;
    if (width === 0 || boxHeight === 0) return;

    const k = Math.min(
      MAX_SCALE,
      Math.max(
        MIN_SCALE,
        Math.min(
          (width - PADDING * 2) / Math.max(1, maxX - minX),
          (boxHeight - PADDING * 2) / Math.max(1, maxY - minY),
        ),
      ),
    );
    setViewport({
      k,
      x: (width - (maxX - minX) * k) / 2 - minX * k,
      y: (boxHeight - (maxY - minY) * k) / 2 - minY * k,
    });
  }, [at, stages]);

  // الضبط الأول فقط: إعادته مع كل تغيير تقفز اللوحة تحت يد من يحرّر
  const fitted = useRef(false);
  useLayoutEffect(() => {
    if (fitted.current || stages.length === 0) return;
    fitted.current = true;
    fit();
  }, [fit, stages.length]);

  const zoomBy = useCallback((factor: number, originX?: number, originY?: number) => {
    setViewport((current) => {
      const k = Math.min(MAX_SCALE, Math.max(MIN_SCALE, current.k * factor));
      const frame = frameRef.current;
      const cx = originX ?? (frame?.clientWidth ?? 0) / 2;
      const cy = originY ?? (frame?.clientHeight ?? 0) / 2;
      // نُثبّت النقطة تحت المؤشّر: التكبير من الزاوية يفقد ما ينظر إليه المحرِّر
      return {
        k,
        x: cx - ((cx - current.x) / current.k) * k,
        y: cy - ((cy - current.y) / current.k) * k,
      };
    });
  }, []);

  /**
   * العجلة تُكبِّر مع Ctrl وحده.
   *
   * بلا هذا الشرط تبتلع اللوحةُ تمريرَ الصفحة كلّها: من يمرّ بمؤشّره فوقها
   * وهو ذاهب إلى ما تحتها يجد نفسه يكبّر رسمًا لم يقصده.
   */
  function handleWheel(event: ReactWheelEvent<HTMLDivElement>) {
    if (!event.ctrlKey && !event.metaKey) return;
    event.preventDefault();
    const rect = event.currentTarget.getBoundingClientRect();
    zoomBy(
      event.deltaY < 0 ? 1.12 : 1 / 1.12,
      event.clientX - rect.left,
      event.clientY - rect.top,
    );
  }

  function handleBackgroundPointerDown(event: ReactPointerEvent<HTMLDivElement>) {
    if (event.button !== 0) return;
    panRef.current = {
      x: event.clientX,
      y: event.clientY,
      vx: viewport.x,
      vy: viewport.y,
    };
    setIsPanning(true);
    event.currentTarget.setPointerCapture(event.pointerId);
    onSelectStage?.(null);
  }

  function handlePointerMove(event: ReactPointerEvent<HTMLDivElement>) {
    const drag = dragRef.current;
    if (drag !== null) {
      const rect = event.currentTarget.getBoundingClientRect();
      onMoveStage?.(drag.id, {
        x: Math.round((event.clientX - rect.left - viewport.x) / viewport.k - drag.dx),
        y: Math.round((event.clientY - rect.top - viewport.y) / viewport.k - drag.dy),
      });
      return;
    }

    const pan = panRef.current;
    if (pan === null) return;
    setViewport((current) => ({
      ...current,
      x: pan.vx + (event.clientX - pan.x),
      y: pan.vy + (event.clientY - pan.y),
    }));
  }

  function handlePointerUp(event: ReactPointerEvent<HTMLDivElement>) {
    const drag = dragRef.current;
    if (drag !== null) {
      dragRef.current = null;
      onCommitStage?.(drag.id);
    }
    panRef.current = null;
    setIsPanning(false);
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
  }

  function handleNodePointerDown(
    event: ReactPointerEvent<HTMLButtonElement>,
    stageId: string,
  ) {
    onSelectStage?.(stageId);
    if (!editable || event.button !== 0) return;
    event.stopPropagation();

    const frame = frameRef.current;
    if (frame === null) return;
    const rect = frame.getBoundingClientRect();
    const position = at(stageId);
    dragRef.current = {
      id: stageId,
      dx: (event.clientX - rect.left - viewport.x) / viewport.k - position.x,
      dy: (event.clientY - rect.top - viewport.y) / viewport.k - position.y,
    };
    frame.setPointerCapture(event.pointerId);
  }

  /** التحريك بلوحة المفاتيح — لا يصحّ أن يكون الترتيب حكرًا على الفأرة. */
  function handleNodeKeyDown(
    event: ReactKeyboardEvent<HTMLButtonElement>,
    stageId: string,
  ) {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      onOpenStage?.(stageId);
      return;
    }
    if (!editable) return;
    const delta: Record<string, MapPosition> = {
      ArrowUp: { x: 0, y: -KEYBOARD_STEP },
      ArrowDown: { x: 0, y: KEYBOARD_STEP },
      ArrowLeft: { x: -KEYBOARD_STEP, y: 0 },
      ArrowRight: { x: KEYBOARD_STEP, y: 0 },
    };
    const step = delta[event.key];
    if (step === undefined) return;
    event.preventDefault();
    const position = at(stageId);
    onMoveStage?.(stageId, { x: position.x + step.x, y: position.y + step.y });
    onCommitStage?.(stageId);
  }

  // إفلات المؤشّر خارج اللوحة يترك السحب عالقًا لولا هذا
  useEffect(() => {
    if (!isPanning) return;
    const stop = () => {
      panRef.current = null;
      setIsPanning(false);
    };
    window.addEventListener("pointerup", stop);
    return () => window.removeEventListener("pointerup", stop);
  }, [isPanning]);

  const layerStyle: CSSProperties = {
    transform: `translate(${viewport.x}px, ${viewport.y}px) scale(${viewport.k})`,
    transformOrigin: "0 0",
  };

  return (
    <div className={cn("relative", className)}>
      <div className="absolute end-3 top-3 z-20 flex gap-1">
        <Button
          variant="ghost"
          size="sm"
          aria-label={t.workflowMap.zoomIn}
          onClick={() => zoomBy(1.2)}
          startIcon={<Plus aria-hidden className="size-4" />}
        />
        <Button
          variant="ghost"
          size="sm"
          aria-label={t.workflowMap.zoomOut}
          onClick={() => zoomBy(1 / 1.2)}
          startIcon={<Minus aria-hidden className="size-4" />}
        />
        <Button
          variant="ghost"
          size="sm"
          aria-label={t.workflowMap.resetView}
          onClick={fit}
          startIcon={<Maximize2 aria-hidden className="size-4" />}
        />
      </div>

      <div
        ref={frameRef}
        dir="ltr"
        style={{ height }}
        className={cn(
          "border-border bg-surface-sunken relative overflow-hidden rounded-[var(--radius-card)] border",
          isPanning ? "cursor-grabbing" : "cursor-grab",
        )}
        onPointerDown={handleBackgroundPointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
        onWheel={handleWheel}
      >
        <div className="absolute inset-0" style={layerStyle}>
          <svg
            className="pointer-events-none absolute overflow-visible"
            width="1"
            height="1"
            aria-hidden
          >
            <defs>
              {(Object.keys(EDGE_COLORS) as ActionKind[]).map((kind) => (
                <marker
                  key={kind}
                  id={`wf-arrow-${kind}`}
                  viewBox="0 0 10 10"
                  refX="9"
                  refY="5"
                  markerWidth="6"
                  markerHeight="6"
                  orient="auto-start-reverse"
                >
                  <path d="M 0 0 L 10 5 L 0 10 z" fill={EDGE_COLORS[kind]} />
                </marker>
              ))}
            </defs>

            {edges.map((edge: GraphEdge) => {
              const from = at(edge.fromStageId);
              const to = at(edge.toStageId);
              const isBackward = edge.kind === "backward";
              const isDimmed =
                selectedStageId !== null &&
                edge.fromStageId !== selectedStageId &&
                edge.toStageId !== selectedStageId;
              return (
                <path
                  key={edge.id}
                  d={edgePath(from, to, isBackward)}
                  fill="none"
                  stroke={EDGE_COLORS[edge.kind]}
                  strokeWidth={isDimmed ? 1.25 : 2}
                  strokeOpacity={isDimmed ? 0.28 : 0.9}
                  // الاحتياطي الخطّي متقطّع: ليس زرًّا ضغطه أحد
                  strokeDasharray={edge.source === "default" ? "6 5" : undefined}
                  markerEnd={`url(#wf-arrow-${edge.kind})`}
                />
              );
            })}
          </svg>

          {/* بطاقات الشروط فوق الأسهم — نصّ عربي فلا يُرسم داخل SVG */}
          {edges
            .filter((edge) => edge.conditionLabel !== null || edge.label !== "")
            .map((edge) => {
              const point = edgeLabelPoint(
                at(edge.fromStageId),
                at(edge.toStageId),
                edge.kind === "backward",
              );
              const isDimmed =
                selectedStageId !== null &&
                edge.fromStageId !== selectedStageId &&
                edge.toStageId !== selectedStageId;
              if (isDimmed) return null;
              return (
                <span
                  key={`label-${edge.id}`}
                  dir="rtl"
                  style={{
                    position: "absolute",
                    left: point.x,
                    top: point.y,
                    transform: "translate(-50%, -50%)",
                    maxWidth: NODE_WIDTH,
                  }}
                  className="border-border bg-surface text-content-muted pointer-events-none truncate rounded-full border px-2 py-0.5 text-[10px] shadow-sm"
                >
                  {edge.conditionLabel ?? edge.label}
                </span>
              );
            })}

          {stages.map((stage) => {
            const position = at(stage.id);
            const status = statusByStageKey?.get(stage.stageKey) ?? null;
            const isSelected = stage.id === selectedStageId;
            const hasIssue = issueStageIds?.has(stage.id) ?? false;
            return (
              <button
                key={stage.id}
                type="button"
                dir="rtl"
                style={{
                  position: "absolute",
                  left: position.x,
                  top: position.y,
                  width: NODE_WIDTH,
                  minHeight: NODE_HEIGHT,
                }}
                onPointerDown={(event) => handleNodePointerDown(event, stage.id)}
                onKeyDown={(event) => handleNodeKeyDown(event, stage.id)}
                onDoubleClick={() => onOpenStage?.(stage.id)}
                className={cn(
                  "bg-surface flex flex-col items-start gap-1 rounded-[var(--radius-card)] border p-2.5 text-right shadow-sm transition-shadow",
                  editable ? "cursor-move" : "cursor-pointer",
                  status === null ? "border-border" : STATUS_RING[status],
                  hasIssue && "border-warning border-dashed",
                  isSelected && "ring-brand-500 ring-2",
                )}
              >
                <span className="flex w-full items-center gap-1.5">
                  <span className="text-content min-w-0 flex-1 truncate text-xs font-bold">
                    {stage.name}
                  </span>
                  {stage.isStart && (
                    <span className="bg-success size-2 shrink-0 rounded-full" />
                  )}
                  {stage.isFinal && (
                    <span className="bg-info size-2 shrink-0 rounded-full" />
                  )}
                </span>

                <span className="text-content-muted w-full truncate font-mono text-[10px]">
                  {stage.stageKey}
                </span>

                <span className="text-content-muted flex w-full flex-wrap gap-1 text-[10px]">
                  <span>
                    {t.workflowAdmin.participants}: {stage.participants.length}
                  </span>
                  {stage.actions.length > 0 && (
                    <span>
                      · {t.workflowAdmin.actions}: {stage.actions.length}
                    </span>
                  )}
                </span>
              </button>
            );
          })}
        </div>

        {stages.length === 0 && (
          <p
            dir="rtl"
            className="text-content-muted absolute inset-0 grid place-items-center text-sm"
          >
            {t.workflowMap.noStagesYet}
          </p>
        )}
      </div>

      <p className="text-content-muted mt-2 text-[11px]">{t.workflowMap.zoomHint}</p>
    </div>
  );
}
