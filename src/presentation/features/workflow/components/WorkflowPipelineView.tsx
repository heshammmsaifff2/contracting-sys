/**
 * عرض مسار سير العمل كخط أنابيب مرئي متسلسل (Pipeline View).
 */
import { ArrowLeft, Clock, Users } from "lucide-react";
import type { WorkflowDefinitionDto } from "@application/modules/workflow/dtos";
import { Badge } from "@presentation/shared/ui/Badge";
import { EmptyState } from "@presentation/shared/ui/EmptyState";
import { formatDuration } from "@presentation/shared/lib/formatters";
import { ACTION_KIND_TONES, participantLabel } from "./workflow-admin-options";
import { t } from "@i18n/index";

export function WorkflowPipelineView({
  definition,
}: {
  definition: WorkflowDefinitionDto;
}) {
  if (definition.stages.length === 0) {
    return <EmptyState title={t.workflowAdmin.noStages} />;
  }

  return (
    <div className="flex flex-col gap-3" dir="rtl">
      <div className="bg-surface-sunken/40 border-border flex items-stretch gap-4 overflow-x-auto rounded-xl border p-4">
        {definition.stages.map((stage, idx) => {
          /**
           * العلامة تُقرأ من المرحلة لا من موضعها.
           *
           * كان العرض يقول «نهاية وأرشفة» لآخر بطاقة مهما كانت أعلامها،
           * فيتناقض مع القائمة واللوحة اللتين تقرآن `isArchive` الحقيقيّ —
           * ويظنّ القارئ أن مسارَه يؤرشف وهو لا يؤرشف.
           */
          const isFirst = stage.isStart || idx === 0;
          // السهم يخصّ ترتيب العرض وحده، فيبقى على الموضع
          const isLastCard = idx === definition.stages.length - 1;

          return (
            <div key={stage.id} className="flex shrink-0 items-center gap-3">
              <div className="bg-surface border-border flex w-72 flex-col gap-3 rounded-xl border p-4 shadow-xs">
                {/* رأس المرحلة */}
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <span className="bg-primary/10 text-primary flex size-6 items-center justify-center rounded-full text-xs font-bold">
                      {idx + 1}
                    </span>
                    <span className="text-content truncate text-sm font-bold">
                      {stage.name}
                    </span>
                  </div>

                  <span className="flex shrink-0 flex-wrap justify-end gap-1">
                    {isFirst && <Badge tone="info">{t.workflowAdmin.isStart}</Badge>}
                    {stage.isFinal && (
                      <Badge tone="success">{t.workflowAdmin.isFinal}</Badge>
                    )}
                    {stage.isArchive && (
                      <Badge tone="brand">{t.workflowAdmin.isArchive}</Badge>
                    )}
                    {!isFirst && !stage.isFinal && !stage.isArchive && (
                      <Badge tone="neutral">{t.workflowAdmin.stageReview}</Badge>
                    )}
                  </span>
                </div>

                <div className="text-content-muted font-mono text-[11px]">
                  {stage.stageKey}
                </div>

                {/* المشاركون */}
                <div className="border-border/60 flex flex-col gap-1.5 border-t pt-2">
                  <span className="text-content-muted flex items-center gap-1 text-xs font-medium">
                    <Users className="size-3.5" />
                    <span>المشاركون:</span>
                  </span>

                  {stage.participants.length === 0 ? (
                    <span className="text-danger text-xs font-medium">
                      لا يوجد مشاركون (مطلوب)
                    </span>
                  ) : (
                    <div className="flex flex-wrap gap-1">
                      {stage.participants.map((p) => (
                        <span
                          key={p.id}
                          className="bg-surface-sunken text-content border-border/80 rounded-md border px-2 py-0.5 text-xs"
                        >
                          {participantLabel(p)}
                        </span>
                      ))}
                    </div>
                  )}
                </div>

                {/* المهلة الزمنية */}
                {stage.slaMinutes !== null && (
                  <div className="text-content-muted flex items-center gap-1.5 text-xs">
                    <Clock className="size-3.5 text-amber-500" />
                    <span>المهلة: {formatDuration(stage.slaMinutes)}</span>
                  </div>
                )}

                {/* الإجراءات المتوفرة */}
                <div className="border-border/60 flex flex-col gap-1.5 border-t pt-2">
                  <span className="text-content-muted text-[11px] font-medium">
                    الأزرار والإجراءات ({stage.actions.length}):
                  </span>

                  {stage.actions.length === 0 ? (
                    <span className="text-content-muted text-xs">لا توجد أزرار</span>
                  ) : (
                    <div className="flex flex-wrap gap-1.5">
                      {stage.actions.map((act) => (
                        <Badge
                          key={act.id}
                          tone={ACTION_KIND_TONES[act.kind]}
                          title={act.actionKey}
                        >
                          {act.label}
                        </Badge>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* سهم الربط بين المراحل */}
              {!isLastCard && (
                <div className="text-primary/70 flex shrink-0 items-center justify-center">
                  <ArrowLeft className="size-5 animate-pulse" />
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
