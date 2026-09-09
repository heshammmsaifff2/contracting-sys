/**
 * محرّر المسار المرئي — اللوحة ولوحة الفحص وقائمة التحرير في مكانها.
 *
 * القائمة المسطّحة تُظهر أن للزرّ وجهات؛ لا تُظهر أين تلتقي الفروع ولا أين
 * ينقطع المسار. الشبكة تُظهر ذلك، والفحص يقولها بالكلام لمن لا يقرأ الرسم.
 *
 * المواضع تُحفَظ بعد أن تهدأ اليد لا مع كل بكسل: السحب حدثٌ مستمرّ، وحفظه
 * لحظةً بلحظة يغرق الشبكة برسائل لا يقرأ أحد نتيجتها.
 */
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import {
  AlertTriangle,
  CheckCircle2,
  LayoutGrid,
  Pencil,
  Plus,
  Trash2,
} from "lucide-react";
import type {
  StageRequirementDto,
  WorkflowActionDto,
  WorkflowDefinitionDto,
  WorkflowStageDto,
} from "@application/modules/workflow/dtos";
import {
  autoLayoutStages,
  issueSeverity,
  resolveStagePositions,
  validateWorkflowGraph,
  type GraphIssue,
} from "@core/modules/workflow/entities/WorkflowGraph";
import { actionCarriesRoutes } from "@core/modules/workflow/entities/WorkflowAction";
import { describeCondition } from "@core/modules/workflow/entities/WorkflowCondition";
import {
  canMoveNodes,
  isDefinitionEditable,
} from "@core/modules/workflow/entities/WorkflowGovernance";
import { Badge } from "@presentation/shared/ui/Badge";
import { Button } from "@presentation/shared/ui/Button";
import { EmptyState } from "@presentation/shared/ui/EmptyState";
import { PermissionGate } from "@presentation/shared/ui/PermissionGate";
import { useConfirm } from "@presentation/shared/ui/useConfirm";
import { formatDuration } from "@presentation/shared/lib/formatters";
import { errorMessage } from "@presentation/shared/lib/query";
import {
  useRemoveActionRoute,
  useRemoveStageParticipant,
  useRemoveStageRequirement,
  useRemoveWorkflowAction,
  useSaveStagePositions,
} from "../hooks/useWorkflow";
import {
  ActionModal,
  ParticipantModal,
  RequirementModal,
  RouteModal,
  StageModal,
} from "./workflow-admin-modals";
import {
  ACTION_KIND_TONES,
  deadlineLabel,
  EDGE_COLORS,
  participantLabel,
} from "./workflow-admin-options";
import { WorkflowMap, type MapPosition } from "./WorkflowMap";
import { t } from "@i18n/index";

/** ريثما تهدأ اليد — يجمع أسهم لوحة المفاتيح المتتابعة في رسالة واحدة. */
const SAVE_DEBOUNCE_MS = 600;

const ISSUE_LABELS: Record<GraphIssue["code"], string> = {
  no_start: t.workflowMap.issueNoStart,
  no_final: t.workflowMap.issueNoFinal,
  unreachable: t.workflowMap.issueUnreachable,
  dead_end: t.workflowMap.issueDeadEnd,
  action_without_route: t.workflowMap.issueActionWithoutRoute,
  route_to_missing: t.workflowMap.issueRouteToMissing,
  no_participants: t.workflowMap.issueNoParticipants,
  quorum_exceeds_participants: t.workflowMap.issueQuorum,
  cycle: t.workflowMap.issueCycle,
};

function LegendSwatch({ color, label }: { color: string; label: string }) {
  return (
    <span className="text-content-muted flex items-center gap-1.5 text-[11px]">
      <span
        aria-hidden
        className="inline-block h-0.5 w-5 rounded-full"
        style={{ backgroundColor: color }}
      />
      {label}
    </span>
  );
}

