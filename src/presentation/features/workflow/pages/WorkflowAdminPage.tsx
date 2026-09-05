/**
 * مسارات سير العمل ومراحلها ومشاركوها + تقرير المدد المعدّلة.
 *
 * المرحلة حاوية لا مكلَّف: تُضاف إليها مشاركون، ومشاركان أو أكثر يعني وقوفها
 * عند أكثر من موظف في آن. و`role` وحده يتمدّد وقت التشغيل إلى كل حاملي الدور.
 * وسياسة الإنجاز هي التي تقرّر متى تُغلق.
 *
 * التسلسل لا يأتي من ترقيم بل من وجهات الأزرار، فصار المسار شبكة. ولذلك
 * عرضان لا واحد: **القائمة** تُحصي وتُحرّر حقلًا حقلًا، و**الخريطة** تُري
 * الشكل — أين يتفرّع وأين يلتقي وأين ينقطع — وتفحصه فورًا.
 */
import { useState } from "react";
import {
  Copy,
  GitBranch,
  List,
  Lock,
  Map as MapIcon,
  Pencil,
  Plus,
  Trash2,
  Upload,
  Users,
} from "lucide-react";
import type {
  DurationChangeDto,
  WorkflowActionDto,
  WorkflowDefinitionDto,
  WorkflowStageDto,
} from "@application/modules/workflow/dtos";
import { actionCarriesRoutes } from "@core/modules/workflow/entities/WorkflowAction";
import {
  isDefinitionEditable,
  type DefinitionStatus,
} from "@core/modules/workflow/entities/WorkflowGovernance";
import { describeCondition } from "@core/modules/workflow/entities/WorkflowCondition";
import { Card } from "@presentation/shared/ui/Card";
import { Badge } from "@presentation/shared/ui/Badge";
import { Button } from "@presentation/shared/ui/Button";
import { DataTable, type Column } from "@presentation/shared/ui/DataTable";
import { EmptyState } from "@presentation/shared/ui/EmptyState";
import { PermissionGate } from "@presentation/shared/ui/PermissionGate";
import { formatDateTime, formatDuration } from "@presentation/shared/lib/formatters";
import { errorMessage } from "@presentation/shared/lib/query";
import {
  useCreateWorkflowDraft,
  useDurationChanges,
  usePublishWorkflowVersion,
  useRemoveActionRoute,
  useRemoveStageParticipant,
  useRemoveWorkflowAction,
  useRemoveWorkflowStage,
  useWorkflowDefinitions,
} from "../hooks/useWorkflow";
import {
  ActionModal,
  DefinitionModal,
  ParticipantModal,
  RouteModal,
  StageModal,
} from "../components/workflow-admin-modals";
import {
  ACTION_KIND_TONES,
  participantLabel,
} from "../components/workflow-admin-options";
import { WorkflowMapEditor } from "../components/WorkflowMapEditor";
import { t } from "@i18n/index";

/** العرض يُختار لكل مسار على حدة — المحرِّر يقفز بين الشكل والتفاصيل. */
type DefinitionView = "list" | "map";

const STATUS_TONES: Record<DefinitionStatus, "success" | "warning" | "neutral"> = {
  published: "success",
  draft: "warning",
  retired: "neutral",
};

const STATUS_LABELS: Record<DefinitionStatus, string> = {
  published: t.governance.statusPublished,
  draft: t.governance.statusDraft,
  retired: t.governance.statusRetired,
};

/**
 * أزرار دورة الإصدار.
 *
 * المنشور يُنسَخ مسودّةً، والمسودّة تُنشَر. ولا يظهر الزرّان معًا: كلٌّ منهما
 * يخصّ حالةً واحدة، وإظهار ما لا يعمل يعلّم المستخدم تجاهل الأزرار.
 */
