import { useState } from "react";
import {
  Sliders,
  Route,
  Plus,
  Trash2,
  Clock,
  Calendar,
  ShieldCheck,
  CornerDownLeft,
  Layers,
  FileText,
  Check,
} from "lucide-react";
import { Modal } from "@presentation/shared/ui/Modal";
import { Input } from "@presentation/shared/ui/Input";
import { Select } from "@presentation/shared/ui/Select";
import { Button } from "@presentation/shared/ui/Button";
import { Badge } from "@presentation/shared/ui/Badge";
import type { ActionKind } from "@core/modules/workflow/entities/WorkflowAction";
import { actionSupportsReturnMinutes } from "@core/modules/workflow/entities/WorkflowAction";
import type { ConditionOp } from "@core/modules/workflow/entities/WorkflowCondition";
import type { CompletionPolicy } from "@core/modules/workflow/entities/StageInstance";
import type { ClaimPolicy } from "@core/modules/workflow/entities/WorkflowGovernance";
import type {
  DeadlineAction,
  JoinPolicy,
  RequirementScope,
} from "@application/modules/workflow/dtos";
import {
  ACTION_KIND_OPTIONS,
  ACTION_KIND_TONES,
  DEADLINE_ACTION_OPTIONS,
  OP_OPTIONS,
  WEEKDAY_OPTIONS,
} from "./workflow-admin-options";
import type {
  PipelineStageItem,
  StageActionItem,
  StageRouteItem,
  StageConditionItem,
} from "./WorkflowPipelineBuilder";

// ── 1. مودال الخيارات والسياسات المتقدمة للمرحلة ─────────────────────────

export interface StageAdvancedConfigModalProps {
  isOpen: boolean;
  onClose: () => void;
  stage: PipelineStageItem | null;
  stageIndex: number;
  totalStages?: number;
  onSave: (index: number, updated: Partial<PipelineStageItem>) => void;
}

