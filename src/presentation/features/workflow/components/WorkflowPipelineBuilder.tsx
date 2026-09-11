/**
 * منشئ خط سير العمل السريع والمتقدم (Pipeline Builder).
 *
 * يتيح إنشاء مسار كامل للمراسلات أو العمليات بطريقة بصرية سهلة وسريعة:
 * - إضافة المراحل وترتيبها بالسحب والإفلات (Drag & Drop) أو بأزرار التحريك.
 * - قوالب جاهزة سريعة (بما في ذلك خيار "قالب فارغ" للبدء من الصفر بحقول نظيفة).
 * - تحكم دقيق بالساعات والدقائق للمهلة المحددة (SLA) ومهلة الإرجاع (Return Duration).
 * - خيارات متقدمة شاملة لكل مرحلة: سياسات الإنجاز (الجميع/أولهم/نصاب)، الالتقاء (wait_all)،
 *   الحجز الحصري (exclusive)، اشتراط الاستلام، شروط المرفقات، ومدة الإرجاع المخصصة.
 * - دعم إضافة أكثر من مشارك في نفس المرحلة (إلزامي، اختياري، مراقب، موقّع).
 * - الربط التلقائي للأزرار ومسارات التوجيه (اعتماد، إرجاع، ملاحظة، إغلاق وأرشفة).
 */
import { useState, type DragEvent } from "react";
import {
  ArrowLeft,
  CheckCircle2,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  Clock,
  FileCheck,
  FolderPlus,
  GitFork,
  GripVertical,
  Layers,
  Paperclip,
  Plus,
  Sliders,
  Sparkles,
  Trash2,
  Undo2,
  UserPlus,
  Users,
} from "lucide-react";
import type { CompletionPolicy } from "@core/modules/workflow/entities/StageInstance";
import type { ClaimPolicy } from "@core/modules/workflow/entities/WorkflowGovernance";
import type {
  JoinPolicy,
  ParticipantKind,
  WorkflowDefinitionDto,
} from "@application/modules/workflow/dtos";
import { Badge } from "@presentation/shared/ui/Badge";
import { Button } from "@presentation/shared/ui/Button";
import { FormField } from "@presentation/shared/ui/FormField";
import { Input } from "@presentation/shared/ui/Input";
import { Modal } from "@presentation/shared/ui/Modal";
import { Select } from "@presentation/shared/ui/Select";
import { errorMessage } from "@presentation/shared/lib/query";
import {
  useProfiles,
  useRoles,
} from "@presentation/features/identity/hooks/useIdentity";
import {
  useSavePipelineWorkflow,
  useWorkflowDefinitions,
} from "../hooks/useWorkflow";
import { t } from "@i18n/index";

export interface StageParticipantItem {
  id: string;
  kind: ParticipantKind;
  roleId: string;
  userId: string;
  requiresSign: boolean;
  isOptional: boolean;
  isObserver: boolean;
}

export interface PipelineStageItem {
  id: string;
  name: string;
  stageKey: string;
  // المهلة المحددة بالساعات والدقائق
  slaHours: number;
  slaMinutes: number;
  // السياسات
  completionPolicy: CompletionPolicy;
  quorumCount: number;
  joinPolicy: JoinPolicy;
  claimPolicy: ClaimPolicy;
  requiresReceive: boolean;
  isProgramManager: boolean;
  isArchive: boolean;
  // مهلة الإرجاع عند الرفض بالساعات والدقائق
  returnHours: number;
  returnMinutes: number;
  // شروط المرفقات
  requiresAttachment: boolean;
  minAttachments: number;
  attachmentMessage: string;
  // المشاركون
  participants: StageParticipantItem[];
  showAdvanced: boolean;
  // التوجيه والتشعيب
  targetMode: "auto" | "custom";
  customTargets: string[];
}

interface PresetTemplate {
  name: string;
  description: string;
  transactionType: string;
  badgeTone?: "neutral" | "info" | "success" | "warning";
  stages: {
    name: string;
    stageKey: string;
    slaHours: number;
    slaMinutes?: number;
    completionPolicy?: CompletionPolicy;
    joinPolicy?: JoinPolicy;
    claimPolicy?: ClaimPolicy;
    requiresReceive?: boolean;
    returnHours?: number;
    returnMinutes?: number;
    requiresAttachment?: boolean;
    participants: {
      kind: ParticipantKind;
      roleId?: string;
      userId?: string;
      requiresSign?: boolean;
      isOptional?: boolean;
      isObserver?: boolean;
    }[];
  }[];
}

const PRESETS: readonly PresetTemplate[] = [
  {
    name: "قالب فارغ (البدء من الصفر)",
    description: "لوحة فارغة تماماً تتيح لك بناء مسار مخصص بالكامل وتسمية المعاملة والمراحل بنفسك",
    transactionType: "",
    badgeTone: "neutral",
    stages: [
      {
        name: "مرحلة البداية",
        stageKey: "initial_stage",
        slaHours: 24,
        slaMinutes: 0,
        participants: [
          {
            kind: "requester",
          },
        ],
      },
    ],
  },
  {
    name: "مستخلص مقاول باطن — نموذج شامل",
    description: "نموذج متقدم يجسد التفريع الموازي، الالتقاء (wait_all)، الحجز، والاعتماد الفني والمالي",
    transactionType: "subcontractor_claim",
    badgeTone: "success",
    stages: [
      {
        name: "إعداد المستخلص",
        stageKey: "preparation",
        slaHours: 48,
        slaMinutes: 0,
        participants: [{ kind: "requester" }],
      },
      {
        name: "المراجعة الفنية",
        stageKey: "tech_review",
        slaHours: 24,
        slaMinutes: 0,
        completionPolicy: "all",
        returnHours: 2,
        returnMinutes: 0,
        participants: [
          { kind: "project_role", requiresSign: false },
          { kind: "project_role", isOptional: true },
        ],
      },
      {
        name: "الحسابات والتدقيق المالي",
        stageKey: "finance",
        slaHours: 24,
        slaMinutes: 0,
        participants: [{ kind: "role" }],
      },
      {
        name: "اعتماد الإدارة التنفيذية",
        stageKey: "pm_approval",
        slaHours: 24,
        slaMinutes: 0,
        completionPolicy: "any",
        claimPolicy: "exclusive",
        requiresAttachment: true,
        participants: [{ kind: "project_role", requiresSign: true }],
      },
      {
        name: "التدقيق النهائي والمطابقة",
        stageKey: "final_audit",
        slaHours: 12,
        slaMinutes: 0,
        joinPolicy: "wait_all",
        requiresReceive: true,
        participants: [{ kind: "role" }],
      },
      {
        name: "الإغلاق والأرشفة",
        stageKey: "archive",
        slaHours: 24,
        slaMinutes: 0,
        participants: [{ kind: "role" }],
      },
    ],
  },
  {
    name: "مسار مراسلات ومخاطبات قياسي",
    description: "إعداد المراسلة والمرفقات ثم مراجعة مدير المشروع ثم الأرشفة والإصدار الصادر",
    transactionType: "correspondence_review",
    badgeTone: "info",
    stages: [
      {
        name: "إعداد المراسلة والمرفقات",
        stageKey: "drafting",
        slaHours: 24,
        slaMinutes: 0,
        participants: [{ kind: "requester" }],
      },
      {
        name: "مراجعة واعتماد مدير المشروع",
        stageKey: "pm_approval",
        slaHours: 48,
        slaMinutes: 0,
        participants: [{ kind: "project_role", requiresSign: true }],
      },
      {
        name: "أرشفة وتصدير الصادر",
        stageKey: "archive_dispatch",
        slaHours: 24,
        slaMinutes: 0,
        participants: [{ kind: "role" }],
      },
    ],
  },
  {
    name: "مسار فحص واستلام الأعمال بالموقع",
    description: "طلب فحص أعمال من المقاول، معاينة الاستشاري، واعتماد الاستلام النهائي",
    transactionType: "site_inspection",
    badgeTone: "warning",
    stages: [
      {
        name: "طلب فحص الأعمال المنفذة",
        stageKey: "inspection_request",
        slaHours: 12,
        slaMinutes: 0,
        participants: [{ kind: "requester" }],
      },
      {
        name: "معاينة استشاري الموقع وتدوين الملاحظات",
        stageKey: "consultant_inspection",
        slaHours: 24,
        slaMinutes: 0,
        participants: [{ kind: "project_role" }],
      },
      {
        name: "اعتماد الاستلام النهائي والإغلاق",
        stageKey: "final_approval",
        slaHours: 24,
        slaMinutes: 0,
        participants: [{ kind: "project_role", requiresSign: true }],
      },
    ],
  },
];