function VersionActions({
  definition,
  onMessage,
  onError,
}: {
  definition: WorkflowDefinitionDto;
  onMessage: (text: string) => void;
  onError: (text: string) => void;
}) {
  const createDraft = useCreateWorkflowDraft();
  const publish = usePublishWorkflowVersion();

  async function handleDraft() {
    try {
      await createDraft.mutateAsync(definition.id);
      onMessage(t.governance.draftCreated);
    } catch (e) {
      onError(errorMessage(e));
    }
  }

  async function handlePublish() {
    try {
      await publish.mutateAsync({
        definitionId: definition.id,
        stages: definition.stages,
      });
      onMessage(t.governance.published);
    } catch (e) {
      onError(errorMessage(e));
    }
  }

  if (definition.status === "draft") {
    return (
      <PermissionGate permission="workflow.manage">
        <Button
          size="sm"
          onClick={handlePublish}
          isLoading={publish.isPending}
          startIcon={<Upload aria-hidden className="size-4" />}
        >
          {t.governance.publish}
        </Button>
      </PermissionGate>
    );
  }

  if (definition.status !== "published") return null;

  return (
    <PermissionGate permission="workflow.manage">
      <Button
        variant="secondary"
        size="sm"
        onClick={handleDraft}
        isLoading={createDraft.isPending}
        startIcon={<Copy aria-hidden className="size-4" />}
      >
        {t.governance.createDraft}
      </Button>
    </PermissionGate>
  );
}

function DurationChangesCard() {
  const changes = useDurationChanges();

  const columns: readonly Column<DurationChangeDto>[] = [
    {
      key: "transaction",
      header: t.inbox.no,
      render: (row) => (
        <span className="tabular text-content-muted font-mono text-xs">
          #{row.transactionNo}
        </span>
      ),
    },
    {
      key: "stage",
      header: t.inbox.step,
      render: (row) => (
        <span className="flex flex-col">
          <span className="text-content text-sm">{row.stageName}</span>
          <span className="text-content-muted text-[11px]">{row.assigneeName}</span>
        </span>
      ),
    },
    {
      key: "old",
      header: t.workflowAdmin.oldMinutes,
      numeric: true,
      render: (row) => (row.oldMinutes === null ? "—" : formatDuration(row.oldMinutes)),
    },
    {
      key: "new",
      header: t.workflowAdmin.newMinutes,
      numeric: true,
      render: (row) => (
        <span className="text-content font-medium">
          {formatDuration(row.newMinutes)}
        </span>
      ),
    },
    {
      key: "reason",
      header: t.transaction.reason,
      render: (row) => (
        <span className="text-content-muted text-sm">{row.reason || "—"}</span>
      ),
    },
    {
      key: "by",
      header: t.workflowAdmin.changedBy,
      render: (row) => (
        <span className="text-content-muted text-sm">{row.changedByName}</span>
      ),
    },
    {
      key: "at",
      header: t.workflowAdmin.changedAt,
      render: (row) => (
        <span className="tabular text-content-muted text-xs">
          {formatDateTime(row.changedAt)}
        </span>
      ),
    },
  ];

  return (
    <Card
      title={t.workflowAdmin.durationChanges}
      description={t.workflowAdmin.durationChangesHint}
    >
      {changes.isError ? (
        <EmptyState title={t.common.error} description={errorMessage(changes.error)} />
      ) : (
        <DataTable
          columns={columns}
          rows={changes.data ?? []}
          rowKey={(row) => row.id}
          isLoading={changes.isPending}
          emptyTitle={t.workflowAdmin.noChanges}
        />
      )}
    </Card>
  );
}