/**
 * يظهر لصاحب `workflow.manage`، وعلى المسودّة وحدها.
 *
 * الإخفاء لا التعطيل: زرٌّ معطَّل على إصدار منشور يُغري بالضغط ثم يخذل،
 * والرسالة الصحيحة معروضة أصلًا في رأس البطاقة.
 */
function EditGate({
  isEditable,
  children,
}: {
  isEditable: boolean;
  children: ReactNode;
}) {
  if (!isEditable) return null;
  return <PermissionGate permission="workflow.manage">{children}</PermissionGate>;
}

/** ما يُحرَّر «في مكانه»: مشاركو المرحلة المختارة وأزرارها ووجهاتها. */
function StageInspector({
  stage,
  isEditable,
  onEditStage,
  onAddParticipant,
  onEditAction,
  onAddRoute,
  onEditRequirement,
}: {
  stage: WorkflowStageDto;
  /** الإصدار المنشور يُقرأ ولا يُحرَّر — الأزرار تختفي لا تُعطَّل. */
  isEditable: boolean;
  onEditStage: () => void;
  onAddParticipant: () => void;
  onEditAction: (action: WorkflowActionDto | null) => void;
  onAddRoute: (action: WorkflowActionDto) => void;
  onEditRequirement: (requirement: StageRequirementDto | null) => void;
}) {
  const removeParticipant = useRemoveStageParticipant();
  const removeAction = useRemoveWorkflowAction();
  const removeRoute = useRemoveActionRoute();
  const removeRequirement = useRemoveStageRequirement();
  const confirm = useConfirm();

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-content text-sm font-bold">{stage.name}</span>
        <span className="text-content-muted font-mono text-[11px]">
          {stage.stageKey}
        </span>
        {stage.isStart && <Badge tone="success">{t.workflowAdmin.isStart}</Badge>}
        {stage.isFinal && <Badge tone="info">{t.workflowAdmin.isFinal}</Badge>}
        {stage.slaMinutes !== null && (
          <span className="text-content-muted text-[11px]">
            {t.inbox.allocated}: {formatDuration(stage.slaMinutes)}
          </span>
        )}
        <EditGate isEditable={isEditable}>
          <Button
            variant="ghost"
            size="sm"
            className="ms-auto"
            onClick={onEditStage}
            startIcon={<Pencil aria-hidden className="size-3.5" />}
          >
            {t.workflowMap.editStage}
          </Button>
        </EditGate>
      </div>

      {deadlineLabel(stage) !== null && (
        <p className="text-warning text-[11px]">
          ◆ {t.workflowAdmin.deadlineLegend}: {deadlineLabel(stage)}
        </p>
      )}

      <div>
        <p className="text-content-muted mb-1 text-[11px] font-medium">
          {t.workflowAdmin.participants}
        </p>
        <div className="flex flex-wrap items-center gap-1.5">
          {stage.participants.length === 0 ? (
            <span className="text-warning text-[11px]">
              {t.workflowAdmin.noParticipants}
            </span>
          ) : (
            stage.participants.map((participant) => (
              <span
                key={participant.id}
                className="border-border text-content-muted flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px]"
              >
                {participantLabel(participant)}
                {participant.isObserver && ` · ${t.workflowAdmin.observer}`}
                {participant.isOptional && ` · ${t.workflowAdmin.isOptional}`}
                <EditGate isEditable={isEditable}>
                  <button
                    type="button"
                    aria-label={t.common.delete}
                    className="text-danger ms-1"
                    onClick={() =>
                      confirm.ask({
                        title: t.workflowAdmin.deleteParticipant,
                        description: participantLabel(participant),
                        onConfirm: () => removeParticipant.mutateAsync(participant.id),
                      })
                    }
                  >
                    ×
                  </button>
                </EditGate>
              </span>
            ))
          )}
          <EditGate isEditable={isEditable}>
            <Button
              variant="ghost"
              size="sm"
              onClick={onAddParticipant}
              startIcon={<Plus aria-hidden className="size-3.5" />}
            >
              {t.workflowAdmin.addParticipant}
            </Button>
          </EditGate>
        </div>
      </div>

      <div>
        <p className="text-content-muted mb-1 text-[11px] font-medium">
          {t.workflowAdmin.requirements}
        </p>
        <p className="text-content-muted mb-1 text-[10px]">
          {t.workflowAdmin.requirementsHint}
        </p>
        {stage.requirements.length === 0 ? (
          <p className="text-content-muted text-[11px]">
            {t.workflowAdmin.noRequirements}
          </p>
        ) : (
          <ul className="flex flex-col gap-1">
            {stage.requirements.map((requirement) => (
              <li
                key={requirement.id}
                className="text-content-muted flex flex-wrap items-baseline gap-1.5 text-[11px]"
              >
                <span className="text-content">{requirement.message}</span>
                <span>
                  {requirement.kind === "attachment"
                    ? `${t.workflowAdmin.requirementAttachment} ${requirement.minAttachments ?? 1}`
                    : describeCondition(requirement.condition)}
                </span>
                {requirement.appliesTo === "any_action" && (
                  <span>· {t.workflowAdmin.requirementAnyAction}</span>
                )}
                <EditGate isEditable={isEditable}>
                  <button
                    type="button"
                    aria-label={t.common.edit}
                    className="text-content-muted"
                    onClick={() => onEditRequirement(requirement)}
                  >
                    ✎
                  </button>
                  <button
                    type="button"
                    aria-label={t.common.delete}
                    className="text-danger"
                    onClick={() =>
                      confirm.ask({
                        title: t.workflowAdmin.deleteRequirement,
                        description: requirement.message,
                        onConfirm: () => removeRequirement.mutateAsync(requirement.id),
                      })
                    }
                  >
                    ×
                  </button>
                </EditGate>
              </li>
            ))}
          </ul>
        )}
        <EditGate isEditable={isEditable}>
          <Button
            variant="ghost"
            size="sm"
            className="mt-1"
            onClick={() => onEditRequirement(null)}
            startIcon={<Plus aria-hidden className="size-3.5" />}
          >
            {t.workflowAdmin.addRequirement}
          </Button>
        </EditGate>
      </div>

      <div>
        <p className="text-content-muted mb-1 text-[11px] font-medium">
          {t.workflowAdmin.actions}
        </p>
        {stage.actions.length === 0 && (
          <p className="text-content-muted text-[11px]">
            {t.workflowAdmin.noActionsYet}
          </p>
        )}
        <ul className="flex flex-col gap-1.5">
          {stage.actions.map((action) => (
            <li
              key={action.id}
              className="border-border rounded-[var(--radius-control)] border px-2 py-1.5"
            >
              <div className="flex flex-wrap items-center gap-2">
                <Badge tone={ACTION_KIND_TONES[action.kind]}>{action.label}</Badge>
                <span className="text-content-muted font-mono text-[11px]">
                  {action.actionKey}
                </span>
                <EditGate isEditable={isEditable}>
                  <span className="ms-auto flex gap-1">
                    {actionCarriesRoutes(action.kind) && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => onAddRoute(action)}
                        startIcon={<Plus aria-hidden className="size-3.5" />}
                      >
                        {t.workflowAdmin.addRoute}
                      </Button>
                    )}
                    <Button
                      variant="ghost"
                      size="sm"
                      aria-label={t.common.edit}
                      onClick={() => onEditAction(action)}
                      startIcon={<Pencil aria-hidden className="size-3.5" />}
                    />
                    <Button
                      variant="ghost"
                      size="sm"
                      aria-label={t.common.delete}
                      onClick={() =>
                        confirm.ask({
                          title: t.workflowAdmin.deleteAction,
                          description: action.label,
                          consequences: [
                            t.workflowAdmin.deleteActionRoutes(action.routes.length),
                          ],
                          onConfirm: () => removeAction.mutateAsync(action.id),
                        })
                      }
                      startIcon={
                        <Trash2 aria-hidden className="text-danger size-3.5" />
                      }
                    />
                  </span>
                </EditGate>
              </div>

              {actionCarriesRoutes(action.kind) && action.routes.length === 0 && (
                <p className="text-warning mt-1 text-[11px]">
                  {t.workflowAdmin.noRoutes}
                </p>
              )}

              {action.routes.length > 0 && (
                <ul className="mt-1 flex flex-col gap-0.5">
                  {action.routes.map((route) => (
                    <li
                      key={route.id}
                      className="text-content-muted flex flex-wrap items-baseline gap-2 text-[11px]"
                    >
                      <span className="tabular font-mono">#{route.priority}</span>
                      <span>{describeCondition(route.condition)}</span>
                      <span className="text-content">
                        ← {route.targetStageName ?? "—"}
                      </span>
                      <EditGate isEditable={isEditable}>
                        <button
                          type="button"
                          aria-label={t.common.delete}
                          className="text-danger"
                          onClick={() =>
                            confirm.ask({
                              title: t.workflowAdmin.deleteRoute,
                              description: `${describeCondition(route.condition)} ← ${route.targetStageName ?? "—"}`,
                              onConfirm: () => removeRoute.mutateAsync(route.id),
                            })
                          }
                        >
                          ×
                        </button>
                      </EditGate>
                    </li>
                  ))}
                </ul>
              )}
            </li>
          ))}
        </ul>
        <EditGate isEditable={isEditable}>
          <Button
            variant="ghost"
            size="sm"
            className="mt-1"
            onClick={() => onEditAction(null)}
            startIcon={<Plus aria-hidden className="size-3.5" />}
          >
            {t.workflowAdmin.addAction}
          </Button>
        </EditGate>
      </div>

      {confirm.dialog}
    </div>
  );
}

