/**
 * تعريفات الشاشات المحمَّلة كسولًا.
 *
 * مفصولة عن `routes.tsx` عمدًا: ملف واحد لا يجمع تصديرَ مكوّنات وتصديرَ
 * قيمة عادية (`router`) — هذا ما تفرضه قاعدة `react-refresh` ليبقى
 * التحديث الساخن أثناء التطوير عاملًا.
 *
 * `LoginPage` ليست هنا: هي أول ما يُعرض، وتأجيلها يضيف دورة تحميل بلا مقابل.
 */
import { lazy } from "react";

export const UsersPage = lazy(() =>
  import("@presentation/features/identity/pages/UsersPage").then((m) => ({
    default: m.UsersPage,
  })),
);
export const RolesPage = lazy(() =>
  import("@presentation/features/identity/pages/RolesPage").then((m) => ({
    default: m.RolesPage,
  })),
);
export const ProjectsPage = lazy(() =>
  import("@presentation/features/projects/pages/ProjectsPage").then((m) => ({
    default: m.ProjectsPage,
  })),
);
export const SettingsPage = lazy(() =>
  import("@presentation/features/settings/pages/SettingsPage").then((m) => ({
    default: m.SettingsPage,
  })),
);
export const DashboardPage = lazy(() =>
  import("@presentation/features/platform/pages/DashboardPage").then((m) => ({
    default: m.DashboardPage,
  })),
);
export const SetupCheckPage = lazy(() =>
  import("@presentation/features/platform/pages/SetupCheckPage").then((m) => ({
    default: m.SetupCheckPage,
  })),
);
export const ItemsPage = lazy(() =>
  import("@presentation/features/catalog/pages/ItemsPage").then((m) => ({
    default: m.ItemsPage,
  })),
);
export const BoqPage = lazy(() =>
  import("@presentation/features/catalog/pages/BoqPage").then((m) => ({
    default: m.BoqPage,
  })),
);
export const AccountsPage = lazy(() =>
  import("@presentation/features/accounting/pages/AccountsPage").then((m) => ({
    default: m.AccountsPage,
  })),
);
export const JournalPage = lazy(() =>
  import("@presentation/features/accounting/pages/JournalPage").then((m) => ({
    default: m.JournalPage,
  })),
);
export const OpeningBalancesPage = lazy(() =>
  import("@presentation/features/accounting/pages/OpeningBalancesPage").then((m) => ({
    default: m.OpeningBalancesPage,
  })),
);
export const SuppliersPage = lazy(() =>
  import("@presentation/features/procurement/pages/SuppliersPage").then((m) => ({
    default: m.SuppliersPage,
  })),
);
export const MaterialRequestsPage = lazy(() =>
  import("@presentation/features/procurement/pages/MaterialRequestsPage").then((m) => ({
    default: m.MaterialRequestsPage,
  })),
);
export const PurchaseRequestsPage = lazy(() =>
  import("@presentation/features/procurement/pages/PurchaseRequestsPage").then((m) => ({
    default: m.PurchaseRequestsPage,
  })),
);
export const SupplyOrdersPage = lazy(() =>
  import("@presentation/features/procurement/pages/SupplyOrdersPage").then((m) => ({
    default: m.SupplyOrdersPage,
  })),
);
export const ReceiptsPage = lazy(() =>
  import("@presentation/features/procurement/pages/ReceiptsPage").then((m) => ({
    default: m.ReceiptsPage,
  })),
);
export const PaymentsPage = lazy(() =>
  import("@presentation/features/procurement/pages/PaymentsPage").then((m) => ({
    default: m.PaymentsPage,
  })),
);
export const TransferNotesPage = lazy(() =>
  import("@presentation/features/procurement/pages/TransferNotesPage").then((m) => ({
    default: m.TransferNotesPage,
  })),
);
export const InboxPage = lazy(() =>
  import("@presentation/features/workflow/pages/InboxPage").then((m) => ({
    default: m.InboxPage,
  })),
);
export const TransactionDetailPage = lazy(() =>
  import("@presentation/features/workflow/pages/TransactionDetailPage").then((m) => ({
    default: m.TransactionDetailPage,
  })),
);
export const WorkflowAdminPage = lazy(() =>
  import("@presentation/features/workflow/pages/WorkflowAdminPage").then((m) => ({
    default: m.WorkflowAdminPage,
  })),
);
export const WorkCalendarPage = lazy(() =>
  import("@presentation/features/workflow/pages/WorkCalendarPage").then((m) => ({
    default: m.WorkCalendarPage,
  })),
);
export const EvaluationPage = lazy(() =>
  import("@presentation/features/workflow/pages/EvaluationPage").then((m) => ({
    default: m.EvaluationPage,
  })),
);
export const FacilitiesPage = lazy(() =>
  import("@presentation/features/warehouse/pages/FacilitiesPage").then((m) => ({
    default: m.FacilitiesPage,
  })),
);
export const MandoubStockPage = lazy(() =>
  import("@presentation/features/warehouse/pages/MandoubStockPage").then((m) => ({
    default: m.MandoubStockPage,
  })),
);
export const ConsumptionPage = lazy(() =>
  import("@presentation/features/warehouse/pages/ConsumptionPage").then((m) => ({
    default: m.ConsumptionPage,
  })),
);
export const EquipmentPage = lazy(() =>
  import("@presentation/features/warehouse/pages/EquipmentPage").then((m) => ({
    default: m.EquipmentPage,
  })),
);
export const SurplusPage = lazy(() =>
  import("@presentation/features/warehouse/pages/SurplusPage").then((m) => ({
    default: m.SurplusPage,
  })),
);
export const WarehouseReportsPage = lazy(() =>
  import("@presentation/features/warehouse/pages/WarehouseReportsPage").then((m) => ({
    default: m.WarehouseReportsPage,
  })),
);
export const ContractorsPage = lazy(() =>
  import("@presentation/features/accounting/pages/ContractorsPage").then((m) => ({
    default: m.ContractorsPage,
  })),
);
export const ExtractsPage = lazy(() =>
  import("@presentation/features/accounting/pages/ExtractsPage").then((m) => ({
    default: m.ExtractsPage,
  })),
);
export const CustodiesPage = lazy(() =>
  import("@presentation/features/accounting/pages/CustodiesPage").then((m) => ({
    default: m.CustodiesPage,
  })),
);
export const AdvancesPage = lazy(() =>
  import("@presentation/features/accounting/pages/AdvancesPage").then((m) => ({
    default: m.AdvancesPage,
  })),
);
export const GuaranteesPage = lazy(() =>
  import("@presentation/features/accounting/pages/GuaranteesPage").then((m) => ({
    default: m.GuaranteesPage,
  })),
);
export const DeductionsPage = lazy(() =>
  import("@presentation/features/accounting/pages/DeductionsPage").then((m) => ({
    default: m.DeductionsPage,
  })),
);
export const WorkersPage = lazy(() =>
  import("@presentation/features/hr/pages/WorkersPage").then((m) => ({
    default: m.WorkersPage,
  })),
);
export const AttendancePage = lazy(() =>
  import("@presentation/features/hr/pages/AttendancePage").then((m) => ({
    default: m.AttendancePage,
  })),
);
export const LaborPoolPage = lazy(() =>
  import("@presentation/features/hr/pages/LaborPoolPage").then((m) => ({
    default: m.LaborPoolPage,
  })),
);
export const LoansPage = lazy(() =>
  import("@presentation/features/hr/pages/LoansPage").then((m) => ({
    default: m.LoansPage,
  })),
);
export const SelfServicePage = lazy(() =>
  import("@presentation/features/hr/pages/SelfServicePage").then((m) => ({
    default: m.SelfServicePage,
  })),
);
export const PayrollPage = lazy(() =>
  import("@presentation/features/hr/pages/PayrollPage").then((m) => ({
    default: m.PayrollPage,
  })),
);
export const ReportsPage = lazy(() =>
  import("@presentation/features/reports/pages/ReportsPage").then((m) => ({
    default: m.ReportsPage,
  })),
);
