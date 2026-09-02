import type { LucideIcon } from "lucide-react";
import {
  LayoutDashboard,
  FolderKanban,
  Users,
  ShieldCheck,
  Package,
  Layers,
  Wallet,
  BookOpen,
  Scale,
  Truck,
  ClipboardList,
  FileSearch,
  PackageCheck,
  Banknote,
  ArrowLeftRight,
  Inbox,
  GitBranch,
  CalendarClock,
  Trophy,
  ShoppingCart,
  Warehouse,
  Building2,
  PackageMinus,
  Boxes,
  BarChart3,
  HardHat,
  FileSpreadsheet,
  Wallet2,
  BadgeDollarSign,
  Percent,
  CalendarCheck,
  UsersRound,
  HandCoins,
  UserRound,
  UserCog,
  Settings,
  PieChart,
  // Stethoscope,
} from "lucide-react";
import { t } from "@i18n/index";

export interface NavItem {
  to: string;
  label: string;
  icon: LucideIcon;
  /** المرحلة التي تُفعَّل فيها الشاشة — قبلها تظهر معطّلة. */
  phase: number;
  /**
   * الصلاحية المطلوبة لرؤية العنصر — بلا قيمة يعني متاح لكل مستخدم نشط.
   * قائمة تعني «يكفي امتلاك إحداها»، كما في `ProtectedRoute`.
   */
  permission?: string | readonly string[];
}

export interface NavGroup {
  key: string;
  label: string;
  items: readonly NavItem[];
}

/**
 * القائمة مقسَّمة إلى مجموعات بعناوين.
 *
 * كانت قائمة مسطّحة من ٤١ عنصرًا، فكانت شاشات آخرها — شؤون الموظفين
 * والتقارير — تقع تحت حافة الشاشة ولا يعرف المستخدم أنها موجودة أصلًا.
 * التقسيم هنا يتبع وحدات المواصفات نفسها لا ترتيب المراحل، لأن المستخدم
 * يبحث عن «اليوميات» تحت «شؤون الموظفين» لا تحت «المرحلة السابعة».
 */
