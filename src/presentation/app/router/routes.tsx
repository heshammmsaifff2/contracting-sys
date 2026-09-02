import { createBrowserRouter, Navigate, type RouteObject } from "react-router-dom";
import { AppShell } from "@presentation/shared/layouts/AppShell";
import { ProtectedRoute } from "./ProtectedRoute";
import { screenPermission } from "@presentation/shared/layouts/nav-items";
import {
  UsersPage,
  RolesPage,
  ProjectsPage,
  SettingsPage,
  DashboardPage,
  // SetupCheckPage,
  ItemsPage,
  BoqPage,
  AccountsPage,
  JournalPage,
  OpeningBalancesPage,
  SuppliersPage,
  MaterialRequestsPage,
  PurchaseRequestsPage,
  SupplyOrdersPage,
  ReceiptsPage,
  PaymentsPage,
  TransferNotesPage,
  InboxPage,
  TransactionDetailPage,
  WorkflowAdminPage,
  WorkCalendarPage,
  EvaluationPage,
  FacilitiesPage,
  MandoubStockPage,
  ConsumptionPage,
  EquipmentPage,
  SurplusPage,
  WarehouseReportsPage,
  ContractorsPage,
  ExtractsPage,
  CustodiesPage,
  AdvancesPage,
  GuaranteesPage,
  DeductionsPage,
  WorkersPage,
  AttendancePage,
  LaborPoolPage,
  LoansPage,
  SelfServicePage,
  PayrollPage,
  ReportsPage,
} from "./lazy-pages";
import { LoginPage } from "@presentation/features/identity/pages/LoginPage";

/**
 * كل المسارات خلف ProtectedRoute عدا صفحة الدخول.
 * حراسة الصلاحيات هنا لتجربة الاستخدام؛ المنع الفعلي في سياسات RLS.
 */
/**
 * شجرة المسارات كبيانات — مصدَّرة ليفحصها الاختبار مباشرةً بدل قراءة
 * الملف نصًّا: ما يُفحص هو ما يعمل فعلًا لا ما يبدو في المصدر.
 */