export function WorkflowAdminPage() {
  const definitions = useWorkflowDefinitions();
  const removeStage = useRemoveWorkflowStage();
  const removeParticipant = useRemoveStageParticipant();
  const removeAction = useRemoveWorkflowAction();
  const removeRoute = useRemoveActionRoute();

  const [editingDefinition, setEditingDefinition] =
    useState<WorkflowDefinitionDto | null>(null);
  const [isDefinitionOpen, setIsDefinitionOpen] = useState(false);
  const [stageTarget, setStageTarget] = useState<{
    definitionId: string;
    stage: WorkflowStageDto | null;
    siblings: readonly WorkflowStageDto[];
    nextOrder: number;
  } | null>(null);
  const [participantTarget, setParticipantTarget] = useState<WorkflowStageDto | null>(
    null,
  );
  const [actionTarget, setActionTarget] = useState<{
    stage: WorkflowStageDto;
    action: WorkflowActionDto | null;
  } | null>(null);
  const [routeTarget, setRouteTarget] = useState<{
    action: WorkflowActionDto;
    siblings: readonly WorkflowStageDto[];
  } | null>(null);
  // العرض لكل مسار على حدة: مسار من ثلاث مراحل لا يحتاج لوحة، والمتفرّع لا يُقرأ بدونها
  const [views, setViews] = useState<Readonly<Record<string, DefinitionView>>>({});
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const rows = definitions.data ?? [];

  return (
    <div className="mx-auto flex max-w-7xl flex-col gap-6">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-content text-xl font-extrabold">
            {t.workflowAdmin.title}
          </h1>
          <p className="text-content-muted mt-1 text-sm">{t.workflowAdmin.subtitle}</p>
        </div>

        <PermissionGate permission="workflow.manage">
          <Button
            onClick={() => {
              setEditingDefinition(null);
              setIsDefinitionOpen(true);
            }}
            startIcon={<GitBranch aria-hidden className="size-4" />}
          >
            {t.workflowAdmin.add}
          </Button>
        </PermissionGate>
      </header>

      {message !== null && <p className="text-success text-sm">{message}</p>}
      {error !== null && (
        <p role="alert" className="text-danger text-sm">
          {error}
        </p>
      )}

      {definitions.isError && (
        <Card>
          <EmptyState
            title={t.common.error}
            description={errorMessage(definitions.error)}
          />
        </Card>
      )}

      {!definitions.isError && rows.length === 0 && (
        <Card>
          <EmptyState
            title={t.workflowAdmin.empty}
            description={t.workflowAdmin.emptyHint}
          />
        </Card>
      )}

      {rows.map((definition) => (
        <Card
          key={definition.id}
          title={
            <span className="flex flex-wrap items-center gap-2">
              <span>{definition.name}</span>
              <span className="text-content-muted font-mono text-xs">
                {definition.transactionType}
              </span>
              <Badge tone={STATUS_TONES[definition.status]}>
                {STATUS_LABELS[definition.status]}
              </Badge>
              <span className="text-content-muted tabular text-xs">
                {t.governance.version} {definition.version}
              </span>
              {definition.status === "published" && !definition.isActive && (
                <Badge tone="neutral">{t.items.inactive}</Badge>
              )}
            </span>
          }
          actions={
            <span className="flex flex-wrap items-center gap-1">
              <Button
                variant={
                  (views[definition.id] ?? "list") === "list" ? "secondary" : "ghost"
                }
                size="sm"
                onClick={() =>
                  setViews((current) => ({ ...current, [definition.id]: "list" }))
                }
                startIcon={<List aria-hidden className="size-4" />}
              >
                {t.workflowMap.viewList}
              </Button>
              <Button
                variant={
                  (views[definition.id] ?? "list") === "map" ? "secondary" : "ghost"
                }
                size="sm"
                onClick={() =>
                  setViews((current) => ({ ...current, [definition.id]: "map" }))
                }
                startIcon={<MapIcon aria-hidden className="size-4" />}
              >
                {t.workflowMap.viewMap}
              </Button>

              <VersionActions
                definition={definition}
                onMessage={(text) => {
                  setError(null);
                  setMessage(text);
                }}
                onError={(text) => {
                  setMessage(null);
                  setError(text);
                }}
              />

              {isDefinitionEditable(definition.status) && (
                <PermissionGate permission="workflow.manage">
                  <Button
                    variant="ghost"
                    size="sm"
                    aria-label={t.common.edit}
                    onClick={() => {
                      setEditingDefinition(definition);
                      setIsDefinitionOpen(true);
                    }}
                    startIcon={<Pencil aria-hidden className="size-4" />}
                  />
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() =>
                      setStageTarget({
                        definitionId: definition.id,
                        stage: null,
                        siblings: definition.stages,
                        nextOrder: definition.stages.length + 1,
                      })
                    }
                    startIcon={<Plus aria-hidden className="size-4" />}
                  >
                    {t.workflowAdmin.addStage}
                  </Button>
                </PermissionGate>
              )}
            </span>
          }
        >
          {!isDefinitionEditable(definition.status) && (
            <p className="border-border bg-surface-sunken text-content-muted mb-3 flex items-start gap-2 rounded-[var(--radius-control)] border p-2 text-xs">
              <Lock aria-hidden className="mt-0.5 size-3.5 shrink-0" />
              <span>
                <span className="text-content font-medium">{t.governance.frozen}</span>{" "}
                — {t.governance.frozenHint}
              </span>
            </p>
          )}

          {(views[definition.id] ?? "list") === "map" ? (
            <WorkflowMapEditor definition={definition} />
          ) : definition.stages.length === 0 ? (
            <EmptyState title={t.workflowAdmin.noStages} />
          ) : (
            <ul className="divide-border divide-y">
              {definition.stages.map((stage) => (
                <li key={stage.id} className="py-3">
                  <div className="flex flex-wrap items-center gap-3">
                    <span className="bg-surface-sunken text-content grid size-7 shrink-0 place-items-center rounded-full text-xs font-bold">
                      {stage.sortOrder}
                    </span>

                    <span className="min-w-0 flex-1">
                      <span className="text-content block text-sm font-medium">
                        {stage.name}
                        <span className="text-content-muted ms-2 font-mono text-[11px]">
                          {stage.stageKey}
                        </span>
                      </span>
                      <span className="text-content-muted block text-xs">
                        {stage.defaultNextStageName === null
                          ? t.workflowAdmin.noNextStage
                          : `${t.workflowAdmin.nextStage}: ${stage.defaultNextStageName}`}
                        {stage.slaMinutes !== null &&
                          ` · ${t.inbox.allocated}: ${formatDuration(stage.slaMinutes)}`}
                      </span>
                    </span>

                    <Badge tone="neutral">
                      {stage.completionPolicy === "all"
                        ? t.workflowAdmin.policyAll
                        : stage.completionPolicy === "any"
                          ? t.workflowAdmin.policyAny
                          : `${t.workflowAdmin.policyQuorum} (${stage.quorumCount ?? 0})`}
                    </Badge>
                    {stage.isStart && (
                      <Badge tone="success">{t.workflowAdmin.isStart}</Badge>
                    )}
                    {stage.isFinal && (
                      <Badge tone="info">{t.workflowAdmin.isFinal}</Badge>
                    )}
                    {stage.isProgramManager && (
                      <Badge tone="brand">{t.workflowAdmin.isProgramManager}</Badge>
                    )}
                    {stage.isArchive && (
                      <Badge tone="info">{t.workflowAdmin.isArchive}</Badge>
                    )}
                    {stage.requiresReceive && (
                      <Badge tone="neutral">{t.workflowAdmin.requiresReceive}</Badge>
                    )}

                    <PermissionGate permission="workflow.manage">
                      <span className="flex gap-1">
                        <Button
                          variant="ghost"
                          size="sm"
                          aria-label={t.common.edit}
                          onClick={() =>
                            setStageTarget({
                              definitionId: definition.id,
                              stage,
                              siblings: definition.stages,
                              nextOrder: stage.sortOrder,
                            })
                          }
                          startIcon={<Pencil aria-hidden className="size-4" />}
                        />
                        <Button
                          variant="ghost"
                          size="sm"
                          aria-label={t.common.delete}
                          onClick={() => removeStage.mutate(stage.id)}
                          startIcon={
                            <Trash2 aria-hidden className="text-danger size-4" />
                          }
                        />
                      </span>
                    </PermissionGate>
                  </div>

                  {/* المشاركون: أكثر من واحد = المرحلة عند أكثر من موظف */}
                  <div className="mt-2 flex flex-wrap items-center gap-2 ps-10">
                    <Users
                      aria-hidden
                      className="text-content-muted size-3.5 shrink-0"
                    />
                    {stage.participants.length === 0 ? (
                      <span className="text-warning text-xs">
                        {t.workflowAdmin.noParticipants}
                      </span>
                    ) : (
                      stage.participants.map((participant) => (
                        <span
                          key={participant.id}
                          className="border-border text-content-muted flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px]"
                        >
                          {participantLabel(participant)}
                          {participant.isOptional && ` · ${t.workflowAdmin.isOptional}`}
                          <PermissionGate permission="workflow.manage">
                            <button
                              type="button"
                              aria-label={t.common.delete}
                              className="text-danger ms-1"
                              onClick={() => removeParticipant.mutate(participant.id)}
                            >
                              ×
                            </button>
                          </PermissionGate>
                        </span>
                      ))
                    )}

                    <PermissionGate permission="workflow.manage">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setParticipantTarget(stage)}
                        startIcon={<Plus aria-hidden className="size-3.5" />}
                      >
                        {t.workflowAdmin.addParticipant}
                      </Button>
                    </PermissionGate>
                  </div>

                  {/* الأزرار ووجهاتها المشروطة — هنا يقع التفريع */}
                  <div className="mt-2 ps-10">
                    <div className="flex flex-wrap items-center gap-2">
                      <GitBranch
                        aria-hidden
                        className="text-content-muted size-3.5 shrink-0"
                      />
                      {stage.actions.length === 0 && (
                        <span className="text-content-muted text-xs">
                          {t.workflowAdmin.noActionsYet}
                        </span>
                      )}
                      <PermissionGate permission="workflow.manage">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setActionTarget({ stage, action: null })}
                          startIcon={<Plus aria-hidden className="size-3.5" />}
                        >
                          {t.workflowAdmin.addAction}
                        </Button>
                      </PermissionGate>
                    </div>

                    {stage.actions.length > 0 && (
                      <ul className="mt-1 flex flex-col gap-1.5">
                        {stage.actions.map((action) => (
                          <li
                            key={action.id}
                            className="border-border rounded-[var(--radius-control)] border px-2 py-1.5"
                          >
                            <div className="flex flex-wrap items-center gap-2">
                              <Badge tone={ACTION_KIND_TONES[action.kind]}>
                                {action.label}
                              </Badge>
                              <span className="text-content-muted font-mono text-[11px]">
                                {action.actionKey}
                              </span>
                              {action.requiresNote && (
                                <span className="text-content-muted text-[11px]">
                                  · {t.workflowAdmin.requiresNote}
                                </span>
                              )}
                              {action.returnMinutes !== null && (
                                <span className="text-content-muted text-[11px]">
                                  · {t.workflowAdmin.returnMinutes}:{" "}
                                  {formatDuration(action.returnMinutes)}
                                </span>
                              )}

                              <PermissionGate permission="workflow.manage">
                                <span className="ms-auto flex gap-1">
                                  {actionCarriesRoutes(action.kind) && (
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      onClick={() =>
                                        setRouteTarget({
                                          action,
                                          siblings: definition.stages,
                                        })
                                      }
                                      startIcon={
                                        <Plus aria-hidden className="size-3.5" />
                                      }
                                    >
                                      {t.workflowAdmin.addRoute}
                                    </Button>
                                  )}
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    aria-label={t.common.edit}
                                    onClick={() => setActionTarget({ stage, action })}
                                    startIcon={
                                      <Pencil aria-hidden className="size-3.5" />
                                    }
                                  />
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    aria-label={t.common.delete}
                                    onClick={() => removeAction.mutate(action.id)}
                                    startIcon={
                                      <Trash2
                                        aria-hidden
                                        className="text-danger size-3.5"
                                      />
                                    }
                                  />
                                </span>
                              </PermissionGate>
                            </div>

                            {/* زرّ بلا وجهة يوقف المسار عنده */}
                            {actionCarriesRoutes(action.kind) &&
                              action.routes.length === 0 && (
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
                                    <span className="tabular font-mono">
                                      #{route.priority}
                                    </span>
                                    <span>{describeCondition(route.condition)}</span>
                                    <span className="text-content">
                                      ← {route.targetStageName ?? "—"}
                                    </span>
                                    <PermissionGate permission="workflow.manage">
                                      <button
                                        type="button"
                                        aria-label={t.common.delete}
                                        className="text-danger"
                                        onClick={() => removeRoute.mutate(route.id)}
                                      >
                                        ×
                                      </button>
                                    </PermissionGate>
                                  </li>
                                ))}
                              </ul>
                            )}
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Card>
      ))}

      <PermissionGate permission="duration.manage">
        <DurationChangesCard />
      </PermissionGate>

      {isDefinitionOpen && (
        <DefinitionModal
          key={editingDefinition?.id ?? "new"}
          definition={editingDefinition}
          onClose={() => setIsDefinitionOpen(false)}
        />
      )}

      {stageTarget !== null && (
        <StageModal
          key={stageTarget.stage?.id ?? "new-stage"}
          definitionId={stageTarget.definitionId}
          stage={stageTarget.stage}
          siblings={stageTarget.siblings}
          nextOrder={stageTarget.nextOrder}
          onClose={() => setStageTarget(null)}
        />
      )}

      {participantTarget !== null && (
        <ParticipantModal
          key={participantTarget.id}
          stage={participantTarget}
          onClose={() => setParticipantTarget(null)}
        />
      )}

      {actionTarget !== null && (
        <ActionModal
          key={actionTarget.action?.id ?? `new-action-${actionTarget.stage.id}`}
          stage={actionTarget.stage}
          action={actionTarget.action}
          onClose={() => setActionTarget(null)}
        />
      )}

      {routeTarget !== null && (
        <RouteModal
          key={`route-${routeTarget.action.id}`}
          action={routeTarget.action}
          siblings={routeTarget.siblings}
          onClose={() => setRouteTarget(null)}
        />
      )}
    </div>
  );
}