export const NAV_GROUPS = [
  {
    key: "general",
    label: t.navGroups.general,
    items: [
      { to: "/", label: t.nav.dashboard, icon: LayoutDashboard, phase: 0 },
      { to: "/projects", label: t.nav.projects, icon: FolderKanban, phase: 1 },
      { to: "/me", label: t.nav.selfService, icon: UserRound, phase: 7 },
    ],
  },
  {
    key: "identity",
    label: t.navGroups.identity,
    items: [
      {
        to: "/users",
        label: t.nav.users,
        icon: Users,
        phase: 1,
        permission: "user.read",
      },
      {
        to: "/roles",
        label: t.nav.roles,
        icon: ShieldCheck,
        phase: 1,
        permission: "role.read",
      },
    ],
  },
  {
    key: "catalog",
    label: t.navGroups.catalog,
    items: [
      {
        to: "/items",
        label: t.nav.items,
        icon: Package,
        phase: 2,
        permission: "item.read",
      },
      {
        to: "/boq",
        label: t.nav.boq,
        icon: Layers,
        phase: 2,
        permission: "boq.read",
      },
    ],
  },
  {
    key: "procurement",
    label: t.navGroups.procurement,
    items: [
      {
        to: "/suppliers",
        label: t.nav.suppliers,
        icon: Truck,
        phase: 3,
        permission: "supplier.read",
      },
      {
        to: "/material-requests",
        label: t.nav.materialRequests,
        icon: ClipboardList,
        phase: 3,
        permission: "material_request.read",
      },
      {
        to: "/purchase-requests",
        label: t.nav.purchase,
        icon: FileSearch,
        phase: 3,
        permission: "purchase.manage",
      },
      {
        to: "/supply-orders",
        label: t.nav.supplyOrders,
        icon: ShoppingCart,
        phase: 3,
        permission: "supply_order.manage",
      },
      {
        to: "/receipts",
        label: t.nav.receipts,
        icon: PackageCheck,
        phase: 3,
        permission: "receipt.confirm",
      },
      {
        to: "/payments",
        label: t.nav.payments,
        icon: Banknote,
        phase: 3,
        permission: "payment.manage",
      },
      {
        to: "/transfer-notes",
        label: t.nav.transferNotes,
        icon: ArrowLeftRight,
        phase: 3,
        permission: "transfer_note.manage",
      },
    ],
  },
  {
    key: "correspondence",
    label: t.navGroups.correspondence,
    items: [
      {
        to: "/inbox",
        label: t.nav.inbox2,
        icon: Inbox,
        phase: 4,
        permission: "transaction.read",
      },
      {
        to: "/workflow",
        label: t.nav.workflowAdmin,
        icon: GitBranch,
        phase: 4,
        permission: "workflow.manage",
      },
      {
        to: "/work-calendar",
        label: t.nav.workCalendar,
        icon: CalendarClock,
        phase: 4,
        permission: "work_calendar.manage",
      },
      {
        to: "/evaluation",
        label: t.nav.evaluation,
        icon: Trophy,
        phase: 4,
        permission: "evaluation.read",
      },
    ],
  },
  {
    key: "warehouse",
    label: t.navGroups.warehouse,
    items: [
      {
        to: "/facilities",
        label: t.nav.facilities,
        icon: Building2,
        phase: 5,
        permission: "warehouse.read",
      },
      {
        to: "/custody",
        label: t.nav.custody,
        icon: Warehouse,
        phase: 5,
        permission: "warehouse.read",
      },
      {
        to: "/consumption",
        label: t.nav.consumption,
        icon: PackageMinus,
        phase: 5,
        permission: "consumption.record",
      },
      {
        to: "/equipment",
        label: t.nav.equipment,
        icon: Truck,
        phase: 5,
        permission: "equipment.read",
      },
      {
        to: "/surplus",
        label: t.nav.surplus,
        icon: Boxes,
        phase: 5,
        permission: "warehouse.read",
      },
      {
        to: "/warehouse-reports",
        label: t.nav.warehouseReports,
        icon: BarChart3,
        phase: 5,
        permission: "warehouse.report",
      },
    ],
  },
  {
    key: "accounting",
    label: t.navGroups.accounting,
    items: [
      {
        to: "/accounts",
        label: t.nav.accounts,
        icon: Wallet,
        phase: 2,
        permission: "account.read",
      },
      {
        to: "/journal",
        label: t.nav.journal,
        icon: BookOpen,
        phase: 2,
        permission: "journal.read",
      },
      {
        to: "/opening-balances",
        label: t.nav.openingBalances,
        icon: Scale,
        phase: 2,
        permission: "opening_balance.manage",
      },
      {
        to: "/contractors",
        label: t.nav.contractors,
        icon: HardHat,
        phase: 6,
        permission: "contractor.read",
      },
      {
        to: "/extracts",
        label: t.nav.extracts,
        icon: FileSpreadsheet,
        phase: 6,
        permission: "extract.read",
      },
      {
        to: "/custodies",
        label: t.nav.custodies,
        icon: Wallet2,
        phase: 6,
        permission: "custody.read",
      },
      {
        to: "/advances",
        label: t.nav.advances,
        icon: BadgeDollarSign,
        phase: 6,
        permission: "advance.manage",
      },
      {
        to: "/guarantees",
        label: t.nav.guarantees,
        icon: ShieldCheck,
        phase: 6,
        permission: "guarantee.manage",
      },
      {
        to: "/deductions",
        label: t.nav.deductions,
        icon: Percent,
        phase: 6,
        permission: "deduction.manage",
      },
    ],
  },
  {
    key: "hr",
    label: t.navGroups.hr,
    items: [
      {
        to: "/workers",
        label: t.nav.workers,
        icon: UserCog,
        phase: 7,
        permission: "worker.read",
      },
      {
        to: "/attendance",
        label: t.nav.attendance,
        icon: CalendarCheck,
        phase: 7,
        permission: "attendance.read",
      },
      {
        to: "/labor-pool",
        label: t.nav.laborPool,
        icon: UsersRound,
        phase: 7,
        permission: "worker.read",
      },
      {
        to: "/loans",
        label: t.nav.loans,
        icon: HandCoins,
        phase: 7,
        permission: "loan.read",
      },
      {
        to: "/payroll",
        label: t.nav.payroll,
        icon: Banknote,
        phase: 7,
        permission: "payroll.import",
      },
    ],
  },
  {
    key: "reports",
    label: t.navGroups.reports,
    items: [
      {
        to: "/reports",
        label: t.nav.reports,
        icon: PieChart,
        phase: 8,
        permission: ["report.read", "report.financial"],
      },
    ],
  },
  {
    key: "system",
    label: t.navGroups.system,
    items: [
      {
        // الإعدادات تكشف نسب الضريبة وحسابات الترحيل وعتبات الهدر —
        // ليست شاشة اطّلاع عامّة
        to: "/settings",
        label: t.nav.settings,
        icon: Settings,
        phase: 1,
        permission: "settings.manage",
      },
      // {
      //   to: "/setup",
      //   label: t.nav.setupCheck,
      //   icon: Stethoscope,
      //   phase: 0,
      //   permission: "settings.manage",
      // },
    ],
  },
] as const satisfies readonly NavGroup[];

/**
 * المجموعات بنوع موسَّع — هذا ما تستهلكه الواجهة.
 * `NAV_GROUPS` نفسها `as const` لتُشتقّ منها أنواع المسارات الحرفية، وذلك
 * يجعل العناصر بلا صلاحية تفقد الخاصية أصلًا فلا تُقرأ من الاتحاد.
 */
export const NAV_SECTIONS: readonly NavGroup[] = NAV_GROUPS;

/** القائمة مسطّحة — لمن يحتاج البحث في كل الشاشات بلا تجميع. */
export const NAV_ITEMS: readonly NavItem[] = NAV_SECTIONS.flatMap((g) => g.items);

/** مسارات الشاشات المعروفة — نوع حرفي يمنع الأخطاء المطبعية عند الحراسة. */
export type ScreenPath = (typeof NAV_GROUPS)[number]["items"][number]["to"];

/**
 * صلاحية الشاشة — **المصدر الوحيد** الذي يستعمله الشريط الجانبي وحارس
 * المسار معًا.
 *
 * قبل ذلك كانت الصلاحية مكتوبة مرّتين: مرّة في عنصر القائمة ومرّة في
 * `routes.tsx`. ولو اختلفتا لظهرت شاشة في القائمة ثم رفضت فتحها، أو —
 * وهو الأسوأ — لاختفت من القائمة وبقي رابطها مفتوحًا لمن يعرفه.
 * التوحيد هنا يجعل ذلك الاختلاف مستحيلًا، والنوع الحرفي يجعل المسار
 * الخاطئ خطأ ترجمة لا مفاجأة وقت التشغيل.
 */
export function screenPermission(
  path: ScreenPath,
): string | readonly string[] | undefined {
  return NAV_ITEMS.find((item) => item.to === path)?.permission;
}