export const routeTree = [
  { path: "/login", element: <LoginPage /> },
  {
    element: <ProtectedRoute />,
    children: [
      {
        path: "/",
        element: <AppShell />,
        children: [
          { index: true, element: <DashboardPage /> },
          // {
          //   // فحص التأسيس أداة تشخيص لا شاشة عمل — خلف صلاحية الإعدادات
          //   element: <ProtectedRoute permission={screenPermission("/setup")} />,
          //   children: [{ path: "setup", element: <SetupCheckPage /> }],
          // },
          { path: "projects", element: <ProjectsPage /> },
          {
            element: <ProtectedRoute permission={screenPermission("/settings")} />,
            children: [{ path: "settings", element: <SettingsPage /> }],
          },
          {
            element: <ProtectedRoute permission={screenPermission("/users")} />,
            children: [{ path: "users", element: <UsersPage /> }],
          },
          {
            element: <ProtectedRoute permission={screenPermission("/roles")} />,
            children: [{ path: "roles", element: <RolesPage /> }],
          },
          {
            element: <ProtectedRoute permission={screenPermission("/items")} />,
            children: [{ path: "items", element: <ItemsPage /> }],
          },
          {
            element: <ProtectedRoute permission={screenPermission("/boq")} />,
            children: [{ path: "boq", element: <BoqPage /> }],
          },
          {
            element: <ProtectedRoute permission={screenPermission("/accounts")} />,
            children: [{ path: "accounts", element: <AccountsPage /> }],
          },
          {
            element: <ProtectedRoute permission={screenPermission("/journal")} />,
            children: [{ path: "journal", element: <JournalPage /> }],
          },
          {
            element: (
              <ProtectedRoute permission={screenPermission("/opening-balances")} />
            ),
            children: [{ path: "opening-balances", element: <OpeningBalancesPage /> }],
          },
          {
            element: <ProtectedRoute permission={screenPermission("/suppliers")} />,
            children: [{ path: "suppliers", element: <SuppliersPage /> }],
          },
          {
            element: (
              <ProtectedRoute permission={screenPermission("/material-requests")} />
            ),
            children: [
              { path: "material-requests", element: <MaterialRequestsPage /> },
            ],
          },
          {
            element: (
              <ProtectedRoute permission={screenPermission("/purchase-requests")} />
            ),
            children: [
              { path: "purchase-requests", element: <PurchaseRequestsPage /> },
            ],
          },
          {
            element: <ProtectedRoute permission={screenPermission("/supply-orders")} />,
            children: [{ path: "supply-orders", element: <SupplyOrdersPage /> }],
          },
          {
            element: <ProtectedRoute permission={screenPermission("/receipts")} />,
            children: [{ path: "receipts", element: <ReceiptsPage /> }],
          },
          {
            element: <ProtectedRoute permission={screenPermission("/payments")} />,
            children: [{ path: "payments", element: <PaymentsPage /> }],
          },
          {
            element: (
              <ProtectedRoute permission={screenPermission("/transfer-notes")} />
            ),
            children: [{ path: "transfer-notes", element: <TransferNotesPage /> }],
          },
          {
            element: <ProtectedRoute permission={screenPermission("/inbox")} />,
            children: [
              { path: "inbox", element: <InboxPage /> },
              { path: "transactions/:id", element: <TransactionDetailPage /> },
            ],
          },
          {
            element: <ProtectedRoute permission={screenPermission("/workflow")} />,
            children: [{ path: "workflow", element: <WorkflowAdminPage /> }],
          },
          {
            element: <ProtectedRoute permission={screenPermission("/work-calendar")} />,
            children: [{ path: "work-calendar", element: <WorkCalendarPage /> }],
          },
          {
            element: <ProtectedRoute permission={screenPermission("/evaluation")} />,
            children: [{ path: "evaluation", element: <EvaluationPage /> }],
          },
          {
            element: <ProtectedRoute permission={screenPermission("/facilities")} />,
            children: [{ path: "facilities", element: <FacilitiesPage /> }],
          },
          {
            element: <ProtectedRoute permission={screenPermission("/custody")} />,
            children: [{ path: "custody", element: <MandoubStockPage /> }],
          },
          {
            // تنزيل الكميات صلاحيته أضيق من قراءة المخازن — كان مجموعًا
            // معها فيفتح لمن لا يملكه
            element: <ProtectedRoute permission={screenPermission("/consumption")} />,
            children: [{ path: "consumption", element: <ConsumptionPage /> }],
          },
          {
            element: <ProtectedRoute permission={screenPermission("/surplus")} />,
            children: [{ path: "surplus", element: <SurplusPage /> }],
          },
          {
            element: <ProtectedRoute permission={screenPermission("/equipment")} />,
            children: [{ path: "equipment", element: <EquipmentPage /> }],
          },
          {
            element: (
              <ProtectedRoute permission={screenPermission("/warehouse-reports")} />
            ),
            children: [
              { path: "warehouse-reports", element: <WarehouseReportsPage /> },
            ],
          },
          {
            element: <ProtectedRoute permission={screenPermission("/contractors")} />,
            children: [{ path: "contractors", element: <ContractorsPage /> }],
          },
          {
            element: <ProtectedRoute permission={screenPermission("/extracts")} />,
            children: [{ path: "extracts", element: <ExtractsPage /> }],
          },
          {
            element: <ProtectedRoute permission={screenPermission("/custodies")} />,
            children: [{ path: "custodies", element: <CustodiesPage /> }],
          },
          {
            element: <ProtectedRoute permission={screenPermission("/advances")} />,
            children: [{ path: "advances", element: <AdvancesPage /> }],
          },
          {
            element: <ProtectedRoute permission={screenPermission("/guarantees")} />,
            children: [{ path: "guarantees", element: <GuaranteesPage /> }],
          },
          {
            element: <ProtectedRoute permission={screenPermission("/deductions")} />,
            children: [{ path: "deductions", element: <DeductionsPage /> }],
          },
          {
            element: <ProtectedRoute permission={screenPermission("/workers")} />,
            children: [{ path: "workers", element: <WorkersPage /> }],
          },
          {
            element: <ProtectedRoute permission={screenPermission("/labor-pool")} />,
            children: [{ path: "labor-pool", element: <LaborPoolPage /> }],
          },
          {
            element: <ProtectedRoute permission={screenPermission("/attendance")} />,
            children: [{ path: "attendance", element: <AttendancePage /> }],
          },
          {
            // ترحيل كشف البنك يمسّ الرواتب — صلاحيته غير صلاحية اليوميات
            element: <ProtectedRoute permission={screenPermission("/payroll")} />,
            children: [{ path: "payroll", element: <PayrollPage /> }],
          },
          {
            element: <ProtectedRoute permission={screenPermission("/loans")} />,
            children: [{ path: "loans", element: <LoansPage /> }],
          },
          {
            element: <ProtectedRoute permission={screenPermission("/reports")} />,
            children: [{ path: "reports", element: <ReportsPage /> }],
          },
          // الخدمة الذاتية بلا صلاحية: كل مستخدم نشط يرى ما يخصّه [7]
          { path: "me", element: <SelfServicePage /> },
          { path: "*", element: <Navigate to="/" replace /> },
        ],
      },
    ],
  },
] satisfies RouteObject[];

export const router = createBrowserRouter(routeTree);
