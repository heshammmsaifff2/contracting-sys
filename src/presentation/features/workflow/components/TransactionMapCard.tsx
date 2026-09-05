/**
 * خريطة المعاملة — قراءة فقط.
 *
 * الجدول يقول أين كانت المعاملة؛ لا يقول **أين هي من المسار كلّه**: هل بقي
 * فرعان أم واحد، وهل ما أمامها اعتماد أم أرشفة. الخريطة تقولها بنظرة.
 *
 * تُطابَق مراحل المعاملة بمراحل التعريف بـ `stage_key` لا بالمعرّف: نسخة
 * المرحلة تحمل لقطةً من التعريف، وتعديل المسار بعد سيرها لا يعيد كتابة
 * تاريخها — فقد يختفي المعرّف ويبقى المفتاح.
 */
import { useMemo } from "react";
import type { TransactionDto } from "@application/modules/workflow/dtos";
import {
  autoLayoutStages,
  needsAutoLayout,
} from "@core/modules/workflow/entities/WorkflowGraph";
import { Card } from "@presentation/shared/ui/Card";
import { EmptyState } from "@presentation/shared/ui/EmptyState";
import { useWorkflowDefinitions } from "../hooks/useWorkflow";
import { WorkflowMap, type MapPosition, type MapStageStatus } from "./WorkflowMap";
import { t } from "@i18n/index";

/** الجارية تغلب المنجَزة: مرحلة عاد إليها المسار مرتين تُعرض بحالتها الآن. */
const STATUS_RANK: Record<MapStageStatus, number> = {
  current: 3,
  done: 2,
  skipped: 1,
  pending: 0,
};

export function TransactionMapCard({ transaction }: { transaction: TransactionDto }) {
  const definitions = useWorkflowDefinitions();

  const definition = (definitions.data ?? []).find(
    (candidate) => candidate.transactionType === transaction.type,
  );

  const positions = useMemo(() => {
    const map = new Map<string, MapPosition>();
    if (definition === undefined) return map;
    if (needsAutoLayout(definition.stages)) {
      for (const layout of autoLayoutStages(definition.stages)) {
        map.set(layout.id, { x: layout.x, y: layout.y });
      }
      return map;
    }
    for (const stage of definition.stages) {
      map.set(stage.id, { x: stage.posX, y: stage.posY });
    }
    return map;
  }, [definition]);

  const statusByStageKey = useMemo(() => {
    const map = new Map<string, MapStageStatus>();
    for (const stage of transaction.stages) {
      const status: MapStageStatus =
        stage.stageStatus === "done"
          ? "done"
          : stage.stageStatus === "cancelled" || stage.stageStatus === "skipped"
            ? "skipped"
            : "current";
      const existing = map.get(stage.stageKey);
      if (existing === undefined || STATUS_RANK[status] > STATUS_RANK[existing]) {
        map.set(stage.stageKey, status);
      }
    }
    return map;
  }, [transaction.stages]);

  return (
    <Card
      title={t.workflowMap.transactionMap}
      description={t.workflowMap.transactionMapHint}
    >
      {definition === undefined || definition.stages.length === 0 ? (
        <EmptyState title={t.workflowMap.noDefinition} />
      ) : (
        <>
          <WorkflowMap
            stages={definition.stages}
            positions={positions}
            statusByStageKey={statusByStageKey}
            height={380}
          />
          <ul className="text-content-muted mt-2 flex flex-wrap gap-3 text-[11px]">
            <li className="flex items-center gap-1.5">
              <span
                aria-hidden
                className="border-brand-500 inline-block size-3 rounded-sm border-2"
              />
              {t.workflowMap.statusCurrent}
            </li>
            <li className="flex items-center gap-1.5">
              <span
                aria-hidden
                className="border-success/60 bg-success-soft inline-block size-3 rounded-sm border"
              />
              {t.workflowMap.statusDone}
            </li>
            <li className="flex items-center gap-1.5">
              <span
                aria-hidden
                className="border-border inline-block size-3 rounded-sm border"
              />
              {t.workflowMap.statusPending}
            </li>
          </ul>
        </>
      )}
    </Card>
  );
}