function createEmptyStage(index: number, defaultRoleId = ""): PipelineStageItem {
  return {
    id: `stage_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
    name: index === 0 ? "مرحلة البداية" : `المرحلة ${index + 1}`,
    stageKey: `stage_${index + 1}`,
    slaHours: 24,
    slaMinutes: 0,
    completionPolicy: "all",
    quorumCount: 2,
    joinPolicy: "none",
    claimPolicy: "none",
    requiresReceive: false,
    isProgramManager: false,
    isArchive: false, // لا تفعَّل أبداً كأرشفة للمرحلة الأولى
    returnHours: 0,
    returnMinutes: 0,
    requiresAttachment: false,
    minAttachments: 1,
    attachmentMessage: "يرجى إرفاق المستند المطلوب قبل الاعتماد",
    participants: [
      {
        id: `p_${Date.now()}_1`,
        kind: index === 0 ? "requester" : "project_role",
        roleId: index === 0 ? "" : defaultRoleId,
        userId: "",
        requiresSign: false,
        isOptional: false,
        isObserver: false,
      },
    ],
    showAdvanced: false,
    targetMode: "auto",
    customTargets: [],
  };
}

export function WorkflowPipelineBuilder({
  isOpen,
  onClose,
  onSuccess,
}: {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (definition: WorkflowDefinitionDto) => void;
}) {
  const savePipeline = useSavePipelineWorkflow();
  const definitions = useWorkflowDefinitions();
  const roles = useRoles();
  const profiles = useProfiles();

  const [name, setName] = useState("مسار مراسلات ومخاطبات جديد");
  const [transactionType, setTransactionType] = useState("correspondence_new");
  const [autoWireActions, setAutoWireActions] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [stages, setStages] = useState<PipelineStageItem[]>([
    {
      id: "s_1",
      name: "إعداد المراسلة والمرفقات",
      stageKey: "drafting",
      slaHours: 24,
      slaMinutes: 0,
      completionPolicy: "all",
      quorumCount: 2,
      joinPolicy: "none",
      claimPolicy: "none",
      requiresReceive: false,
      isProgramManager: false,
      isArchive: false,
      returnHours: 0,
      returnMinutes: 0,
      requiresAttachment: false,
      minAttachments: 1,
      attachmentMessage: "",
      participants: [
        {
          id: "p_1_1",
          kind: "requester",
          roleId: "",
          userId: "",
          requiresSign: false,
          isOptional: false,
          isObserver: false,
        },
      ],
      showAdvanced: false,
      targetMode: "auto",
      customTargets: [],
    },
    {
      id: "s_2",
      name: "مراجعة واعتماد مدير المشروع",
      stageKey: "pm_approval",
      slaHours: 48,
      slaMinutes: 0,
      completionPolicy: "all",
      quorumCount: 2,
      joinPolicy: "none",
      claimPolicy: "none",
      requiresReceive: false,
      isProgramManager: false,
      isArchive: false,
      returnHours: 2,
      returnMinutes: 0,
      requiresAttachment: false,
      minAttachments: 1,
      attachmentMessage: "",
      participants: [
        {
          id: "p_2_1",
          kind: "project_role",
          roleId: "",
          userId: "",
          requiresSign: true,
          isOptional: false,
          isObserver: false,
        },
      ],
      showAdvanced: false,
      targetMode: "auto",
      customTargets: [],
    },
    {
      id: "s_3",
      name: "أرشفة وتصدير الصادر",
      stageKey: "archive_dispatch",
      slaHours: 24,
      slaMinutes: 0,
      completionPolicy: "all",
      quorumCount: 2,
      joinPolicy: "none",
      claimPolicy: "none",
      requiresReceive: false,
      isProgramManager: false,
      isArchive: true, // فقط المرحلة الأخيرة هي المؤرشفة
      returnHours: 0,
      returnMinutes: 0,
      requiresAttachment: false,
      minAttachments: 1,
      attachmentMessage: "",
      participants: [
        {
          id: "p_3_1",
          kind: "role",
          roleId: "",
          userId: "",
          requiresSign: false,
          isOptional: false,
          isObserver: false,
        },
      ],
      showAdvanced: false,
      targetMode: "auto",
      customTargets: [],
    },
  ]);

  const defaultPmId =
    roles.data?.find((r) => r.key === "project_manager")?.id ||
    roles.data?.[0]?.id ||
    "";
  const defaultAdminId =
    roles.data?.find((r) => r.key === "admin" || r.key === "program_manager")?.id ||
    roles.data?.[0]?.id ||
    defaultPmId;

  function resolveParticipantRoleId(p: StageParticipantItem): string {
    if (p.roleId) return p.roleId;
    if (p.kind === "project_role") return defaultPmId;
    if (p.kind === "role") return defaultAdminId;
    return "";
  }

  // سحب وإفلات
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);
  const [dragEnabledIndex, setDragEnabledIndex] = useState<number | null>(null);

  function applyPreset(preset: PresetTemplate) {
    const pmId =
      roles.data?.find((r) => r.key === "project_manager")?.id || "";
    const engId =
      roles.data?.find((r) => r.key === "engineer")?.id || pmId;
    const adminId =
      roles.data?.find((r) => r.key === "admin" || r.key === "program_manager")?.id || pmId;

    function resolveRole(kind: string, stageKey: string): string {
      if (kind === "project_role") {
        if (stageKey.includes("tech") || stageKey.includes("inspect")) return engId;
        return pmId;
      }
      if (kind === "role") {
        return adminId;
      }
      return "";
    }

    if (preset.name === "قالب فارغ (البدء من الصفر)") {
      setName("");
      setTransactionType("");
      setStages([createEmptyStage(0, pmId)]);
      return;
    }
    setName(preset.name);
    setTransactionType(preset.transactionType);
    setStages(
      preset.stages.map((s, idx) => ({
        id: `preset_s_${idx}_${Date.now()}`,
        name: s.name,
        stageKey: s.stageKey,
        slaHours: s.slaHours,
        slaMinutes: s.slaMinutes ?? 0,
        completionPolicy: s.completionPolicy ?? "all",
        quorumCount: 2,
        joinPolicy: s.joinPolicy ?? "none",
        claimPolicy: s.claimPolicy ?? "none",
        requiresReceive: s.requiresReceive ?? false,
        isProgramManager: false,
        // فقط المرحلة الأخيرة إن كانت أكثر من مرحلة
        isArchive: preset.stages.length > 1 && idx === preset.stages.length - 1,
        returnHours: s.returnHours ?? 0,
        returnMinutes: s.returnMinutes ?? 0,
        requiresAttachment: s.requiresAttachment ?? false,
        minAttachments: 1,
        attachmentMessage: "يرجى إرفاق المستند قبل الاعتماد",
        participants: s.participants.map((p, pIdx) => ({
          id: `preset_p_${idx}_${pIdx}`,
          kind: p.kind,
          roleId: p.roleId || resolveRole(p.kind, s.stageKey),
          userId: p.userId ?? "",
          requiresSign: p.requiresSign ?? false,
          isOptional: p.isOptional ?? false,
          isObserver: p.isObserver ?? false,
        })),
        showAdvanced: false,
        targetMode: "auto",
        customTargets: [],
      })),
    );
  }

  function handleAddStage(atIndex?: number) {
    const insertAt = atIndex !== undefined ? atIndex : stages.length;
    const pmId =
      roles.data?.find((r) => r.key === "project_manager")?.id || "";
    const newStage = createEmptyStage(insertAt, pmId);
    const updated = [...stages];
    updated.splice(insertAt, 0, newStage);
    setStages(updated);
  }

  function handleRemoveStage(index: number) {
    if (stages.length <= 1) return;
    setStages(stages.filter((_, i) => i !== index));
  }

  function handleMoveStage(fromIndex: number, toIndex: number) {
    if (toIndex < 0 || toIndex >= stages.length) return;
    const updated = [...stages];
    const moved = updated.splice(fromIndex, 1)[0];
    if (!moved) return;
    updated.splice(toIndex, 0, moved);
    setStages(updated);
  }

  function handleDragStart(e: DragEvent<HTMLDivElement>, index: number) {
    setDraggedIndex(index);
    e.dataTransfer.effectAllowed = "move";
    e.dataTransfer.setData("text/plain", String(index));
  }

  function handleDragOver(e: DragEvent<HTMLDivElement>, index: number) {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    if (dragOverIndex !== index) {
      setDragOverIndex(index);
    }
  }

  function handleDragEnd() {
    setDraggedIndex(null);
    setDragOverIndex(null);
    setDragEnabledIndex(null);
  }

  function handleDrop(e: DragEvent<HTMLDivElement>, targetIndex: number) {
    e.preventDefault();
    if (draggedIndex === null || draggedIndex === targetIndex) {
      handleDragEnd();
      return;
    }
    handleMoveStage(draggedIndex, targetIndex);
    handleDragEnd();
  }

  function updateStage(index: number, patch: Partial<PipelineStageItem>) {
    setStages((prev) =>
      prev.map((item, i) => (i === index ? { ...item, ...patch } : item)),
    );
  }

  function addParticipantToStage(stageIndex: number) {
    const stage = stages[stageIndex];
    if (!stage) return;
    const newParticipant: StageParticipantItem = {
      id: `p_${Date.now()}_${stage.participants.length + 1}`,
      kind: "project_role",
      roleId: "",
      userId: "",
      requiresSign: false,
      isOptional: false,
      isObserver: false,
    };
    updateStage(stageIndex, {
      participants: [...stage.participants, newParticipant],
    });
  }

  function updateParticipant(
    stageIndex: number,
    participantIndex: number,
    patch: Partial<StageParticipantItem>,
  ) {
    const stage = stages[stageIndex];
    if (!stage) return;
    const updatedParticipants = stage.participants.map((p, i) =>
      i === participantIndex ? { ...p, ...patch } : p,
    );
    updateStage(stageIndex, { participants: updatedParticipants });
  }

  function removeParticipant(stageIndex: number, participantIndex: number) {
    const stage = stages[stageIndex];
    if (!stage || stage.participants.length <= 1) return;
    const updatedParticipants = stage.participants.filter(
      (_, i) => i !== participantIndex,
    );
    updateStage(stageIndex, { participants: updatedParticipants });
  }

  async function handleSave() {
    setError(null);
    if (!name.trim()) {
      setError("اسم المسار مطلوب");
      return;
    }
    const cleanType = transactionType.trim();
    if (!cleanType) {
      setError("رمز نوع المعاملة مطلوب");
      return;
    }
    if (!/^[a-z][a-z0-9_]{1,31}$/.test(cleanType)) {
      setError("رمز نوع المعاملة يقبل الحروف الإنجليزية الصغيرة والأرقام والشرطة السفلية _ فقط وبدون مسافات");
      return;
    }

    // التحقق من أن رمز نوع المعاملة غير مستخدم مسبقاً في مسار آخر
    const existingDef = definitions.data?.find(
      (d) => d.transactionType.toLowerCase() === cleanType.toLowerCase(),
    );
    if (existingDef) {
      setError(
        `رمز نوع المعاملة «${cleanType}» مستخدم بالفعل في مسار «${existingDef.name}». يرجى كتابة رمز مختلف للمعاملة.`,
      );
      return;
    }

    if (stages.length === 0) {
      setError("يجب إضافة مرحلة واحدة على الأقل في المسار");
      return;
    }

    // التحقق من صحة المراحل وعدم تكرار رموزها
    const seenStageKeys = new Map<string, number>();
    for (let i = 0; i < stages.length; i++) {
      const stageItem = stages[i];
      if (!stageItem || !stageItem.name.trim()) {
        setError(`اسم المرحلة رقم ${i + 1} مطلوب`);
        return;
      }
      const key = stageItem.stageKey.trim();
      if (!key) {
        setError(`رمز المرحلة رقم ${i + 1} («${stageItem.name}») مطلوب`);
        return;
      }
      if (!/^[a-z][a-z0-9_]{1,39}$/.test(key)) {
        setError(
          `رمز المرحلة «${stageItem.name}» غير صالح («${key}»). يجب أن يبدأ بحرف إنجليزي صغير ويحتوي فقط على حروف إنجليزية وأرقام وشرطة سفلية _ وبطول 2 إلى 40 حرفاً.`,
        );
        return;
      }
      if (seenStageKeys.has(key)) {
        const prevIdx = seenStageKeys.get(key)! + 1;
        setError(
          `رمز المرحلة «${key}» مكرر في المرحلة رقم ${prevIdx} والمرحلة رقم ${i + 1}. يجب أن يكون لكل مرحلة رمز إنجليزي فريد.`,
        );
        return;
      }
      seenStageKeys.set(key, i);
    }

    // التحقق من المشاركين في كل مرحلة وعدم ترك الدور فارغاً
    for (const stageItem of stages) {
      if (!stageItem.participants || stageItem.participants.length === 0) {
        setError(`المرحلة «${stageItem.name}» يجب أن تحتوي على مشارك واحد على الأقل`);
        return;
      }
      for (const [pIdx, p] of stageItem.participants.entries()) {
        if (p.kind === "role" || p.kind === "project_role") {
          const effectiveRoleId = resolveParticipantRoleId(p);
          if (!effectiveRoleId || effectiveRoleId.trim() === "") {
            setError(
              `يرجى اختيار الدور المطلوب للمشارك رقم ${pIdx + 1} في المرحلة «${stageItem.name}»`,
            );
            return;
          }
        }
        if (p.kind === "user") {
          if (!p.userId || p.userId.trim() === "") {
            setError(
              `يرجى اختيار الموظف المحدد للمشارك رقم ${pIdx + 1} في المرحلة «${stageItem.name}»`,
            );
            return;
          }
        }
      }
    }

    // التحقق من صحة الوجهات المخصصة إن تم تفعيلها
    for (const s of stages) {
      if (s.targetMode === "custom" && (!s.customTargets || s.customTargets.length === 0)) {
        setError(
          `المرحلة «${s.name}» في وضع التوجيه المخصص لكن لم يتم اختيار أي وجهة تالية لها. يرجى اختيار وجهة أو إرجاعها للوضع التلقائي.`,
        );
        return;
      }
    }

    try {
      const result = await savePipeline.mutateAsync({
        name: name.trim(),
        transactionType: cleanType,
        isActive: true,
        autoWireActions,
        stages: stages.map((s, idx) => {
          // حساب إجمالي الدقائق للـ SLA
          const totalSla = (s.slaHours * 60) + s.slaMinutes;
          // حساب إجمالي الدقائق للإرجاع
          const totalReturn = (s.returnHours * 60) + s.returnMinutes;

          const isCustomRouting =
            s.targetMode === "custom" && s.customTargets && s.customTargets.length > 0;

          return {
            name: s.name.trim(),
            stageKey: s.stageKey.trim(),
            targetStageKeys: isCustomRouting ? s.customTargets : undefined,
            slaMinutes: totalSla > 0 ? totalSla : null,
            // المرحلة الأولى لا تكون مرحلة أرشفة مطلقاً
            isArchive: idx > 0 && (idx === stages.length - 1 || s.isArchive),
            completionPolicy: s.completionPolicy,
            quorumCount: s.completionPolicy === "quorum" ? s.quorumCount : null,
            joinPolicy: s.joinPolicy,
            claimPolicy: s.claimPolicy,
            requiresReceive: s.requiresReceive,
            isProgramManager: s.isProgramManager,
            returnMinutes: totalReturn > 0 ? totalReturn : null,
            participants: s.participants.map((p) => {
              const effectiveRoleId = resolveParticipantRoleId(p);
              return {
                kind: p.kind,
                roleId:
                  p.kind === "role" || p.kind === "project_role"
                    ? effectiveRoleId || null
                    : null,
                userId: p.kind === "user" ? p.userId || null : null,
                requiresSign: p.kind === "project_role" && p.requiresSign,
                isOptional: p.isOptional,
                isObserver: p.isObserver,
              };
            }),
            requirements: s.requiresAttachment
              ? [
                  {
                    kind: "attachment",
                    minAttachments: s.minAttachments || 1,
                    message: s.attachmentMessage || "يرجى إرفاق المستند قبل الاعتماد",
                    appliesTo: "advancing",
                  },
                ]
              : [],
          };
        }),
      });

      onSuccess(result);
      onClose();
    } catch (e) {
      setError(errorMessage(e));
    }
  }

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      size="full"
      title={t.workflowAdmin.pipelineBuilderTitle}
      description={t.workflowAdmin.pipelineBuilderSubtitle}
      footer={
        <div className="flex w-full flex-wrap items-center justify-between gap-3">
          <div className="text-content-muted flex items-center gap-2 text-xs">
            <CheckCircle2 className="text-success size-4" />
            <span>{t.workflowAdmin.autoWiringNotice}</span>
          </div>

          <div className="flex items-center gap-2">
            <Button variant="ghost" onClick={onClose}>
              {t.common.cancel}
            </Button>
            <Button
              variant="primary"
              onClick={handleSave}
              isLoading={savePipeline.isPending}
              disabled={savePipeline.isPending}
              startIcon={<Sparkles aria-hidden className="size-4" />}
            >
              {t.workflowAdmin.saveAndGeneratePipeline}
            </Button>
          </div>
        </div>
      }
    >
      <div className="flex flex-col gap-6" dir="rtl">
        {error !== null && (
          <div
            role="alert"
            className="border-danger/30 bg-danger/10 text-danger flex items-center gap-2 rounded-lg border p-3 text-sm font-medium"
          >
            <span>{error}</span>
          </div>
        )}

        {/* دليل إرشادي لتوضيح التسلسل والتفرع */}
        <div className="bg-primary/5 border border-primary/20 rounded-xl p-3.5 text-xs text-content flex flex-col md:flex-row items-start md:items-center justify-between gap-3 shadow-xs">
          <div className="flex items-start gap-2.5">
            <Sparkles className="size-4 text-primary shrink-0 mt-0.5" />
            <div className="flex flex-col gap-0.5">
              <span className="font-bold text-sm text-content">
                منشئ مسارات سير العمل السريع (مع دعم التفرع والتوازي)
              </span>
              <p className="text-content-muted leading-relaxed">
                بشكل افتراضي تسير المعاملة خطياً بالتسلسل الطبيعي (<span className="font-semibold text-content" dir="ltr">1 → 2 → 3</span>). لتشعيب المسار (توازي أو تخطي مراحل)، يمكنك في أي مرحلة التبديل إلى خيار «مخصص / توازي» لاختيار وجهاتها بحرية، وضبط سياسة الالتقاء في مرحلة التجميع اللاحقة على <strong className="text-blue-600 dark:text-blue-400">انتظار الجميع (wait_all)</strong>.
              </p>
            </div>
          </div>
        </div>

        {/* شريط القوالب السريعة */}
        <section className="bg-surface-sunken border-border flex flex-col gap-2.5 rounded-xl border p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Sparkles className="text-primary size-4" />
              <span className="text-content text-sm font-bold">
                {t.workflowAdmin.quickPresets}
              </span>
              <span className="text-content-muted text-xs">
                (اختر قالباً جاهزاً أو اختر «قالب فارغ» لتسمية المسار والمراحل بحرية)
              </span>
            </div>

            <Button
              variant="ghost"
              size="sm"
              onClick={() => applyPreset(PRESETS[0]!)}
              startIcon={<FolderPlus className="size-3.5" />}
            >
              تفريغ / البدء من الصفر
            </Button>
          </div>

          <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2 lg:grid-cols-4">
            {PRESETS.map((preset, idx) => (
              <button
                key={idx}
                type="button"
                onClick={() => applyPreset(preset)}
                className="hover:border-primary/50 hover:bg-surface border-border bg-surface/60 group flex flex-col items-start gap-1.5 rounded-lg border p-3 text-right transition-all"
              >
                <div className="flex w-full items-center justify-between">
                  <span className="text-content group-hover:text-primary text-sm font-bold">
                    {preset.name}
                  </span>
                  <Badge tone={preset.badgeTone ?? "neutral"}>
                    {preset.stages.length} {preset.stages.length === 1 ? "مرحلة" : "مراحل"}
                  </Badge>
                </div>
                <p className="text-content-muted line-clamp-2 text-xs">
                  {preset.description}
                </p>
              </button>
            ))}
          </div>
        </section>

        {/* بيانات المسار الأساسية */}
        <section className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <FormField label="اسم المسار" required>
            {(id) => (
              <Input
                id={id}
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="مثال: مسار مراجعة واعتماد المراسلات والمذكرات"
              />
            )}
          </FormField>

          <FormField
            label="رمز نوع المعاملة (معرّف إنجليزي فريد)"
            required
          >
            {(id) => (
              <Input
                id={id}
                dir="ltr"
                value={transactionType}
                onChange={(e) => setTransactionType(e.target.value.toLowerCase())}
                placeholder="مثال: subcontractor_claim"
              />
            )}
          </FormField>
        </section>

        {/* شريط خط الأنابيب (Pipeline Lanes) */}
        <section className="flex flex-col gap-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <span className="text-content text-base font-bold">
                مراحل المسار المتسلسلة ({stages.length})
              </span>
              <span className="text-content-muted text-xs">
                {t.workflowAdmin.dragToReorder}
              </span>
            </div>

            <Button
              variant="secondary"
              size="sm"
              onClick={() => handleAddStage()}
              startIcon={<Plus aria-hidden className="size-4" />}
            >
              {t.workflowAdmin.addStageToEnd}
            </Button>
          </div>

          {/* المسار الأفقي للمراحل */}
          <div className="bg-surface-sunken/50 border-border relative flex items-start gap-3 overflow-x-auto rounded-xl border p-4 pb-6">
            {stages.map((stage, index) => {
              const isFirst = index === 0;
              const isLast = index === stages.length - 1;
              const isDragging = draggedIndex === index;
              const isDropTarget = dragOverIndex === index;
              const hasAdvancedConfig =
                stage.completionPolicy !== "all" ||
                stage.joinPolicy !== "none" ||
                stage.claimPolicy !== "none" ||
                stage.requiresReceive ||
                stage.requiresAttachment ||
                stage.participants.length > 1 ||
                stage.returnHours > 0 ||
                stage.returnMinutes > 0;

              return (
                <div
                  key={stage.id}
                  className="flex shrink-0 items-start gap-3"
                  onDragOver={(e) => handleDragOver(e, index)}
                  onDrop={(e) => handleDrop(e, index)}
                >
                  {/* زر إدراج مرحلة سريعة بين مرحلتين */}
                  {index > 0 && (
                    <button
                      type="button"
                      title={t.workflowAdmin.insertStageHere}
                      onClick={() => handleAddStage(index)}
                      className="border-border bg-surface text-content-muted hover:border-primary hover:text-primary mt-36 -mx-1.5 flex size-7 shrink-0 items-center justify-center rounded-full border shadow-xs transition-all hover:scale-110"
                    >
                      <Plus className="size-3.5" />
                    </button>
                  )}

                  {/* بطاقة المرحلة */}
                  <div
                    draggable={dragEnabledIndex === index}
                    onDragStart={(e) => handleDragStart(e, index)}
                    onDragEnd={handleDragEnd}
                    className={`bg-surface relative flex w-92 flex-col gap-3 rounded-xl border p-4 shadow-xs transition-all ${
                      isDropTarget
                        ? "border-primary ring-primary/20 scale-[1.01] ring-2"
                        : "border-border hover:border-primary/40"
                    } ${isDragging ? "opacity-50 border-primary/60 border-dashed scale-[0.99]" : "opacity-100"}`}
                  >
                    {/* رأس بطاقة المرحلة */}
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <div
                          className="text-content-muted hover:text-content cursor-grab p-0.5 active:cursor-grabbing"
                          title={t.workflowAdmin.dragToReorder}
                          onMouseEnter={() => setDragEnabledIndex(index)}
                          onMouseLeave={() => {
                            if (draggedIndex === null) {
                              setDragEnabledIndex(null);
                            }
                          }}
                          onMouseDown={() => setDragEnabledIndex(index)}
                        >
                          <GripVertical className="size-4" />
                        </div>

                        <span className="bg-primary/10 text-primary flex size-6 items-center justify-center rounded-full text-xs font-bold">
                          {index + 1}
                        </span>

                        <Badge tone={isFirst ? "info" : isLast ? "success" : "neutral"}>
                          {isFirst
                            ? "بداية المسار"
                            : isLast
                              ? "نهاية وأرشفة"
                              : "مرحلة مراجعة"}
                        </Badge>
                      </div>

                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          aria-label="تحريك لليمين (سابق)"
                          disabled={isFirst}
                          onClick={() => handleMoveStage(index, index - 1)}
                          className="hover:bg-surface-sunken text-content-muted disabled:opacity-20 rounded p-1"
                        >
                          <ChevronRight className="size-4" />
                        </button>
                        <button
                          type="button"
                          aria-label="تحريك لليسار (لاحق)"
                          disabled={isLast}
                          onClick={() => handleMoveStage(index, index + 1)}
                          className="hover:bg-surface-sunken text-content-muted disabled:opacity-20 rounded p-1"
                        >
                          <ChevronLeft className="size-4" />
                        </button>

                        {stages.length > 1 && (
                          <button
                            type="button"
                            aria-label="حذف المرحلة"
                            onClick={() => handleRemoveStage(index)}
                            className="hover:bg-danger/10 text-content-muted hover:text-danger rounded p-1 transition-colors"
                          >
                            <Trash2 className="size-4" />
                          </button>
                        )}
                      </div>
                    </div>

                    {/* حقل اسم المرحلة */}
                    <div className="flex flex-col gap-1">
                      <label className="text-content-muted text-xs font-medium">
                        اسم المرحلة
                      </label>
                      <Input
                        value={stage.name}
                        onChange={(e) => updateStage(index, { name: e.target.value })}
                        placeholder="اسم المرحلة"
                        className="text-sm font-semibold"
                      />
                    </div>

                    {/* رمز المرحلة (إنجليزي فريد) */}
                    <div className="flex flex-col gap-1">
                      <div className="flex items-center justify-between">
                        <label className="text-content-muted text-xs font-medium">
                          رمز المرحلة (إنجليزي فريد)
                        </label>
                        <span className="text-content-muted font-mono text-[10px]" dir="ltr">
                          a-z, 0-9, _
                        </span>
                      </div>
                      <Input
                        dir="ltr"
                        value={stage.stageKey}
                        onChange={(e) =>
                          updateStage(index, {
                            stageKey: e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ""),
                          })
                        }
                        placeholder={`stage_${index + 1}`}
                        className="font-mono text-xs"
                      />
                    </div>

                    {/* المشاركون في المرحلة */}
                    <div className="flex flex-col gap-2">
                      <div className="flex items-center justify-between">
                        <label className="text-content-muted flex items-center gap-1 text-xs font-medium">
                          <Users className="size-3.5" />
                          <span>المشاركون في المرحلة ({stage.participants.length})</span>
                        </label>

                        <button
                          type="button"
                          onClick={() => addParticipantToStage(index)}
                          className="text-primary hover:text-primary-hover flex items-center gap-1 text-[11px] font-semibold"
                        >
                          <UserPlus className="size-3" />
                          <span>+ مشارك إضافي</span>
                        </button>
                      </div>

                      {stage.participants.map((p, pIdx) => {
                        const isMain = pIdx === 0;
                        return (
                          <div
                            key={p.id}
                            className="bg-surface-sunken border-border/80 flex flex-col gap-2 rounded-lg border p-2.5 text-xs"
                          >
                            <div className="flex items-center justify-between">
                              <span className="text-content font-bold">
                                {isMain ? "المشارك الرئيسي" : `مشارك إضافي (${pIdx + 1})`}
                              </span>

                              {stage.participants.length > 1 && (
                                <button
                                  type="button"
                                  onClick={() => removeParticipant(index, pIdx)}
                                  className="text-content-muted hover:text-danger"
                                  title="إزالة المشارك"
                                >
                                  <Trash2 className="size-3.5" />
                                </button>
                              )}
                            </div>

                            <Select
                              value={p.kind}
                              onChange={(e) =>
                                updateParticipant(index, pIdx, {
                                  kind: e.target.value as ParticipantKind,
                                })
                              }
                              options={[
                                { value: "requester", label: "مقدّم الطلب (صاحب المعاملة)" },
                                { value: "project_role", label: "دور في المشروع (مثل مدير المشروع)" },
                                { value: "role", label: "دور عام في النظام (مثل المحاسب)" },
                                { value: "user", label: "موظف محدد بالاسم" },
                              ]}
                            />

                            {(p.kind === "role" || p.kind === "project_role") && (
                              <div className="flex flex-col gap-1">
                                <Select
                                  value={resolveParticipantRoleId(p)}
                                  onChange={(e) =>
                                    updateParticipant(index, pIdx, { roleId: e.target.value })
                                  }
                                  placeholder="اختر الدور المطلوب..."
                                  className={!resolveParticipantRoleId(p) ? "border-amber-500 ring-1 ring-amber-500/30" : ""}
                                  options={(roles.data ?? []).map((r) => ({
                                    value: r.id,
                                    label: r.name,
                                  }))}
                                />
                                {!resolveParticipantRoleId(p) && (
                                  <span className="text-[10px] font-medium text-amber-600 dark:text-amber-400">
                                    * يرجى اختيار الدور المطلوب
                                  </span>
                                )}
                              </div>
                            )}

                            {p.kind === "user" && (
                              <div className="flex flex-col gap-1">
                                <Select
                                  value={p.userId}
                                  onChange={(e) =>
                                    updateParticipant(index, pIdx, { userId: e.target.value })
                                  }
                                  placeholder="اختر الموظف..."
                                  className={!p.userId ? "border-amber-500 ring-1 ring-amber-500/30" : ""}
                                  options={(profiles.data ?? [])
                                    .filter((prof) => prof.isActive)
                                    .map((prof) => ({
                                      value: prof.id,
                                      label: prof.fullName,
                                    }))}
                                />
                                {!p.userId && (
                                  <span className="text-[10px] font-medium text-amber-600 dark:text-amber-400">
                                    * يرجى اختيار الموظف المحدد
                                  </span>
                                )}
                              </div>
                            )}

                            <div className="flex flex-wrap items-center gap-2 pt-1 text-[11px]">
                              {p.kind === "project_role" && (
                                <label className="text-content-muted flex cursor-pointer items-center gap-1.5">
                                  <input
                                    type="checkbox"
                                    checked={p.requiresSign}
                                    onChange={(e) =>
                                      updateParticipant(index, pIdx, {
                                        requiresSign: e.target.checked,
                                      })
                                    }
                                    className="text-primary rounded border-gray-300"
                                  />
                                  <span>توقيع رقمي</span>
                                </label>
                              )}

                              {!isMain && (
                                <label className="text-content-muted flex cursor-pointer items-center gap-1.5">
                                  <input
                                    type="checkbox"
                                    checked={p.isOptional}
                                    onChange={(e) =>
                                      updateParticipant(index, pIdx, {
                                        isOptional: e.target.checked,
                                      })
                                    }
                                    className="text-primary rounded border-gray-300"
                                  />
                                  <span>مشارك اختياري</span>
                                </label>
                              )}

                              <label className="text-content-muted flex cursor-pointer items-center gap-1.5">
                                <input
                                  type="checkbox"
                                  checked={p.isObserver}
                                  onChange={(e) =>
                                    updateParticipant(index, pIdx, {
                                      isObserver: e.target.checked,
                                    })
                                  }
                                  className="text-primary rounded border-gray-300"
                                />
                                <span>مراقب (اطلاع فقط)</span>
                              </label>
                            </div>
                          </div>
                        );
                      })}
                    </div>

                    {/* المهلة الزمنية المحددة بالساعات والدقائق */}
                    <div className="flex flex-col gap-1.5">
                      <label className="text-content-muted flex items-center justify-between text-xs font-medium">
                        <span className="flex items-center gap-1">
                          <Clock className="size-3.5 text-primary" />
                          <span>المهلة المحددة للإنجاز:</span>
                        </span>
                        {(stage.slaHours > 0 || stage.slaMinutes > 0) && (
                          <span className="text-primary font-mono text-[11px] font-bold">
                            {stage.slaHours > 0 ? `${stage.slaHours} س ` : ""}
                            {stage.slaMinutes > 0 ? `${stage.slaMinutes} د` : ""}
                          </span>
                        )}
                      </label>

                      <div className="grid grid-cols-2 gap-2">
                        <div className="bg-surface-sunken border-border/80 flex items-center gap-1.5 rounded-lg border px-2 py-1">
                          <Input
                            type="number"
                            min="0"
                            value={stage.slaHours === 0 ? "" : stage.slaHours}
                            onChange={(e) =>
                              updateStage(index, {
                                slaHours: Math.max(0, Number(e.target.value)),
                              })
                            }
                            placeholder="0"
                            className="text-center font-bold"
                          />
                          <span className="text-content-muted shrink-0 text-xs">ساعة</span>
                        </div>

                        <div className="bg-surface-sunken border-border/80 flex items-center gap-1.5 rounded-lg border px-2 py-1">
                          <Input
                            type="number"
                            min="0"
                            max="59"
                            value={stage.slaMinutes === 0 ? "" : stage.slaMinutes}
                            onChange={(e) =>
                              updateStage(index, {
                                slaMinutes: Math.max(
                                  0,
                                  Math.min(59, Number(e.target.value)),
                                ),
                              })
                            }
                            placeholder="0"
                            className="text-center font-bold"
                          />
                          <span className="text-content-muted shrink-0 text-xs">دقيقة</span>
                        </div>
                      </div>

                      {/* أزرار سريعة شائعة لملء الساعات */}
                      <div className="flex flex-wrap items-center gap-1 pt-0.5">
                        {[
                          { label: "12 س", h: 12, m: 0 },
                          { label: "24 س (يوم)", h: 24, m: 0 },
                          { label: "48 س (يومان)", h: 48, m: 0 },
                          { label: "72 س (3 أيام)", h: 72, m: 0 },
                        ].map((preset) => (
                          <button
                            key={preset.label}
                            type="button"
                            onClick={() =>
                              updateStage(index, {
                                slaHours: preset.h,
                                slaMinutes: preset.m,
                              })
                            }
                            className="border-border bg-surface hover:border-primary hover:text-primary rounded border px-2 py-0.5 text-[11px] transition-colors"
                          >
                            {preset.label}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* زر التبديل للخيارات المتقدمة */}
                    <button
                      type="button"
                      onClick={() =>
                        updateStage(index, { showAdvanced: !stage.showAdvanced })
                      }
                      className={`flex w-full items-center justify-between rounded-lg border px-3 py-2 text-xs font-semibold transition-all ${
                        stage.showAdvanced
                          ? "border-primary/50 bg-primary/10 text-primary"
                          : hasAdvancedConfig
                            ? "border-amber-500/40 bg-amber-500/10 text-amber-600 dark:text-amber-400"
                            : "border-border text-content-muted hover:bg-surface-sunken"
                      }`}
                    >
                      <span className="flex items-center gap-1.5">
                        <Sliders className="size-3.5" />
                        <span>الخيارات والسياسات المتقدمة</span>
                        {hasAdvancedConfig && (
                          <span className="size-1.5 rounded-full bg-amber-500" />
                        )}
                      </span>
                      {stage.showAdvanced ? (
                        <ChevronUp className="size-3.5" />
                      ) : (
                        <ChevronDown className="size-3.5" />
                      )}
                    </button>

                    {/* قسم الخيارات المتقدمة الموسّع */}
                    {stage.showAdvanced && (
                      <div className="border-border/80 bg-surface-sunken/60 flex flex-col gap-3 rounded-lg border p-3 text-xs">
                        {/* سياسة الإنجاز */}
                        <div className="flex flex-col gap-1">
                          <label className="text-content-muted font-medium">
                            سياسة الإنجاز للمرحلة:
                          </label>
                          <Select
                            value={stage.completionPolicy}
                            onChange={(e) =>
                              updateStage(index, {
                                completionPolicy: e.target.value as CompletionPolicy,
                              })
                            }
                            options={[
                              { value: "all", label: "الجميع (يجب موافقة كل المشاركين)" },
                              { value: "any", label: "أوّلهم (يكفي أول من يعتمد)" },
                              { value: "quorum", label: "نصاب عددي محدد" },
                            ]}
                          />
                        </div>

                        {stage.completionPolicy === "quorum" && (
                          <div className="flex flex-col gap-1">
                            <label className="text-content-muted">عدد النصاب المطلوب:</label>
                            <Input
                              type="number"
                              min="1"
                              value={stage.quorumCount}
                              onChange={(e) =>
                                updateStage(index, { quorumCount: Number(e.target.value) })
                              }
                            />
                          </div>
                        )}

                        {/* سياسة الالتقاء للمسارات المتفرعة */}
                        <div className="flex flex-col gap-1">
                          <label className="text-content-muted font-medium">
                            سياسة الالتقاء (Join Policy):
                          </label>
                          <Select
                            value={stage.joinPolicy}
                            onChange={(e) =>
                              updateStage(index, {
                                joinPolicy: e.target.value as JoinPolicy,
                              })
                            }
                            options={[
                              { value: "none", label: "عادي (لا ينتظر فروع أخرى)" },
                              { value: "wait_all", label: "انتظار الجميع wait_all (للمسارات المتفرعة)" },
                            ]}
                          />
                        </div>

                        {/* سياسة الحجز */}
                        <div className="flex flex-col gap-1">
                          <label className="text-content-muted font-medium">
                            سياسة الحجز (Claim Policy):
                          </label>
                          <Select
                            value={stage.claimPolicy}
                            onChange={(e) =>
                              updateStage(index, {
                                claimPolicy: e.target.value as ClaimPolicy,
                              })
                            }
                            options={[
                              { value: "none", label: "بدون حجز مسبق" },
                              { value: "exclusive", label: "حجز حصري (يجب حجزها قبل الاعتماد)" },
                            ]}
                          />
                        </div>

                        {/* شروط الجاهزية (المرفقات) */}
                        <div className="border-border/60 flex flex-col gap-1.5 border-t pt-2">
                          <label className="text-content flex cursor-pointer items-center gap-2 font-medium">
                            <input
                              type="checkbox"
                              checked={stage.requiresAttachment}
                              onChange={(e) =>
                                updateStage(index, { requiresAttachment: e.target.checked })
                              }
                              className="text-primary rounded border-gray-300"
                            />
                            <Paperclip className="size-3.5 text-amber-500" />
                            <span>اشتراط رفع مستند قبل الاعتماد</span>
                          </label>

                          {stage.requiresAttachment && (
                            <div className="flex flex-col gap-1.5 pr-5">
                              <Input
                                value={stage.attachmentMessage}
                                onChange={(e) =>
                                  updateStage(index, { attachmentMessage: e.target.value })
                                }
                                placeholder="رسالة التنبيه (مثال: أرفق صورة المستخلص موقّعة)"
                              />
                            </div>
                          )}
                        </div>

                        {/* مهلة الإرجاع المخصصة بالساعات والدقائق */}
                        <div className="border-border/60 flex flex-col gap-1.5 border-t pt-2">
                          <label className="text-content-muted flex items-center justify-between font-medium">
                            <span className="flex items-center gap-1">
                              <Undo2 className="size-3.5 text-amber-500" />
                              <span>مهلة الإرجاع عند الرفض للتصحيح:</span>
                            </span>
                            {(stage.returnHours > 0 || stage.returnMinutes > 0) && (
                              <span className="text-amber-500 font-mono text-[11px] font-bold">
                                {stage.returnHours > 0 ? `${stage.returnHours} س ` : ""}
                                {stage.returnMinutes > 0 ? `${stage.returnMinutes} د` : ""}
                              </span>
                            )}
                          </label>
                          <p className="text-content-muted text-[11px]">
                            المهلة التي تُعطى عند إرجاع المعاملة لتصحيح الخطأ بدلاً من إعادة المهلة الكاملة من البداية.
                          </p>

                          <div className="grid grid-cols-2 gap-2">
                            <div className="bg-surface border-border/80 flex items-center gap-1.5 rounded-lg border px-2 py-1">
                              <Input
                                type="number"
                                min="0"
                                value={stage.returnHours === 0 ? "" : stage.returnHours}
                                onChange={(e) =>
                                  updateStage(index, {
                                    returnHours: Math.max(0, Number(e.target.value)),
                                  })
                                }
                                placeholder="0"
                                className="text-center font-bold"
                              />
                              <span className="text-content-muted shrink-0 text-xs">ساعة</span>
                            </div>

                            <div className="bg-surface border-border/80 flex items-center gap-1.5 rounded-lg border px-2 py-1">
                              <Input
                                type="number"
                                min="0"
                                max="59"
                                value={stage.returnMinutes === 0 ? "" : stage.returnMinutes}
                                onChange={(e) =>
                                  updateStage(index, {
                                    returnMinutes: Math.max(
                                      0,
                                      Math.min(59, Number(e.target.value)),
                                    ),
                                  })
                                }
                                placeholder="0"
                                className="text-center font-bold"
                              />
                              <span className="text-content-muted shrink-0 text-xs">دقيقة</span>
                            </div>
                          </div>

                          <div className="flex flex-wrap items-center gap-1 pt-0.5">
                            {[
                              { label: "30 دقيقة", h: 0, m: 30 },
                              { label: "ساعة واحدة", h: 1, m: 0 },
                              { label: "ساعتان (120 د)", h: 2, m: 0 },
                              { label: "4 ساعات", h: 4, m: 0 },
                            ].map((rPreset) => (
                              <button
                                key={rPreset.label}
                                type="button"
                                onClick={() =>
                                  updateStage(index, {
                                    returnHours: rPreset.h,
                                    returnMinutes: rPreset.m,
                                  })
                                }
                                className="border-border bg-surface hover:border-amber-500 hover:text-amber-500 rounded border px-2 py-0.5 text-[11px] transition-colors"
                              >
                                {rPreset.label}
                              </button>
                            ))}
                          </div>
                        </div>

                        {/* خيارات إضافية */}
                        <div className="border-border/60 flex flex-col gap-2 border-t pt-2">
                          <label className="text-content-muted flex cursor-pointer items-center gap-2">
                            <input
                              type="checkbox"
                              checked={stage.requiresReceive}
                              onChange={(e) =>
                                updateStage(index, { requiresReceive: e.target.checked })
                              }
                              className="text-primary rounded border-gray-300"
                            />
                            <span>يلزم استلام المعاملة أولاً (Requires Receive)</span>
                          </label>

                          {/* لا تظهر خيار الأرشفة لمرحلة البداية مطلقا */}
                          {index > 0 && (
                            <label className="text-content-muted flex cursor-pointer items-center gap-2">
                              <input
                                type="checkbox"
                                checked={stage.isArchive}
                                onChange={(e) =>
                                  updateStage(index, { isArchive: e.target.checked })
                                }
                                className="text-primary rounded border-gray-300"
                              />
                              <span>مرحلة أرشفة نهائية</span>
                            </label>
                          )}
                        </div>
                      </div>
                    )}

                    {/* خيار سياسة الالتقاء والتجميع wait_all إن كان مفعلاً */}
                    {stage.joinPolicy === "wait_all" && (
                      <div className="flex items-center gap-2 rounded-lg bg-blue-50 dark:bg-blue-950/60 border border-blue-300 dark:border-blue-700/80 px-2.5 py-1.5 text-xs text-blue-950 dark:text-blue-100 font-medium shadow-xs">
                        <Layers className="size-4 shrink-0 text-blue-700 dark:text-blue-300" />
                        <span>محطة تجميع (wait_all): تنتظر اكتمال كافة الفروع السابقة قبل الفتح</span>
                      </div>
                    )}

                    {/* قسم المرحلة التالية والتوجيه */}
                    <div className="bg-surface-sunken border-border/80 flex flex-col gap-2 rounded-lg border p-2.5 text-xs">
                      <div className="flex items-center justify-between">
                        <label className="text-content font-bold flex items-center gap-1.5">
                          <ArrowLeft className="size-3.5 text-primary" />
                          <span>المرحلة التالية بعد الاعتماد:</span>
                        </label>

                        {!isLast && (
                          <div className="flex items-center gap-1 text-[11px]">
                            <button
                              type="button"
                              onClick={() => updateStage(index, { targetMode: "auto" })}
                              className={`rounded px-2 py-0.5 font-medium transition-all ${
                                stage.targetMode === "auto"
                                  ? "bg-primary text-white font-semibold shadow-xs"
                                  : "text-content-muted hover:text-content hover:bg-surface"
                              }`}
                            >
                              تلقائي
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                const defaultTarget = stages[index + 1]?.stageKey || "";
                                updateStage(index, {
                                  targetMode: "custom",
                                  customTargets:
                                    stage.customTargets.length > 0
                                      ? stage.customTargets
                                      : defaultTarget
                                        ? [defaultTarget]
                                        : [],
                                });
                              }}
                              className={`rounded px-2 py-0.5 font-medium transition-all ${
                                stage.targetMode === "custom"
                                  ? "bg-amber-600 text-white font-semibold shadow-xs"
                                  : "text-content-muted hover:text-content hover:bg-surface"
                              }`}
                            >
                              مخصص / توازي
                            </button>
                          </div>
                        )}
                      </div>

                      {isLast ? (
                        <div className="text-content-muted flex items-center gap-1.5 bg-surface rounded border border-border/60 px-2 py-1.5 text-[11px]">
                          <CheckCircle2 className="size-3.5 text-success shrink-0" />
                          <span className="font-medium text-content">المرحلة الختامية: إغلاق وأرشفة المعاملة</span>
                        </div>
                      ) : stage.targetMode === "auto" ? (
                        <div className="text-content-muted flex items-center gap-1.5 bg-surface rounded border border-border/60 px-2 py-1.5 text-[11px]">
                          <span className="font-semibold text-content">التسلسل الطبيعي:</span>
                          <span className="text-primary font-medium flex items-center gap-1">
                            <span>{stages[index + 1]?.name || `المرحلة ${index + 2}`}</span>
                            <span className="font-mono text-[10px] text-content-muted">
                              ({stages[index + 1]?.stageKey})
                            </span>
                          </span>
                        </div>
                      ) : (
                        <div className="flex flex-col gap-2 pt-0.5">
                          <p className="text-content-muted text-[11px]">
                            اختر مرحلة أو أكثر لتنتقل إليها المعاملة عند الاعتماد (اختيار أكثر من مرحلة ينشئ تفرعاً متوازياً):
                          </p>

                          <div className="grid grid-cols-1 gap-1 max-h-32 overflow-y-auto">
                            {stages
                              .filter((_, otherIdx) => otherIdx !== index)
                              .map((otherStage, otherIdx) => {
                                const isChecked = stage.customTargets.includes(otherStage.stageKey);
                                return (
                                  <label
                                    key={otherStage.id || otherIdx}
                                    className={`flex items-center justify-between rounded-md border p-1.5 cursor-pointer text-[11px] transition-all ${
                                      isChecked
                                        ? "border-amber-500/60 bg-amber-500/10 font-medium text-amber-900 dark:text-amber-200"
                                        : "border-border bg-surface text-content hover:bg-surface-sunken"
                                    }`}
                                  >
                                    <div className="flex items-center gap-1.5">
                                      <input
                                        type="checkbox"
                                        checked={isChecked}
                                        onChange={(e) => {
                                          const nextTargets = e.target.checked
                                            ? [...stage.customTargets, otherStage.stageKey]
                                            : stage.customTargets.filter((k) => k !== otherStage.stageKey);
                                          updateStage(index, { customTargets: nextTargets });
                                        }}
                                        className="text-amber-600 rounded border-gray-300"
                                      />
                                      <span>{otherStage.name || `مرحلة ${otherStage.stageKey}`}</span>
                                    </div>
                                    <span className="font-mono text-[10px] text-content-muted" dir="ltr">
                                      {otherStage.stageKey}
                                    </span>
                                  </label>
                                );
                              })}
                          </div>

                          {stage.customTargets.length > 1 && (
                            <div className="flex items-center gap-2 rounded-lg bg-amber-50 dark:bg-amber-950/60 border border-amber-300 dark:border-amber-700/80 p-2 text-xs text-amber-950 dark:text-amber-100 shadow-xs">
                              <GitFork className="size-4 shrink-0 text-amber-700 dark:text-amber-300" />
                              <span className="leading-relaxed">
                                <strong className="font-bold text-amber-900 dark:text-amber-200">تفرع متوازي ({stage.customTargets.length} فروع):</strong> ستسير هذه الفروع معاً في نفس الوقت بعد اعتماد هذه المرحلة.
                              </span>
                            </div>
                          )}

                          {stage.customTargets.length === 0 && (
                            <span className="text-[10px] text-amber-600 dark:text-amber-400 font-medium">
                              * يرجى تحديد مرحلة واحدة على الأقل كوجهة بعد الاعتماد
                            </span>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}

            {/* بطاقة إضافة خطوة جديدة في النهاية */}
            <button
              type="button"
              onClick={() => handleAddStage()}
              className="hover:border-primary hover:bg-surface/80 border-border bg-surface/30 group flex w-36 shrink-0 flex-col items-center justify-center gap-2 rounded-xl border border-dashed transition-all"
              style={{ minHeight: "280px" }}
            >
              <div className="bg-surface group-hover:bg-primary group-hover:text-on-primary border-border text-content-muted flex size-10 items-center justify-center rounded-full border transition-all">
                <Plus className="size-5" />
              </div>
              <span className="text-content-muted group-hover:text-primary text-xs font-semibold">
                إضافة مرحلة
              </span>
            </button>
          </div>
        </section>

        {/* المعاينة الحية لتدفق الأزرار التلقائي */}
        <section className="bg-surface border-border flex flex-col gap-3 rounded-xl border p-4 shadow-xs">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <FileCheck className="text-success size-4" />
              <span className="text-content text-sm font-bold">
                المعاينة البصرية للتوجيه التلقائي (Auto-wiring)
              </span>
            </div>

            <label className="flex cursor-pointer items-center gap-2 text-xs font-medium">
              <input
                type="checkbox"
                checked={autoWireActions}
                onChange={(e) => setAutoWireActions(e.target.checked)}
                className="text-primary rounded border-gray-300"
              />
              <span>تفعيل الربط التلقائي للأزرار والتوجيهات</span>
            </label>
          </div>

          <div className="bg-surface-sunken flex flex-col gap-2 rounded-lg p-3 text-xs">
            <div className="flex flex-wrap items-center gap-3">
              <div className="flex items-center gap-1.5">
                <span className="size-2 rounded-full bg-emerald-500" />
                <span className="text-content font-medium">اعتماد وإرسال:</span>
                <span className="text-content-muted">
                  ينقل المعاملة للمرحلة التالية مباشرة
                </span>
              </div>

              <div className="flex items-center gap-1.5">
                <span className="size-2 rounded-full bg-rose-500" />
                <span className="text-content font-medium">إرجاع / رفض:</span>
                <span className="text-content-muted">
                  يُرجع المعاملة للمرحلة السابقة مع تدوين ملاحظة ومهلة الإرجاع المحددة
                </span>
              </div>

              <div className="flex items-center gap-1.5">
                <span className="size-2 rounded-full bg-blue-500" />
                <span className="text-content font-medium">إغلاق وأرشفة:</span>
                <span className="text-content-muted">
                  يُنهي مسار المعاملة ويحيلها للأرشيف
                </span>
              </div>
            </div>

            {/* خريطة التدفق البصري للمسار */}
            <div className="border-border/60 mt-2 flex flex-col gap-2 border-t pt-2">
              <span className="text-content font-bold text-xs">خريطة التدفق البصري للمسار:</span>
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
                {stages.map((stage, idx) => {
                  const isCustom = stage.targetMode === "custom";
                  const isLast = idx === stages.length - 1 && stage.isArchive;

                  let nextStageNames: string[];
                  if (isLast) {
                    nextStageNames = ["إغلاق وأرشفة المعاملة"];
                  } else if (isCustom) {
                    const mapped = stage.customTargets.map(
                      (k) => stages.find((st) => st.stageKey === k)?.name || k,
                    );
                    nextStageNames = mapped.length > 0 ? mapped : ["(لم يتم تحديد وجهة)"];
                  } else if (idx < stages.length - 1) {
                    nextStageNames = [stages[idx + 1]?.name || `المرحلة ${idx + 2}`];
                  } else {
                    nextStageNames = ["إغلاق وأرشفة المعاملة"];
                  }

                  const isFork = nextStageNames.length > 1;

                  return (
                    <div
                      key={stage.id || idx}
                      className={`rounded-lg border p-2 flex flex-col gap-1.5 text-[11px] ${
                        isFork
                          ? "border-amber-400 dark:border-amber-700/80 bg-amber-50/80 dark:bg-amber-950/40 text-amber-950 dark:text-amber-100"
                          : stage.joinPolicy === "wait_all"
                            ? "border-blue-400 dark:border-blue-700/80 bg-blue-50/80 dark:bg-blue-950/40 text-blue-950 dark:text-blue-100"
                            : "border-border bg-surface text-content"
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-bold flex items-center gap-1.5">
                          <span className="bg-primary/10 text-primary size-4 rounded-full inline-flex items-center justify-center text-[10px]">
                            {idx + 1}
                          </span>
                          <span>{stage.name || `المرحلة ${idx + 1}`}</span>
                        </span>
                        {stage.joinPolicy === "wait_all" && (
                          <Badge tone="info">wait_all</Badge>
                        )}
                        {isFork && (
                          <Badge tone="warning">تفرع توازي ({nextStageNames.length})</Badge>
                        )}
                      </div>

                      <div className="flex items-start gap-1.5 text-content-muted pt-0.5">
                        <ArrowLeft className="size-3 text-primary shrink-0 mt-0.5" />
                        <div className="flex flex-wrap gap-1">
                          {nextStageNames.map((n, nIdx) => (
                            <span
                              key={nIdx}
                              className={`rounded px-1.5 py-0.5 text-[10px] font-semibold ${
                                isFork
                                  ? "bg-amber-200/70 dark:bg-amber-900/60 text-amber-950 dark:text-amber-100 border border-amber-300 dark:border-amber-700"
                                  : "bg-surface-sunken text-content border border-border/50"
                              }`}
                            >
                              {n}
                            </span>
                          ))}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </section>
      </div>
    </Modal>
  );
}