export function WorkflowMapEditor({
  definition,
}: {
  definition: WorkflowDefinitionDto;
}) {
  const savePositions = useSaveStagePositions();

  const [overrides, setOverrides] = useState<ReadonlyMap<string, MapPosition>>(
    new Map(),
  );
  const [selectedStageId, setSelectedStageId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [stageModal, setStageModal] = useState<WorkflowStageDto | null>(null);
  const [participantModal, setParticipantModal] = useState<WorkflowStageDto | null>(
    null,
  );
  const [actionModal, setActionModal] = useState<{
    stage: WorkflowStageDto;
    action: WorkflowActionDto | null;
  } | null>(null);
  const [routeModal, setRouteModal] = useState<WorkflowActionDto | null>(null);
  const [requirementModal, setRequirementModal] = useState<{
    stage: WorkflowStageDto;
    requirement: StageRequirementDto | null;
  } | null>(null);
  const isEditable = isDefinitionEditable(definition.status);

  /**
   * ما تحرّك ولم يصل الخادم بعد. مرجع لا حالة: الحفظ المؤجَّل يقرؤه بعد
   * انقضاء المهلة، وقراءة حالةٍ قديمة داخل مؤقّت تحفظ موضعًا سابقًا.
   */
  const pendingRef = useRef<Map<string, MapPosition>>(new Map());
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  /**
   * الموضع المعروض: ما حُفظ، وفوقه ما حرّكته اليد ولم يصل الخادم بعد.
   * ومسارٌ لم يُرسم قطّ يُخطَّط تلقائيًّا ليُرى قبل أن يُلمس.
   */
  const positions = useMemo(() => {
    const base = resolveStagePositions(definition.stages);
    for (const [id, position] of overrides) base.set(id, position);
    return base;
  }, [definition.stages, overrides]);

  const flush = useCallback(() => {
    const payload = [...pendingRef.current].map(([id, position]) => ({
      id,
      x: position.x,
      y: position.y,
    }));
    pendingRef.current = new Map();
    if (payload.length === 0) return;

    setError(null);
    savePositions.mutate(
      { definitionId: definition.id, positions: payload },
      { onError: (e) => setError(errorMessage(e)) },
    );
  }, [definition.id, savePositions]);

  const scheduleFlush = useCallback(() => {
    if (timerRef.current !== null) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(flush, SAVE_DEBOUNCE_MS);
  }, [flush]);

  const moveStage = useCallback((stageId: string, position: MapPosition) => {
    pendingRef.current.set(stageId, position);
    setOverrides((current) => {
      const next = new Map(current);
      next.set(stageId, position);
      return next;
    });
  }, []);

  // المغادرة قبل انقضاء المهلة لا تُضيّع آخر سحبة
  useEffect(
    () => () => {
      if (timerRef.current !== null) clearTimeout(timerRef.current);
    },
    [],
  );

  function handleAutoLayout() {
    for (const layout of autoLayoutStages(definition.stages)) {
      pendingRef.current.set(layout.id, { x: layout.x, y: layout.y });
    }
    setOverrides(new Map(pendingRef.current));
    // ترتيبٌ كامل يُحفَظ فورًا: لا يد تنتظر أن تهدأ
    if (timerRef.current !== null) clearTimeout(timerRef.current);
    flush();
  }

  const issues = useMemo(
    () => validateWorkflowGraph(definition.stages),
    [definition.stages],
  );
  const issueStageIds = useMemo(
    () =>
      new Set(
        issues
          .filter((issue) => issue.stageId !== null)
          .map((issue) => issue.stageId as string),
      ),
    [issues],
  );
  const errorCount = issues.filter((issue) => issue.severity === "error").length;
  const warningCount = issues.length - errorCount;

  const selectedStage =
    definition.stages.find((stage) => stage.id === selectedStageId) ?? null;

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-2">
        <EditGate isEditable={canMoveNodes(definition.status)}>
          <Button
            variant="secondary"
            size="sm"
            onClick={handleAutoLayout}
            startIcon={<LayoutGrid aria-hidden className="size-4" />}
          >
            {t.workflowMap.autoLayout}
          </Button>
        </EditGate>

        <span className="text-content-muted text-[11px]">
          {t.workflowMap.autoLayoutHint}
        </span>

        {savePositions.isPending && (
          <span className="text-content-muted text-[11px]">{t.common.loading}</span>
        )}
        {savePositions.isSuccess && !savePositions.isPending && (
          <span className="text-success text-[11px]">
            {t.workflowMap.positionsSaved}
          </span>
        )}

        <span className="ms-auto flex flex-wrap gap-3">
          <LegendSwatch
            color={EDGE_COLORS.forward}
            label={t.workflowAdmin.kindForward}
          />
          <LegendSwatch
            color={EDGE_COLORS.backward}
            label={t.workflowAdmin.kindBackward}
          />
          <LegendSwatch
            color={EDGE_COLORS.closure}
            label={t.workflowAdmin.kindClosure}
          />
        </span>
      </div>

      {error !== null && (
        <p role="alert" className="text-danger text-sm">
          {error}
        </p>
      )}

      <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_320px]">
        <WorkflowMap
          stages={definition.stages}
          positions={positions}
          selectedStageId={selectedStageId}
          onSelectStage={setSelectedStageId}
          onMoveStage={moveStage}
          onCommitStage={scheduleFlush}
          onOpenStage={(stageId) => {
            const stage = definition.stages.find((s) => s.id === stageId);
            if (stage !== undefined) setStageModal(stage);
          }}
          // الموضع عرضٌ لا تعريف: يُحرَّك على المنشور، لا على المتقاعد
          editable={canMoveNodes(definition.status)}
          issueStageIds={issueStageIds}
        />

        <div className="flex flex-col gap-3">
          <div className="border-border bg-surface rounded-[var(--radius-card)] border p-3">
            {selectedStage === null ? (
              <p className="text-content-muted text-xs">{t.workflowMap.selectStage}</p>
            ) : (
              <StageInspector
                stage={selectedStage}
                isEditable={isEditable}
                onEditStage={() => setStageModal(selectedStage)}
                onAddParticipant={() => setParticipantModal(selectedStage)}
                onEditAction={(action) =>
                  setActionModal({ stage: selectedStage, action })
                }
                onAddRoute={(action) => setRouteModal(action)}
                onEditRequirement={(requirement) =>
                  setRequirementModal({ stage: selectedStage, requirement })
                }
              />
            )}
          </div>

          <div className="border-border bg-surface rounded-[var(--radius-card)] border p-3">
            <p className="text-content mb-1 flex items-center gap-2 text-xs font-bold">
              {errorCount > 0 ? (
                <AlertTriangle aria-hidden className="text-danger size-4" />
              ) : (
                <CheckCircle2 aria-hidden className="text-success size-4" />
              )}
              {t.workflowMap.checks}
              {issues.length > 0 && (
                <span className="text-content-muted font-normal">
                  {errorCount} {t.workflowMap.errorsCount} · {warningCount}{" "}
                  {t.workflowMap.warningsCount}
                </span>
              )}
            </p>
            <p className="text-content-muted mb-2 text-[11px]">
              {t.workflowMap.checksHint}
            </p>

            {issues.length === 0 ? (
              <p className="text-success text-xs">{t.workflowMap.noIssues}</p>
            ) : (
              <ul className="flex flex-col gap-1.5">
                {issues.map((issue, index) => (
                  <li key={`${issue.code}-${issue.stageId ?? ""}-${index}`}>
                    <button
                      type="button"
                      className="w-full text-right"
                      onClick={() => setSelectedStageId(issue.stageId)}
                    >
                      <span className="flex flex-wrap items-baseline gap-1.5">
                        <Badge
                          tone={
                            issueSeverity(issue.code) === "error" ? "danger" : "warning"
                          }
                        >
                          {ISSUE_LABELS[issue.code]}
                        </Badge>
                        {issue.stageName !== "" && (
                          <span className="text-content text-[11px]">
                            {issue.stageName}
                          </span>
                        )}
                      </span>
                      <span className="text-content-muted block text-[11px]">
                        {issue.detail}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </div>

      {definition.stages.length === 0 && (
        <EmptyState title={t.workflowAdmin.noStages} />
      )}

      {stageModal !== null && (
        <StageModal
          key={`stage-${stageModal.id}`}
          definitionId={definition.id}
          stage={stageModal}
          siblings={definition.stages}
          nextOrder={stageModal.sortOrder}
          onClose={() => setStageModal(null)}
        />
      )}

      {participantModal !== null && (
        <ParticipantModal
          key={`participant-${participantModal.id}`}
          stage={participantModal}
          onClose={() => setParticipantModal(null)}
        />
      )}

      {actionModal !== null && (
        <ActionModal
          key={actionModal.action?.id ?? `new-action-${actionModal.stage.id}`}
          stage={actionModal.stage}
          action={actionModal.action}
          onClose={() => setActionModal(null)}
        />
      )}

      {requirementModal !== null && (
        <RequirementModal
          key={
            requirementModal.requirement?.id ?? `new-req-${requirementModal.stage.id}`
          }
          stage={requirementModal.stage}
          requirement={requirementModal.requirement}
          onClose={() => setRequirementModal(null)}
        />
      )}

      {routeModal !== null && (
        <RouteModal
          key={`route-${routeModal.id}`}
          action={routeModal}
          siblings={definition.stages}
          onClose={() => setRouteModal(null)}
        />
      )}
    </div>
  );
}
