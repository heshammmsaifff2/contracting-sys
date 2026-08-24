import { createBrowserRouter, Navigate } from "react-router-dom";
import { AppShell } from "@presentation/shared/layouts/AppShell";
import { ProtectedRoute } from "./ProtectedRoute";
import {
  UsersPage,
  RolesPage,
  ProjectsPage,
  SettingsPage,
  DashboardPage,
  SetupCheckPage,
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
export const router = createBrowserRouter([
  { path: "/login", element: <LoginPage /> },
  {
    element: <ProtectedRoute />,
    children: [
      {
        path: "/",
        element: <AppShell />,
        children: [
          { index: true, element: <DashboardPage /> },
          {
            // فحص التأسيس أداة تشخيص لا شاشة عمل — خلف صلاحية الإعدادات
            element: <ProtectedRoute permission="settings.manage" />,
            children: [{ path: "setup", element: <SetupCheckPage /> }],
          },
          { path: "projects", element: <ProjectsPage /> },
          { path: "settings", element: <SettingsPage /> },
          {
            element: <ProtectedRoute permission="user.read" />,
            children: [{ path: "users", element: <UsersPage /> }],
          },
          {
            element: <ProtectedRoute permission="role.read" />,
            children: [{ path: "roles", element: <RolesPage /> }],
          },
          {
            element: <ProtectedRoute permission="item.read" />,
            children: [{ path: "items", element: <ItemsPage /> }],
          },
          {
            element: <ProtectedRoute permission="boq.read" />,
            children: [{ path: "boq", element: <BoqPage /> }],
          },
          {
            element: <ProtectedRoute permission="account.read" />,
            children: [{ path: "accounts", element: <AccountsPage /> }],
          },
          {
            element: <ProtectedRoute permission="journal.read" />,
            children: [{ path: "journal", element: <JournalPage /> }],
          },
          {
            element: (
              <ProtectedRoute permission={["opening_balance.manage", "journal.read"]} />
            ),
            children: [{ path: "opening-balances", element: <OpeningBalancesPage /> }],
          },
          {
            element: <ProtectedRoute permission="supplier.read" />,
            children: [{ path: "suppliers", element: <SuppliersPage /> }],
          },
          {
            element: <ProtectedRoute permission="material_request.read" />,
            children: [
              { path: "material-requests", element: <MaterialRequestsPage /> },
            ],
          },
          {
            element: <ProtectedRoute permission="purchase.manage" />,
            children: [
              { path: "purchase-requests", element: <PurchaseRequestsPage /> },
            ],
          },
          {
            element: <ProtectedRoute permission="supply_order.manage" />,
            children: [{ path: "supply-orders", element: <SupplyOrdersPage /> }],
          },
          {
            element: <ProtectedRoute permission="receipt.confirm" />,
            children: [{ path: "receipts", element: <ReceiptsPage /> }],
          },
          {
            element: (
              <ProtectedRoute permission={["payment.manage", "payment.transfer"]} />
            ),
            children: [{ path: "payments", element: <PaymentsPage /> }],
          },
          {
            element: <ProtectedRoute permission="transfer_note.manage" />,
            children: [{ path: "transfer-notes", element: <TransferNotesPage /> }],
          },
          {
            element: <ProtectedRoute permission="transaction.read" />,
            children: [
              { path: "inbox", element: <InboxPage /> },
              { path: "transactions/:id", element: <TransactionDetailPage /> },
            ],
          },
          {
            element: <ProtectedRoute permission="workflow.manage" />,
            children: [{ path: "workflow", element: <WorkflowAdminPage /> }],
          },
          {
            element: <ProtectedRoute permission="work_calendar.manage" />,
            children: [{ path: "work-calendar", element: <WorkCalendarPage /> }],
          },
          {
            element: <ProtectedRoute permission="evaluation.read" />,
            children: [{ path: "evaluation", element: <EvaluationPage /> }],
          },
          {
            element: <ProtectedRoute permission="warehouse.read" />,
            children: [
              { path: "facilities", element: <FacilitiesPage /> },
              { path: "custody", element: <MandoubStockPage /> },
              { path: "consumption", element: <ConsumptionPage /> },
              { path: "surplus", element: <SurplusPage /> },
            ],
          },
          {
            element: <ProtectedRoute permission="equipment.read" />,
            children: [{ path: "equipment", element: <EquipmentPage /> }],
          },
          {
            element: <ProtectedRoute permission="warehouse.report" />,
            children: [
              { path: "warehouse-reports", element: <WarehouseReportsPage /> },
            ],
          },
          {
            element: <ProtectedRoute permission="contractor.read" />,
            children: [{ path: "contractors", element: <ContractorsPage /> }],
          },
          {
            element: <ProtectedRoute permission="extract.read" />,
            children: [{ path: "extracts", element: <ExtractsPage /> }],
          },
          {
            element: <ProtectedRoute permission="custody.read" />,
            children: [{ path: "custodies", element: <CustodiesPage /> }],
          },
          {
            element: <ProtectedRoute permission="advance.manage" />,
            children: [{ path: "advances", element: <AdvancesPage /> }],
          },
          {
            element: <ProtectedRoute permission="guarantee.manage" />,
            children: [{ path: "guarantees", element: <GuaranteesPage /> }],
          },
          {
            element: <ProtectedRoute permission="deduction.manage" />,
            children: [{ path: "deductions", element: <DeductionsPage /> }],
          },
          {
            element: <ProtectedRoute permission="worker.read" />,
            children: [
              { path: "workers", element: <WorkersPage /> },
              { path: "labor-pool", element: <LaborPoolPage /> },
            ],
          },
          {
            element: <ProtectedRoute permission="attendance.read" />,
            children: [
              { path: "attendance", element: <AttendancePage /> },
              { path: "payroll", element: <PayrollPage /> },
            ],
          },
          {
            element: <ProtectedRoute permission="loan.read" />,
            children: [{ path: "loans", element: <LoansPage /> }],
          },
          {
            element: (
              <ProtectedRoute permission={["report.read", "report.financial"]} />
            ),
            children: [{ path: "reports", element: <ReportsPage /> }],
          },
          // الخدمة الذاتية بلا صلاحية: كل مستخدم نشط يرى ما يخصّه [7]
          { path: "me", element: <SelfServicePage /> },
          { path: "*", element: <Navigate to="/" replace /> },
        ],
      },
    ],
  },
]);