export function StageAdvancedConfigModal({
  isOpen,
  onClose,
  stage,
  stageIndex,
  onSave,
}: StageAdvancedConfigModalProps) {
  /**
   * نسخةٌ تُهيَّأ مرّةً عند التركيب لا في أثرٍ جانبيّ.
   *
   * كان الأثر ينسخ المرحلة كلّما تغيّرت الخصائص فيُطلق عرضًا متتاليًا.
   * والنافذة تُركَّب من جديد عند كل فتح — `key` عند المُنادي — فالتهيئة
   * الكسولة تكفي، وتحرير المستخدم لا يُداس عليه بنسخةٍ جديدة.
   */
  const [draft, setDraft] = useState<PipelineStageItem | null>(() =>
    stage ? (JSON.parse(JSON.stringify(stage)) as PipelineStageItem) : null,
  );

  if (!stage || !draft) return null;

  function updateDraft(patch: Partial<PipelineStageItem>) {
    setDraft((prev) => (prev ? { ...prev, ...patch } : null));
  }

  function handleSave() {
    if (!draft) return;
    onSave(stageIndex, {
      completionPolicy: draft.completionPolicy,
      quorumCount: draft.quorumCount,
      joinPolicy: draft.joinPolicy,
      claimPolicy: draft.claimPolicy,
      requiresReceive: draft.requiresReceive,
      isArchive: draft.isArchive,
      isProgramManager: draft.isProgramManager,
      returnHours: draft.returnHours,
      returnMinutes: draft.returnMinutes,
      requiresAttachment: draft.requiresAttachment,
      minAttachments: draft.minAttachments,
      attachmentMessage: draft.attachmentMessage,
      conditions: draft.conditions,
      hasDeadline: draft.hasDeadline,
      deadlineTime: draft.deadlineTime,
      deadlineDays: draft.deadlineDays,
      deadlineAction: draft.deadlineAction,
    });
    onClose();
  }

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      size="lg"
      title={`الخيارات والسياسات المتقدمة: ${draft.name || `المرحلة ${stageIndex + 1}`}`}
      description="ضبط سياسات الإنجاز والمطالبة، مهل الإرجاع، شروط الجاهزية والمرفقات، والمواعيد الأسبوعية"
      footer={
        <div className="flex w-full items-center justify-between gap-3">
          <div className="text-content-muted flex items-center gap-1.5 text-xs">
            <Sliders className="text-primary size-4" />
            <span>تنطبق هذه الإعدادات على المرحلة الحالية فقط</span>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="ghost" onClick={onClose}>
              إلغاء
            </Button>
            <Button
              variant="primary"
              onClick={handleSave}
              startIcon={<Check className="size-4" />}
            >
              حفظ السياسات والإعدادات
            </Button>
          </div>
        </div>
      }
    >
      <div className="flex flex-col gap-5 py-1 text-xs" dir="rtl">
        {/* القسم 1: سياسات الإنجاز والالتقاء */}
        <div className="bg-surface-sunken/70 border-border/80 flex flex-col gap-3 rounded-xl border p-3.5">
          <h4 className="text-content flex items-center gap-1.5 text-xs font-bold">
            <Layers className="text-primary size-4" />
            <span>سياسات الإنجاز والالتقاء والمطالبة</span>
          </h4>

          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            {/* سياسة الإنجاز */}
            <div className="flex flex-col gap-1">
              <label className="text-content-muted font-medium">
                سياسة الإنجاز للمرحلة:
              </label>
              <Select
                value={draft.completionPolicy}
                onChange={(e) =>
                  updateDraft({ completionPolicy: e.target.value as CompletionPolicy })
                }
                options={[
                  { value: "all", label: "الجميع (يجب موافقة كل المشاركين)" },
                  { value: "any", label: "أوّلهم (يكفي أول من يعتمد)" },
                  { value: "quorum", label: "نصاب عددي محدد" },
                ]}
              />
            </div>

            {/* النصاب العددي إن اختير */}
            {draft.completionPolicy === "quorum" && (
              <div className="flex flex-col gap-1">
                <label className="text-content-muted font-medium">
                  عدد الأصوات المطلوبة (النصاب):
                </label>
                <Input
                  type="number"
                  min="1"
                  max={Math.max(1, draft.participants.length)}
                  value={draft.quorumCount}
                  onChange={(e) =>
                    updateDraft({ quorumCount: Math.max(1, Number(e.target.value)) })
                  }
                  className="font-bold"
                />
              </div>
            )}

            {/* سياسة الالتقاء */}
            <div className="flex flex-col gap-1">
              <label className="text-content-muted font-medium">
                سياسة الالتقاء والتجميع:
              </label>
              <Select
                value={draft.joinPolicy}
                onChange={(e) =>
                  updateDraft({ joinPolicy: e.target.value as JoinPolicy })
                }
                options={[
                  { value: "none", label: "عادية (بدون انتظار الفروع السابقة)" },
                  {
                    value: "wait_all",
                    label: "انتظار الجميع (wait_all) — محطة تجميع فروع التوازي",
                  },
                ]}
              />
            </div>

            {/* سياسة المطالبة والحجز */}
            <div className="flex flex-col gap-1">
              <label className="text-content-muted font-medium">
                سياسة المطالبة والحجز:
              </label>
              <Select
                value={draft.claimPolicy}
                onChange={(e) =>
                  updateDraft({ claimPolicy: e.target.value as ClaimPolicy })
                }
                options={[
                  { value: "none", label: "بدون حجز (متاحة للجميع معاً)" },
                  { value: "exclusive", label: "حصرية للآخذ (يستلمها موظف واحد)" },
                  { value: "soft_lock", label: "قفل مرن (تنبيه عند العمل المتزامن)" },
                ]}
              />
            </div>
          </div>

          {/* تنبيه توضيحي لسياسة wait_all */}
          {draft.joinPolicy === "wait_all" && (
            <div className="flex items-center gap-2 rounded-lg border border-blue-300 bg-blue-50 p-2.5 text-xs font-medium text-blue-950 dark:border-blue-700/80 dark:bg-blue-950/60 dark:text-blue-100">
              <Layers className="size-4 shrink-0 text-blue-700 dark:text-blue-300" />
              <span>
                <strong>محطة تجميع (wait_all):</strong> لن تبدأ هذه المرحلة حتى تكتمل
                كافة الفروع السابقة، مما يضمن تزامن المسارات المتوازية.
              </span>
            </div>
          )}

          {/* خيارات إضافية */}
          <div className="border-border/60 flex flex-wrap items-center gap-4 border-t pt-1">
            <label className="text-content flex cursor-pointer items-center gap-2 font-medium">
              <input
                type="checkbox"
                checked={draft.requiresReceive}
                onChange={(e) => updateDraft({ requiresReceive: e.target.checked })}
                className="text-primary rounded border-gray-300"
              />
              <span>اشتراط تأكيد استلام المعاملة قبل بدء العمل عليها</span>
            </label>

            {/* الأرشفة كانت مضمرة في موضع المرحلة — والمضمر لا يُراجَع */}
            <label className="text-content flex cursor-pointer items-center gap-2 font-medium">
              <input
                type="checkbox"
                checked={draft.isArchive}
                disabled={stageIndex === 0}
                onChange={(e) => updateDraft({ isArchive: e.target.checked })}
                className="text-primary rounded border-gray-300"
              />
              <span>
                مرحلة أرشيف — بعد إغلاقها تدخل المعاملة طابور الأرشيف لإيداع الأصل
                الورقيّ وفهرسته
              </span>
            </label>

            <label className="text-content flex cursor-pointer items-center gap-2 font-medium">
              <input
                type="checkbox"
                checked={draft.isProgramManager}
                onChange={(e) => updateDraft({ isProgramManager: e.target.checked })}
                className="text-primary rounded border-gray-300"
              />
              <span>مرحلة خاصة بمدير البرنامج / المشروع</span>
            </label>
          </div>
        </div>

        {/* القسم 2: مهلة الإرجاع عند الرفض والتعديل */}
        <div className="bg-surface-sunken/70 border-border/80 flex flex-col gap-3 rounded-xl border p-3.5">
          <div className="flex items-center justify-between">
            <h4 className="text-content flex items-center gap-1.5 text-xs font-bold">
              <Clock className="size-4 text-amber-600 dark:text-amber-400" />
              <span>مهلة الإرجاع والتصحيح عند طلب التعديل:</span>
            </h4>
            {(draft.returnHours > 0 || draft.returnMinutes > 0) && (
              <span className="font-mono text-[11px] font-bold text-amber-600 dark:text-amber-400">
                {draft.returnHours > 0 ? `${draft.returnHours} س ` : ""}
                {draft.returnMinutes > 0 ? `${draft.returnMinutes} د` : ""}
              </span>
            )}
          </div>
          <p className="text-content-muted text-[11px]">
            المدة الممنوحة للمرحلة السابقة لإعادة إرسال المعاملة بعد طلب التعديل أو
            الملاحظات قبل التصعيد.
          </p>

          <div className="grid grid-cols-2 gap-2">
            <div className="bg-surface border-border flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5">
              <Input
                type="number"
                min="0"
                value={draft.returnHours === 0 ? "" : draft.returnHours}
                onChange={(e) =>
                  updateDraft({ returnHours: Math.max(0, Number(e.target.value)) })
                }
                placeholder="0"
                className="text-center font-bold"
              />
              <span className="text-content-muted shrink-0 text-xs">ساعة</span>
            </div>

            <div className="bg-surface border-border flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5">
              <Input
                type="number"
                min="0"
                max="59"
                value={draft.returnMinutes === 0 ? "" : draft.returnMinutes}
                onChange={(e) =>
                  updateDraft({
                    returnMinutes: Math.max(0, Math.min(59, Number(e.target.value))),
                  })
                }
                placeholder="0"
                className="text-center font-bold"
              />
              <span className="text-content-muted shrink-0 text-xs">دقيقة</span>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-1.5">
            {[
              { label: "1 ساعة", h: 1, m: 0 },
              { label: "2 ساعة", h: 2, m: 0 },
              { label: "4 ساعات", h: 4, m: 0 },
              { label: "24 ساعة (يوم)", h: 24, m: 0 },
            ].map((preset) => (
              <button
                key={preset.label}
                type="button"
                onClick={() =>
                  updateDraft({ returnHours: preset.h, returnMinutes: preset.m })
                }
                className="border-border bg-surface rounded-md border px-2.5 py-1 text-[11px] font-medium transition-colors hover:border-amber-500 hover:text-amber-600"
              >
                {preset.label}
              </button>
            ))}
          </div>
        </div>

        {/* القسم 3: الموعد الأسبوعي الثابت للإقفال */}
        <div className="bg-surface-sunken/70 border-border/80 flex flex-col gap-3 rounded-xl border p-3.5">
          <div className="flex items-center justify-between">
            <label className="text-content flex cursor-pointer items-center gap-2 text-xs font-bold">
              <input
                type="checkbox"
                checked={draft.hasDeadline}
                onChange={(e) => updateDraft({ hasDeadline: e.target.checked })}
                className="rounded border-gray-300 text-purple-600"
              />
              <Calendar className="size-4 text-purple-600 dark:text-purple-400" />
              <span>موعد أسبوعي ثابت في التقويم (Weekly Calendar Deadline)</span>
            </label>
            {draft.hasDeadline && <Badge tone="warning">مفعّل</Badge>}
          </div>

          <p className="text-content-muted text-[11px]">
            تحديد يوم ووقت أسبوعي ثابت للاستحقاق (مثل كل أحد وخميس الساعة 12:00 ظهراً)
            غير المهلة الزمنية النسبية.
          </p>

          {draft.hasDeadline && (
            <div className="border-border/60 flex flex-col gap-3 border-t pt-1">
              <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                {/* وقت الاستحقاق */}
                <div className="flex flex-col gap-1">
                  <label className="text-content-muted font-medium">
                    وقت الاستحقاق في اليوم المحدد:
                  </label>
                  <Input
                    type="time"
                    value={draft.deadlineTime || "12:00"}
                    onChange={(e) => updateDraft({ deadlineTime: e.target.value })}
                    className="text-center font-mono font-bold"
                  />
                </div>

                {/* الإجراء عند التجاوز */}
                <div className="flex flex-col gap-1">
                  <label className="text-content-muted font-medium">
                    الإجراء التلقائي عند التجاوز:
                  </label>
                  <Select
                    value={draft.deadlineAction}
                    onChange={(e) =>
                      updateDraft({ deadlineAction: e.target.value as DeadlineAction })
                    }
                    options={DEADLINE_ACTION_OPTIONS.map((opt) => ({
                      value: opt.value,
                      label: opt.label,
                    }))}
                  />
                </div>
              </div>

              {/* اختيار أيام الأسبوع */}
              <div className="flex flex-col gap-1.5">
                <label className="text-content-muted font-medium">
                  أيام الاستحقاق الأسبوعية:
                </label>
                <div className="flex flex-wrap gap-1.5">
                  {WEEKDAY_OPTIONS.map((day) => {
                    const isSelected = draft.deadlineDays.includes(day.value);
                    return (
                      <button
                        key={day.value}
                        type="button"
                        onClick={() => {
                          const nextDays = isSelected
                            ? draft.deadlineDays.filter((d) => d !== day.value)
                            : [...draft.deadlineDays, day.value];
                          updateDraft({ deadlineDays: nextDays });
                        }}
                        className={`rounded-lg px-2.5 py-1 text-xs font-semibold transition-all ${
                          isSelected
                            ? "bg-purple-600 text-white shadow-xs"
                            : "border-border bg-surface text-content hover:bg-surface-sunken border"
                        }`}
                      >
                        {day.label}
                      </button>
                    );
                  })}
                </div>
                {draft.deadlineDays.length === 0 && (
                  <span className="text-[10px] font-medium text-amber-600 dark:text-amber-400">
                    * يرجى اختيار يوم واحد على الأقل للموعد الأسبوعي
                  </span>
                )}
              </div>
            </div>
          )}
        </div>

        {/* القسم 4: شروط الجاهزية والمرفقات والتحقق المنطقي */}
        <div className="bg-surface-sunken/70 border-border/80 flex flex-col gap-3 rounded-xl border p-3.5">
          <div className="flex items-center justify-between">
            <h4 className="text-content flex items-center gap-1.5 text-xs font-bold">
              <ShieldCheck className="size-4 text-emerald-600 dark:text-emerald-400" />
              <span>شروط الجاهزية والمرفقات والتحقق المنطقي (Readiness)</span>
            </h4>
            {(draft.requiresAttachment || draft.conditions.length > 0) && (
              <Badge tone="success">
                {draft.requiresAttachment ? "مرفقات مطلوبة" : ""}{" "}
                {draft.conditions.length > 0 ? `+ ${draft.conditions.length} شروط` : ""}
              </Badge>
            )}
          </div>

          {/* اشتراط المرفقات */}
          <div className="bg-surface border-border/80 flex flex-col gap-2.5 rounded-lg border p-3">
            <label className="text-content flex cursor-pointer items-center gap-2 font-bold">
              <input
                type="checkbox"
                checked={draft.requiresAttachment}
                onChange={(e) => updateDraft({ requiresAttachment: e.target.checked })}
                className="rounded border-gray-300 text-emerald-600"
              />
              <FileText className="size-3.5 text-emerald-600 dark:text-emerald-400" />
              <span>اشتراط إرفاق مستندات قبل الاعتماد (Attachment Requirement)</span>
            </label>

            {draft.requiresAttachment && (
              <div className="border-border/60 grid grid-cols-1 gap-2.5 border-t pt-1 md:grid-cols-3">
                <div className="flex flex-col gap-1">
                  <label className="text-content-muted text-[11px] font-medium">
                    الحد الأدنى للملفات:
                  </label>
                  <Input
                    type="number"
                    min="1"
                    max="10"
                    value={draft.minAttachments}
                    onChange={(e) =>
                      updateDraft({
                        minAttachments: Math.max(1, Number(e.target.value)),
                      })
                    }
                    className="text-center font-bold"
                  />
                </div>
                <div className="flex flex-col gap-1 md:col-span-2">
                  <label className="text-content-muted text-[11px] font-medium">
                    رسالة التنبيه إن لم تُرفق:
                  </label>
                  <Input
                    value={draft.attachmentMessage}
                    onChange={(e) => updateDraft({ attachmentMessage: e.target.value })}
                    placeholder="يرجى إرفاق المستند قبل الاعتماد"
                  />
                </div>
              </div>
            )}
          </div>

          {/* الشروط المنطقية على الحقول */}
          <div className="bg-surface border-border/80 flex flex-col gap-2.5 rounded-lg border p-3">
            <div className="flex items-center justify-between">
              <span className="text-content flex items-center gap-1.5 font-bold">
                <span>الشروط المنطقية المتقدمة على البيانات (Field Conditions)</span>
                <span className="text-content-muted text-[11px] font-normal">
                  ({draft.conditions.length})
                </span>
              </span>
              <button
                type="button"
                onClick={() => {
                  const newCond: StageConditionItem = {
                    id: `c_${Date.now()}`,
                    field: "amount",
                    op: "gt",
                    value: "1000",
                    message: "القيمة لا تلبي شرط الاعتماد في هذه المرحلة",
                    appliesTo: "advancing",
                  };
                  updateDraft({ conditions: [...draft.conditions, newCond] });
                }}
                className="flex items-center gap-1 rounded-md bg-emerald-600 px-2.5 py-1 text-xs font-semibold text-white transition-colors hover:bg-emerald-700"
              >
                <Plus className="size-3.5" />
                <span>إضافة شرط منطقي</span>
              </button>
            </div>

            {draft.conditions.length === 0 ? (
              <p className="text-content-muted py-1 text-[11px]">
                لا توجد شروط منطقية محددة لهذه المرحلة (يمكن لأي معاملة جاهزة المرور
                تلقائياً).
              </p>
            ) : (
              <div className="flex flex-col gap-2 pt-1">
                {draft.conditions.map((cond, cIdx) => (
                  <div
                    key={cond.id || cIdx}
                    className="bg-surface-sunken border-border flex flex-col gap-2 rounded-lg border p-2.5"
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-content text-[11px] font-bold">
                        الشرط #{cIdx + 1}
                      </span>
                      <button
                        type="button"
                        onClick={() =>
                          updateDraft({
                            conditions: draft.conditions.filter((_, i) => i !== cIdx),
                          })
                        }
                        className="text-danger hover:bg-danger/10 rounded p-1 transition-colors"
                      >
                        <Trash2 className="size-3.5" />
                      </button>
                    </div>

                    <div className="grid grid-cols-1 gap-2 md:grid-cols-3">
                      <div className="flex flex-col gap-0.5">
                        <label className="text-content-muted text-[10px]">
                          الحقل أو المعرف:
                        </label>
                        <Input
                          value={cond.field}
                          onChange={(e) => {
                            const next = [...draft.conditions];
                            const cur = next[cIdx];
                            if (cur) next[cIdx] = { ...cur, field: e.target.value };
                            updateDraft({ conditions: next });
                          }}
                          placeholder="مثال: amount أو total"
                          className="font-mono text-xs"
                        />
                      </div>

                      <div className="flex flex-col gap-0.5">
                        <label className="text-content-muted text-[10px]">
                          المعامل:
                        </label>
                        <Select
                          value={cond.op}
                          onChange={(e) => {
                            const next = [...draft.conditions];
                            const cur = next[cIdx];
                            if (cur)
                              next[cIdx] = {
                                ...cur,
                                op: e.target.value as ConditionOp,
                              };
                            updateDraft({ conditions: next });
                          }}
                          options={OP_OPTIONS}
                        />
                      </div>

                      <div className="flex flex-col gap-0.5">
                        <label className="text-content-muted text-[10px]">
                          القيمة المستهدفة:
                        </label>
                        <Input
                          value={cond.value}
                          onChange={(e) => {
                            const next = [...draft.conditions];
                            const cur = next[cIdx];
                            if (cur) next[cIdx] = { ...cur, value: e.target.value };
                            updateDraft({ conditions: next });
                          }}
                          placeholder="مثال: 50000 أو completed"
                          className="text-xs"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-1 gap-2 md:grid-cols-3">
                      <div className="flex flex-col gap-0.5 md:col-span-2">
                        <label className="text-content-muted text-[10px]">
                          نص التنبيه عند عدم التحقق:
                        </label>
                        <Input
                          value={cond.message}
                          onChange={(e) => {
                            const next = [...draft.conditions];
                            const cur = next[cIdx];
                            if (cur) next[cIdx] = { ...cur, message: e.target.value };
                            updateDraft({ conditions: next });
                          }}
                          placeholder="رسالة للمستخدم توضح ما ينقص"
                          className="text-xs"
                        />
                      </div>

                      <div className="flex flex-col gap-0.5">
                        <label className="text-content-muted text-[10px]">
                          نطاق التطبيق:
                        </label>
                        <Select
                          value={cond.appliesTo}
                          onChange={(e) => {
                            const next = [...draft.conditions];
                            const cur = next[cIdx];
                            if (cur)
                              next[cIdx] = {
                                ...cur,
                                appliesTo: e.target.value as RequirementScope,
                              };
                            updateDraft({ conditions: next });
                          }}
                          options={[
                            { value: "advancing", label: "عند إجراءات التقدم فقط" },
                            { value: "any_action", label: "عند أي إجراء في المرحلة" },
                          ]}
                        />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </Modal>
  );
}

// ── 2. مودال تخصيص أزرار المرحلة ومساراتها الشرطية ────────────────────────

export interface StageCustomActionsModalProps {
  isOpen: boolean;
  onClose: () => void;
  stage: PipelineStageItem | null;
  stageIndex: number;
  stages: PipelineStageItem[];
  onSave: (index: number, updated: Partial<PipelineStageItem>) => void;
  createDefaultActions: (
    idx: number,
    total: number,
    allStages: PipelineStageItem[],
  ) => StageActionItem[];
}

export function StageCustomActionsModal({
  isOpen,
  onClose,
  stage,
  stageIndex,
  stages,
  onSave,
  createDefaultActions,
}: StageCustomActionsModalProps) {
  const [draft, setDraft] = useState<PipelineStageItem | null>(() => {
    if (!stage) return null;
    const copy = JSON.parse(JSON.stringify(stage)) as PipelineStageItem;
    // أزرارٌ افتراضية حين يُفتح الوضع المخصّص فارغًا — أفضل من صفحة بيضاء
    if (copy.customActionsEnabled && copy.actions.length === 0) {
      copy.actions = createDefaultActions(stageIndex, stages.length, stages);
    }
    return copy;
  });

  if (!stage || !draft) return null;

  function updateDraft(patch: Partial<PipelineStageItem>) {
    setDraft((prev) => (prev ? { ...prev, ...patch } : null));
  }

  function handleSave() {
    if (!draft) return;
    onSave(stageIndex, {
      customActionsEnabled: draft.customActionsEnabled,
      actions: draft.actions,
    });
    onClose();
  }

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      size="xl"
      title={`تخصيص أزرار المرحلة ومساراتها: ${draft.name || `المرحلة ${stageIndex + 1}`}`}
      description="التحكم الكامل بالأزرار التي تظهر للمستخدم عند فتح المعاملة ومسارات التوجيه الشرطي لكل زر"
      footer={
        <div className="flex w-full items-center justify-between gap-3">
          <div className="text-content-muted flex items-center gap-1.5 text-xs">
            <Route className="size-4 text-amber-600 dark:text-amber-400" />
            <span>
              {draft.customActionsEnabled
                ? `سيتم حفظ ${draft.actions.length} أزرار مخصصة لهذه المرحلة`
                : "سيتم استخدام الأزرار التلقائية الافتراضية (اعتماد / إرجاع / رفض)"}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="ghost" onClick={onClose}>
              إلغاء
            </Button>
            <Button
              variant="primary"
              onClick={handleSave}
              startIcon={<Check className="size-4" />}
            >
              حفظ الأزرار والمسارات
            </Button>
          </div>
        </div>
      }
    >
      <div className="flex flex-col gap-4 py-1 text-xs" dir="rtl">
        {/* مفتاح التبديل بين الوضع التلقائي والوضع المخصص */}
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          {/* خيار الأزرار التلقائية */}
          <button
            type="button"
            onClick={() => updateDraft({ customActionsEnabled: false })}
            className={`flex flex-col gap-1.5 rounded-xl border p-3.5 text-right transition-all ${
              !draft.customActionsEnabled
                ? "border-primary bg-primary/10 ring-primary text-primary shadow-xs ring-1"
                : "border-border bg-surface hover:bg-surface-sunken text-content"
            }`}
          >
            <div className="flex items-center justify-between">
              <span className="flex items-center gap-1.5 text-xs font-bold">
                <div
                  className={`flex size-4 items-center justify-center rounded-full border ${!draft.customActionsEnabled ? "border-primary" : "border-border"}`}
                >
                  {!draft.customActionsEnabled && (
                    <div className="bg-primary size-2 rounded-full" />
                  )}
                </div>
                <span>الربط التلقائي القياسي (موصى به)</span>
              </span>
              <Badge tone="info">افتراضي</Badge>
            </div>
            <p className="text-content-muted text-[11px] leading-relaxed">
              يولد النظام تلقائياً أزرار الاعتماد (للأمام)، والإرجاع للمراجعة (للخلف)،
              والرفض، بناءً على ترتيب المراحل.
            </p>
          </button>

          {/* خيار الأزرار المخصصة */}
          <button
            type="button"
            onClick={() => {
              const acts =
                draft.actions.length > 0
                  ? draft.actions
                  : createDefaultActions(stageIndex, stages.length, stages);
              updateDraft({ customActionsEnabled: true, actions: acts });
            }}
            className={`flex flex-col gap-1.5 rounded-xl border p-3.5 text-right transition-all ${
              draft.customActionsEnabled
                ? "border-amber-500 bg-amber-500/10 text-amber-800 shadow-xs ring-1 ring-amber-500 dark:text-amber-200"
                : "border-border bg-surface hover:bg-surface-sunken text-content"
            }`}
          >
            <div className="flex items-center justify-between">
              <span className="flex items-center gap-1.5 text-xs font-bold">
                <div
                  className={`flex size-4 items-center justify-center rounded-full border ${draft.customActionsEnabled ? "border-amber-500" : "border-border"}`}
                >
                  {draft.customActionsEnabled && (
                    <div className="size-2 rounded-full bg-amber-500" />
                  )}
                </div>
                <span>أزرار مخصصة مع توجيه شرطي (Custom Actions)</span>
              </span>
              <Badge tone="warning">مخصص</Badge>
            </div>
            <p className="text-content-muted text-[11px] leading-relaxed">
              تحكم كامل في أسماء الأزرار، أنواعها (تقدم، إرجاع، ملاحظة، إغلاق)،
              متطلباتها، والوجهات الشرطية لكل زر.
            </p>
          </button>
        </div>

        {/* إن كان الوضع المخصص مفعلاً */}
        {draft.customActionsEnabled && (
          <div className="bg-surface-sunken/60 border-border/80 flex flex-col gap-3 rounded-xl border p-3.5">
            <div className="border-border/60 flex flex-wrap items-center justify-between gap-2 border-b pb-3">
              <div className="flex items-center gap-2">
                <span className="text-content text-xs font-bold">
                  قائمة أزرار المرحلة:
                </span>
                <Badge tone="neutral">{draft.actions.length} أزرار</Badge>
              </div>

              <div className="flex items-center gap-2">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    const defaultActs = createDefaultActions(
                      stageIndex,
                      stages.length,
                      stages,
                    );
                    updateDraft({ actions: defaultActs });
                  }}
                >
                  إعادة تعيين للأزرار القياسية
                </Button>
                <Button
                  variant="primary"
                  size="sm"
                  onClick={() => {
                    const nextStage = stages[stageIndex + 1];
                    const newAct: StageActionItem = {
                      id: `act_${Date.now()}_${draft.actions.length + 1}`,
                      actionKey: `action_${draft.actions.length + 1}`,
                      label: `إجراء ${draft.actions.length + 1}`,
                      kind: "forward" as ActionKind,
                      sortOrder: draft.actions.length + 1,
                      requiresNote: false,
                      requiresAttachment: false,
                      requiresEvaluation: false,
                      returnHours: 0,
                      returnMinutes: 0,
                      routes:
                        stageIndex < stages.length - 1 && nextStage
                          ? [
                              {
                                id: `rt_${Date.now()}`,
                                targetStageKey: nextStage.stageKey,
                                priority: 10,
                                hasCondition: false,
                                field: "amount",
                                op: "gt" as ConditionOp,
                                value: "",
                              },
                            ]
                          : [],
                    };
                    updateDraft({ actions: [...draft.actions, newAct] });
                  }}
                  startIcon={<Plus className="size-3.5" />}
                >
                  إضافة زر جديد
                </Button>
              </div>
            </div>

            {/* قائمة كروت الأزرار */}
            {draft.actions.length === 0 ? (
              <div className="text-content-muted py-6 text-center">
                لم يتم إضافة أي أزرار بعد. اضغط على «إضافة زر جديد» أو «إعادة تعيين
                للأزرار القياسية».
              </div>
            ) : (
              <div className="flex flex-col gap-3">
                {draft.actions.map((act, aIdx) => (
                  <div
                    key={act.id || aIdx}
                    className="bg-surface border-border flex flex-col gap-3 rounded-xl border p-3.5 shadow-xs"
                  >
                    {/* رأس كرت الزر */}
                    <div className="border-border/60 flex items-center justify-between border-b pb-2">
                      <div className="flex items-center gap-2">
                        <span className="bg-primary/10 text-primary flex size-6 items-center justify-center rounded-full text-xs font-bold">
                          {aIdx + 1}
                        </span>
                        <span className="text-content text-xs font-bold">
                          {act.label || `إجراء ${aIdx + 1}`}
                        </span>
                        <Badge tone={ACTION_KIND_TONES[act.kind] || "neutral"}>
                          {ACTION_KIND_OPTIONS.find((k) => k.value === act.kind)
                            ?.label || act.kind}
                        </Badge>
                      </div>

                      <button
                        type="button"
                        onClick={() =>
                          updateDraft({
                            actions: draft.actions.filter((_, i) => i !== aIdx),
                          })
                        }
                        className="text-danger hover:bg-danger/10 rounded-md p-1.5 transition-colors"
                        title="حذف هذا الزر"
                      >
                        <Trash2 className="size-4" />
                      </button>
                    </div>

                    {/* بيانات الزر الأساسية */}
                    <div className="grid grid-cols-1 gap-2.5 md:grid-cols-3">
                      <div className="flex flex-col gap-1">
                        <label className="text-content-muted text-[11px] font-medium">
                          نص الزر الظاهر:
                        </label>
                        <Input
                          value={act.label}
                          onChange={(e) => {
                            const next = [...draft.actions];
                            const cur = next[aIdx];
                            if (cur) next[aIdx] = { ...cur, label: e.target.value };
                            updateDraft({ actions: next });
                          }}
                          placeholder="مثال: اعتماد وإرسال"
                          className="font-bold"
                        />
                      </div>

                      <div className="flex flex-col gap-1">
                        <label className="text-content-muted text-[11px] font-medium">
                          مفتاح الإجراء (Key بالإنجليزية):
                        </label>
                        <Input
                          value={act.actionKey}
                          onChange={(e) => {
                            const next = [...draft.actions];
                            const cur = next[aIdx];
                            if (cur) next[aIdx] = { ...cur, actionKey: e.target.value };
                            updateDraft({ actions: next });
                          }}
                          placeholder="مثال: approve أو request_info"
                          className="font-mono text-xs"
                        />
                      </div>

                      <div className="flex flex-col gap-1">
                        <label className="text-content-muted text-[11px] font-medium">
                          نوع وسلوك الإجراء:
                        </label>
                        <Select
                          value={act.kind}
                          onChange={(e) => {
                            const next = [...draft.actions];
                            const cur = next[aIdx];
                            if (cur)
                              next[aIdx] = {
                                ...cur,
                                kind: e.target.value as ActionKind,
                              };
                            updateDraft({ actions: next });
                          }}
                          options={ACTION_KIND_OPTIONS}
                        />
                      </div>
                    </div>

                    {/* متطلبات الإجراء الإلزامية */}
                    <div className="bg-surface-sunken/60 flex flex-wrap items-center gap-4 rounded-lg p-2.5">
                      <span className="text-content-muted text-[11px] font-bold">
                        المتطلبات الإلزامية:
                      </span>

                      <label className="flex cursor-pointer items-center gap-1.5 text-[11px]">
                        <input
                          type="checkbox"
                          checked={act.requiresNote}
                          onChange={(e) => {
                            const next = [...draft.actions];
                            const cur = next[aIdx];
                            if (cur)
                              next[aIdx] = { ...cur, requiresNote: e.target.checked };
                            updateDraft({ actions: next });
                          }}
                          className="text-primary rounded border-gray-300"
                        />
                        <span>ملاحظة إلزامية</span>
                      </label>

                      <label className="flex cursor-pointer items-center gap-1.5 text-[11px]">
                        <input
                          type="checkbox"
                          checked={act.requiresAttachment}
                          onChange={(e) => {
                            const next = [...draft.actions];
                            const cur = next[aIdx];
                            if (cur)
                              next[aIdx] = {
                                ...cur,
                                requiresAttachment: e.target.checked,
                              };
                            updateDraft({ actions: next });
                          }}
                          className="text-primary rounded border-gray-300"
                        />
                        <span>مرفق إلزامي</span>
                      </label>

                      <label className="flex cursor-pointer items-center gap-1.5 text-[11px]">
                        <input
                          type="checkbox"
                          checked={act.requiresEvaluation}
                          onChange={(e) => {
                            const next = [...draft.actions];
                            const cur = next[aIdx];
                            if (cur)
                              next[aIdx] = {
                                ...cur,
                                requiresEvaluation: e.target.checked,
                              };
                            updateDraft({ actions: next });
                          }}
                          className="text-primary rounded border-gray-300"
                        />
                        <span>تقييم رقمي إلزامي</span>
                      </label>
                    </div>

                    {/* مهلة الإرجاع (فقط إن كان نوع الإجراء backward) */}
                    {actionSupportsReturnMinutes(act.kind) && (
                      <div className="flex flex-col gap-2 rounded-lg border border-amber-300 bg-amber-50 p-2.5 dark:border-amber-700/60 dark:bg-amber-950/30">
                        <div className="flex items-center justify-between text-xs">
                          <span className="flex items-center gap-1 font-bold text-amber-900 dark:text-amber-200">
                            <Clock className="size-3.5" />
                            <span>مهلة الإرجاع المخصصة لهذا الإجراء:</span>
                          </span>
                          {(act.returnHours > 0 || act.returnMinutes > 0) && (
                            <span className="font-mono font-bold text-amber-700 dark:text-amber-300">
                              {act.returnHours > 0 ? `${act.returnHours} س ` : ""}
                              {act.returnMinutes > 0 ? `${act.returnMinutes} د` : ""}
                            </span>
                          )}
                        </div>

                        <div className="grid grid-cols-2 gap-2">
                          <div className="bg-surface border-border flex items-center gap-1 rounded border px-2 py-1">
                            <Input
                              type="number"
                              min="0"
                              value={act.returnHours === 0 ? "" : act.returnHours}
                              onChange={(e) => {
                                const next = [...draft.actions];
                                const cur = next[aIdx];
                                if (cur)
                                  next[aIdx] = {
                                    ...cur,
                                    returnHours: Math.max(0, Number(e.target.value)),
                                  };
                                updateDraft({ actions: next });
                              }}
                              placeholder="0"
                              className="text-center text-xs font-bold"
                            />
                            <span className="text-content-muted shrink-0 text-[11px]">
                              ساعة
                            </span>
                          </div>

                          <div className="bg-surface border-border flex items-center gap-1 rounded border px-2 py-1">
                            <Input
                              type="number"
                              min="0"
                              max="59"
                              value={act.returnMinutes === 0 ? "" : act.returnMinutes}
                              onChange={(e) => {
                                const next = [...draft.actions];
                                const cur = next[aIdx];
                                if (cur)
                                  next[aIdx] = {
                                    ...cur,
                                    returnMinutes: Math.max(
                                      0,
                                      Math.min(59, Number(e.target.value)),
                                    ),
                                  };
                                updateDraft({ actions: next });
                              }}
                              placeholder="0"
                              className="text-center text-xs font-bold"
                            />
                            <span className="text-content-muted shrink-0 text-[11px]">
                              دقيقة
                            </span>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* مسارات التوجيه الشرطي لهذا الإجراء (إذا كان ليس note أو final) */}
                    {act.kind !== "note" && act.kind !== "final" && (
                      <div className="bg-surface-sunken border-border/80 flex flex-col gap-2.5 rounded-lg border p-3">
                        <div className="flex items-center justify-between">
                          <span className="text-content flex items-center gap-1.5 text-xs font-bold">
                            <CornerDownLeft className="text-primary size-3.5" />
                            <span>مسارات التوجيه الشرطي لهذا الإجراء:</span>
                            <span className="text-content-muted text-[11px]">
                              ({act.routes.length})
                            </span>
                          </span>

                          <button
                            type="button"
                            onClick={() => {
                              const otherStages = stages.filter(
                                (_, i) => i !== stageIndex,
                              );
                              const targetKey = otherStages[0]?.stageKey || "";
                              const newRoute: StageRouteItem = {
                                id: `rt_${Date.now()}_${act.routes.length + 1}`,
                                targetStageKey: targetKey,
                                priority: (act.routes.length + 1) * 10,
                                hasCondition: false,
                                field: "amount",
                                op: "gt",
                                value: "",
                              };
                              const next = [...draft.actions];
                              const cur = next[aIdx];
                              if (cur)
                                next[aIdx] = {
                                  ...cur,
                                  routes: [...cur.routes, newRoute],
                                };
                              updateDraft({ actions: next });
                            }}
                            className="bg-primary/10 hover:bg-primary/20 text-primary flex items-center gap-1 rounded px-2 py-0.5 text-[11px] font-bold transition-colors"
                          >
                            <Plus className="size-3" />
                            <span>إضافة مسار توجيه</span>
                          </button>
                        </div>

                        {act.routes.length === 0 ? (
                          <span className="text-[11px] font-medium text-amber-600 dark:text-amber-400">
                            * هذا الإجراء لا يملك وجهة محددة حتى الآن. أضف مساراً لنقل
                            المعاملة.
                          </span>
                        ) : (
                          <div className="flex flex-col gap-2">
                            {act.routes.map((rt, rIdx) => (
                              <div
                                key={rt.id || rIdx}
                                className="bg-surface border-border flex flex-col gap-2 rounded-lg border p-2.5"
                              >
                                <div className="flex flex-wrap items-center justify-between gap-2">
                                  <div className="flex min-w-[200px] flex-1 items-center gap-2">
                                    <span className="text-content-muted shrink-0 text-[11px]">
                                      ينقل إلى:
                                    </span>
                                    <Select
                                      value={rt.targetStageKey}
                                      onChange={(e) => {
                                        const next = [...draft.actions];
                                        const cur = next[aIdx];
                                        if (cur) {
                                          const nextRts = [...cur.routes];
                                          const rCur = nextRts[rIdx];
                                          if (rCur)
                                            nextRts[rIdx] = {
                                              ...rCur,
                                              targetStageKey: e.target.value,
                                            };
                                          next[aIdx] = { ...cur, routes: nextRts };
                                        }
                                        updateDraft({ actions: next });
                                      }}
                                      options={stages
                                        .filter((_, i) => i !== stageIndex)
                                        .map((s) => ({
                                          value: s.stageKey,
                                          label: `${s.name} (${s.stageKey})`,
                                        }))}
                                      className="text-xs font-semibold"
                                    />
                                  </div>

                                  <div className="flex items-center gap-2">
                                    <div className="flex items-center gap-1">
                                      <span className="text-content-muted text-[10px]">
                                        الأولوية:
                                      </span>
                                      <Input
                                        type="number"
                                        min="1"
                                        value={rt.priority}
                                        onChange={(e) => {
                                          const next = [...draft.actions];
                                          const cur = next[aIdx];
                                          if (cur) {
                                            const nextRts = [...cur.routes];
                                            const rCur = nextRts[rIdx];
                                            if (rCur)
                                              nextRts[rIdx] = {
                                                ...rCur,
                                                priority: Number(e.target.value),
                                              };
                                            next[aIdx] = { ...cur, routes: nextRts };
                                          }
                                          updateDraft({ actions: next });
                                        }}
                                        className="w-16 text-center text-xs font-bold"
                                      />
                                    </div>

                                    <button
                                      type="button"
                                      onClick={() => {
                                        const next = [...draft.actions];
                                        const cur = next[aIdx];
                                        if (cur) {
                                          next[aIdx] = {
                                            ...cur,
                                            routes: cur.routes.filter(
                                              (_, i) => i !== rIdx,
                                            ),
                                          };
                                        }
                                        updateDraft({ actions: next });
                                      }}
                                      className="text-danger hover:bg-danger/10 rounded p-1 transition-colors"
                                      title="حذف هذا المسار"
                                    >
                                      <Trash2 className="size-3.5" />
                                    </button>
                                  </div>
                                </div>

                                {/* خيار الشرط المنطقي للمسار */}
                                <div className="border-border/40 flex flex-col gap-1.5 border-t pt-1">
                                  <label className="text-content flex cursor-pointer items-center gap-1.5 text-[11px] font-medium">
                                    <input
                                      type="checkbox"
                                      checked={rt.hasCondition}
                                      onChange={(e) => {
                                        const next = [...draft.actions];
                                        const cur = next[aIdx];
                                        if (cur) {
                                          const nextRts = [...cur.routes];
                                          const rCur = nextRts[rIdx];
                                          if (rCur)
                                            nextRts[rIdx] = {
                                              ...rCur,
                                              hasCondition: e.target.checked,
                                            };
                                          next[aIdx] = { ...cur, routes: nextRts };
                                        }
                                        updateDraft({ actions: next });
                                      }}
                                      className="rounded border-gray-300 text-amber-600"
                                    />
                                    <span>
                                      تفعيل شرط منطقي لاختيار هذا المسار (Conditional
                                      Routing)
                                    </span>
                                  </label>

                                  {rt.hasCondition && (
                                    <div className="bg-surface-sunken grid grid-cols-1 gap-2 rounded-md p-2 md:grid-cols-3">
                                      <div className="flex flex-col gap-0.5">
                                        <label className="text-content-muted text-[10px]">
                                          الحقل:
                                        </label>
                                        <Input
                                          value={rt.field}
                                          onChange={(e) => {
                                            const next = [...draft.actions];
                                            const cur = next[aIdx];
                                            if (cur) {
                                              const nextRts = [...cur.routes];
                                              const rCur = nextRts[rIdx];
                                              if (rCur)
                                                nextRts[rIdx] = {
                                                  ...rCur,
                                                  field: e.target.value,
                                                };
                                              next[aIdx] = { ...cur, routes: nextRts };
                                            }
                                            updateDraft({ actions: next });
                                          }}
                                          placeholder="مثال: amount"
                                          className="font-mono text-xs"
                                        />
                                      </div>

                                      <div className="flex flex-col gap-0.5">
                                        <label className="text-content-muted text-[10px]">
                                          المعامل:
                                        </label>
                                        <Select
                                          value={rt.op}
                                          onChange={(e) => {
                                            const next = [...draft.actions];
                                            const cur = next[aIdx];
                                            if (cur) {
                                              const nextRts = [...cur.routes];
                                              const rCur = nextRts[rIdx];
                                              if (rCur)
                                                nextRts[rIdx] = {
                                                  ...rCur,
                                                  op: e.target.value as ConditionOp,
                                                };
                                              next[aIdx] = { ...cur, routes: nextRts };
                                            }
                                            updateDraft({ actions: next });
                                          }}
                                          options={OP_OPTIONS}
                                        />
                                      </div>

                                      <div className="flex flex-col gap-0.5">
                                        <label className="text-content-muted text-[10px]">
                                          القيمة:
                                        </label>
                                        <Input
                                          value={rt.value}
                                          onChange={(e) => {
                                            const next = [...draft.actions];
                                            const cur = next[aIdx];
                                            if (cur) {
                                              const nextRts = [...cur.routes];
                                              const rCur = nextRts[rIdx];
                                              if (rCur)
                                                nextRts[rIdx] = {
                                                  ...rCur,
                                                  value: e.target.value,
                                                };
                                              next[aIdx] = { ...cur, routes: nextRts };
                                            }
                                            updateDraft({ actions: next });
                                          }}
                                          placeholder="مثال: 50000"
                                          className="text-xs"
                                        />
                                      </div>
                                    </div>
                                  )}
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </Modal>
  );
}
