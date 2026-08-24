/**
 * Composition Root — المكان الوحيد الذي تُربط فيه المنافذ بتحقيقاتها.
 * الواجهة تسحب الـ use-cases من هنا عبر DIProvider ولا تُنشئ شيئًا بنفسها،
 * ما يجعل الاستبدال (in-memory ⇄ Supabase) والاختبار سهلين.
 */
import type { IClock } from "@application/shared/ports/clock";
import type { IFileStorage } from "@application/shared/ports/file-storage";
import type { IIdGenerator } from "@application/shared/ports/id-generator";
import { GetSystemInfo } from "@application/modules/platform/use-cases/GetSystemInfo";
import { RequestUploadTicket } from "@application/modules/platform/use-cases/RequestUploadTicket";
import { UploadFile } from "@application/modules/platform/use-cases/UploadFile";
import {
  GetDemoDataStatus,
  SeedDemoData,
  ClearDemoData,
} from "@application/modules/platform/use-cases/ManageDemoData";

import type { IAuthService } from "@application/modules/identity/ports/auth-service";
import { SignIn } from "@application/modules/identity/use-cases/SignIn";
import { SignOut } from "@application/modules/identity/use-cases/SignOut";
import { GetCurrentUser } from "@application/modules/identity/use-cases/GetCurrentUser";
import { ListProfiles } from "@application/modules/identity/use-cases/ListProfiles";
import { UpdateProfile } from "@application/modules/identity/use-cases/UpdateProfile";
import { SetProfileActive } from "@application/modules/identity/use-cases/SetProfileActive";
import { CreateUser } from "@application/modules/identity/use-cases/CreateUser";
import { ListRoles } from "@application/modules/identity/use-cases/ListRoles";
import { ListPermissions } from "@application/modules/identity/use-cases/ListPermissions";
import { SetRolePermissions } from "@application/modules/identity/use-cases/SetRolePermissions";
import { AssignRoleToUser } from "@application/modules/identity/use-cases/AssignRoleToUser";
import { RemoveRoleFromUser } from "@application/modules/identity/use-cases/RemoveRoleFromUser";

import { ListProjects } from "@application/modules/projects/use-cases/ListProjects";
import { CreateProject } from "@application/modules/projects/use-cases/CreateProject";
import { UpdateProject } from "@application/modules/projects/use-cases/UpdateProject";
import { DeleteProject } from "@application/modules/projects/use-cases/DeleteProject";
import { ListProjectAssignments } from "@application/modules/projects/use-cases/ListProjectAssignments";
import { ListProjectMembers } from "@application/modules/projects/use-cases/ListProjectMembers";
import { AssignUserToProject } from "@application/modules/projects/use-cases/AssignUserToProject";
import { SetAssignmentCanSign } from "@application/modules/projects/use-cases/SetAssignmentCanSign";
import { RemoveProjectAssignment } from "@application/modules/projects/use-cases/RemoveProjectAssignment";

import { SearchItems } from "@application/modules/catalog/use-cases/SearchItems";
import { CreateItem } from "@application/modules/catalog/use-cases/CreateItem";
import { UpdateItem } from "@application/modules/catalog/use-cases/UpdateItem";
import { DeleteItem } from "@application/modules/catalog/use-cases/DeleteItem";
import { SearchBoqItems } from "@application/modules/catalog/use-cases/SearchBoqItems";
import { CreateBoqItem } from "@application/modules/catalog/use-cases/CreateBoqItem";
import { UpdateBoqItem } from "@application/modules/catalog/use-cases/UpdateBoqItem";
import { ListBoqComponents } from "@application/modules/catalog/use-cases/ListBoqComponents";
import { SetBoqComponents } from "@application/modules/catalog/use-cases/SetBoqComponents";

import { ListAccounts } from "@application/modules/accounting/use-cases/ListAccounts";
import { ListPostingRules } from "@application/modules/accounting/use-cases/ListPostingRules";
import { ListJournalEntries } from "@application/modules/accounting/use-cases/ListJournalEntries";
import { ListOpeningBalances } from "@application/modules/accounting/use-cases/ListOpeningBalances";
import { CreateOpeningBalance } from "@application/modules/accounting/use-cases/CreateOpeningBalance";
import { ApproveOpeningBalance } from "@application/modules/accounting/use-cases/ApproveOpeningBalance";
import { DeleteOpeningBalance } from "@application/modules/accounting/use-cases/DeleteOpeningBalance";

import { SearchSuppliers } from "@application/modules/procurement/use-cases/SearchSuppliers";
import { SaveSupplier } from "@application/modules/procurement/use-cases/SaveSupplier";
import {
  ListSupplierBankAccounts,
  AddSupplierBankAccount,
  RemoveSupplierBankAccount,
} from "@application/modules/procurement/use-cases/ManageSupplierBankAccounts";
import {
  ListProjectItemLimits,
  SaveProjectItemLimit,
  SaveSiteStock,
} from "@application/modules/procurement/use-cases/ManageProjectItemLimits";
import {
  ListMaterialRequests,
  CreateMaterialRequest,
  ApproveMaterialRequest,
  RejectMaterialRequest,
  GetMaterialRequest,
} from "@application/modules/procurement/use-cases/ManageMaterialRequests";
import {
  GeneratePurchaseRequest,
  ListPurchaseRequests,
  SaveSupplierQuote,
  ComparePrices,
  GenerateSupplyOrder,
  ListSupplyOrders,
  ApproveSupplyOrder,
  GenerateReceiptRequests,
  ConfirmReceipt,
  GeneratePaymentRequest,
} from "@application/modules/procurement/use-cases/ProcurementChain";
import { ListReceiptRequests } from "@application/modules/procurement/use-cases/ListReceiptRequests";
import {
  ListPaymentRequests,
  TransferPayment,
} from "@application/modules/procurement/use-cases/ManagePayments";
import {
  ListTransferNotes,
  CreateTransferNote,
  ApproveTransferNote,
} from "@application/modules/procurement/use-cases/ManageTransferNotes";

import {
  ListInbox,
  GetTransaction,
  SearchTransactions,
  StartTransaction,
  CompleteStep,
  SetStepDuration,
  CloseTransaction,
  CancelTransaction,
  ListDurationChanges,
} from "@application/modules/workflow/use-cases/WorkflowUseCases";
import {
  ListWorkflowDefinitions,
  SaveWorkflowDefinition,
  SaveWorkflowStep,
  RemoveWorkflowStep,
  ListWorkSchedules,
  SaveWorkSchedule,
  RemoveWorkSchedule,
  ListHolidays,
  AddHoliday,
  RemoveHoliday,
  ListEvaluationSummary,
  ListEvaluationCriteria,
  SaveEvaluationScore,
  SetCriterionWeight,
} from "@application/modules/workflow/use-cases/WorkflowAdminUseCases";

import {
  ListFacilities,
  SaveFacility,
  RemoveFacility,
} from "@application/modules/warehouse/use-cases/ManageFacilities";
import {
  ListMandoubStock,
  ListStockMovements,
  IssueStockToMandoub,
  ReturnMandoubStock,
  ListConsumption,
  RecordFacilityConsumption,
} from "@application/modules/warehouse/use-cases/ManageStock";
import {
  ListEquipment,
  SaveEquipment,
  ListMaintenance,
  AddMaintenance,
  ListEquipmentMovements,
  MoveEquipment,
  ReleaseEquipment,
  ListIdleEquipment,
} from "@application/modules/warehouse/use-cases/ManageEquipment";
import {
  ListSurplusMaterials,
  SaveSurplusMaterial,
  RemoveSurplusMaterial,
} from "@application/modules/warehouse/use-cases/ManageSurplus";
import {
  GetWasteReport,
  GetProjectConsumption,
  GetSupervisorConsumption,
  GetConsumptionTrend,
} from "@application/modules/warehouse/use-cases/WarehouseReports";
import {
  ListNotifications,
  MarkNotificationsRead,
} from "@application/modules/platform/use-cases/ManageNotifications";

import {
  SearchContractors,
  SaveContractor,
  ListContractItems,
  SaveContractItem,
  RemoveContractItem,
  GetContractorBalances,
} from "@application/modules/accounting/use-cases/ManageContractors";
import {
  ListExtracts,
  GetExtract,
  GenerateExtract,
  SetExtractLineQty,
  SetExtractFinal,
  SetExtractNotes,
  ApproveExtract,
} from "@application/modules/accounting/use-cases/ManageExtracts";
import {
  ListCustodies,
  GetCustody,
  SaveCustody,
  SaveCustodyInvoice,
  RemoveCustodyInvoice,
  RescanCustodyDuplicates,
  ReviewDuplicateInvoice,
  ReturnCustodyInvoice,
  ApproveCustody,
} from "@application/modules/accounting/use-cases/ManageCustodies";
import {
  ListAdvances,
  SaveAdvance,
  ApproveAdvance,
  ListGuarantees,
  SaveGuarantee,
  RemoveGuarantee,
  ListDeductionTypes,
  SaveDeductionType,
} from "@application/modules/accounting/use-cases/ManageFinanceExtras";
import { ReadInvoiceImage } from "@application/modules/accounting/use-cases/ReadInvoiceImage";

import {
  SuggestAttendance,
  ListAttendance,
  RegisterAttendance,
  GetAttendanceSettings,
  GetLaborDays,
  GetLaborCost,
} from "@application/modules/hr/use-cases/ManageAttendance";
import {
  SearchWorkers,
  ListWorkerPool,
  SaveWorker,
  SetWorkerStatus,
  ListLoans,
  RequestLoan,
  WithdrawLoan,
  DecideLoan,
  GetSalaryHistory,
  ChangeSalary,
  ListProductionRatings,
  RateProduction,
  ListRecommendations,
  AddRecommendation,
  ImportBankStatement,
} from "@application/modules/hr/use-cases/ManageWorkers";

import {
  GetProjectCostReport,
  GetPartyBalances,
  GetManualEntriesReport,
  GetArchivePendingReport,
  GetDurationChangeReport,
  GetOverdueTransactionsReport,
  GetDepartmentFrequencyReport,
} from "@application/modules/reports/use-cases/CrossModuleReports";

import { GetAppSettings } from "@application/modules/settings/use-cases/GetAppSettings";
import { ListSettings } from "@application/modules/settings/use-cases/ListSettings";
import { UpdateSetting } from "@application/modules/settings/use-cases/UpdateSetting";

import { env } from "@config/env";
import { CURRENT_PHASE, MODULES } from "@config/app";
import { supabase, type AppSupabaseClient } from "../supabase/client";
import { CloudinaryFileStorage } from "../services/CloudinaryFileStorage";
import { CryptoIdGenerator } from "../services/CryptoIdGenerator";
import { EdgeFnClient } from "../services/EdgeFnClient";
import { EdgeUserAdminService } from "../services/EdgeUserAdminService";
import { SupabaseAuthService } from "../services/SupabaseAuthService";
import { SystemClock } from "../services/SystemClock";
import { InMemorySystemInfoRepository } from "../repositories/in-memory/InMemorySystemInfoRepository";
import { SupabaseAuthorizationRepository } from "../supabase/repositories/SupabaseAuthorizationRepository";
import { SupabaseProfileRepository } from "../supabase/repositories/SupabaseProfileRepository";
import { SupabaseProjectAssignmentRepository } from "../supabase/repositories/SupabaseProjectAssignmentRepository";
import { SupabaseProjectRepository } from "../supabase/repositories/SupabaseProjectRepository";
import { SupabaseRoleRepository } from "../supabase/repositories/SupabaseRoleRepository";
import { SupabaseSettingsRepository } from "../supabase/repositories/SupabaseSettingsRepository";
import { SupabaseItemRepository } from "../supabase/repositories/SupabaseItemRepository";
import { SupabaseBoqRepository } from "../supabase/repositories/SupabaseBoqRepository";
import { SupabaseAccountRepository } from "../supabase/repositories/SupabaseAccountRepository";
import { SupabaseJournalRepository } from "../supabase/repositories/SupabaseJournalRepository";
import { SupabaseOpeningBalanceRepository } from "../supabase/repositories/SupabaseOpeningBalanceRepository";
import { EdgeAccountingPoster } from "../services/EdgeAccountingPoster";
import { SupabaseSupplierRepository } from "../supabase/repositories/SupabaseSupplierRepository";
import { SupabaseMaterialRequestRepository } from "../supabase/repositories/SupabaseMaterialRequestRepository";
import { SupabasePurchaseRepository } from "../supabase/repositories/SupabasePurchaseRepository";
import { SupabaseReceiptRepository } from "../supabase/repositories/SupabaseReceiptRepository";
import { SupabasePaymentRepository } from "../supabase/repositories/SupabasePaymentRepository";
import { SupabaseTransferNoteRepository } from "../supabase/repositories/SupabaseTransferNoteRepository";
import { SupabaseProcurementWorkflow } from "../supabase/SupabaseProcurementWorkflow";
import { SupabaseInboxRepository } from "../supabase/repositories/SupabaseInboxRepository";
import { SupabaseWorkflowDefinitionRepository } from "../supabase/repositories/SupabaseWorkflowDefinitionRepository";
import { SupabaseWorkCalendarRepository } from "../supabase/repositories/SupabaseWorkCalendarRepository";
import { SupabaseEvaluationRepository } from "../supabase/repositories/SupabaseEvaluationRepository";
import { SupabaseWorkflowEngine } from "../supabase/SupabaseWorkflowEngine";
import { SupabaseFacilityRepository } from "../supabase/repositories/SupabaseFacilityRepository";
import { SupabaseStockRepository } from "../supabase/repositories/SupabaseStockRepository";
import { SupabaseEquipmentRepository } from "../supabase/repositories/SupabaseEquipmentRepository";
import { SupabaseSurplusRepository } from "../supabase/repositories/SupabaseSurplusRepository";
import { SupabaseWarehouseReportRepository } from "../supabase/repositories/SupabaseWarehouseReportRepository";
import { SupabaseDemoDataRepository } from "../supabase/repositories/SupabaseDemoDataRepository";
import { SupabaseReportRepository } from "../supabase/repositories/SupabaseReportRepository";
import { SupabaseNotificationRepository } from "../supabase/repositories/SupabaseNotificationRepository";
import { SupabaseContractorRepository } from "../supabase/repositories/SupabaseContractorRepository";
import { SupabaseExtractRepository } from "../supabase/repositories/SupabaseExtractRepository";
import { SupabaseCustodyRepository } from "../supabase/repositories/SupabaseCustodyRepository";
import {
  SupabaseAdvanceRepository,
  SupabaseGuaranteeRepository,
  SupabaseDeductionRepository,
} from "../supabase/repositories/SupabaseFinanceExtrasRepository";
import { TesseractOcrReader } from "../services/TesseractOcrReader";
import { SupabaseWorkerRepository } from "../supabase/repositories/SupabaseWorkerRepository";
import { SupabaseAttendanceRepository } from "../supabase/repositories/SupabaseAttendanceRepository";
import {
  SupabaseLoanRepository,
  SupabaseWorkerFileRepository,
} from "../supabase/repositories/SupabaseHrFileRepository";
import { EdgePayrollImporter } from "../services/EdgePayrollImporter";

/** كل ما تستهلكه طبقة العرض. لا تُضاف هنا إلا use-cases وخدمات مجرّدة. */
export interface Container {
  readonly clock: IClock;
  readonly idGenerator: IIdGenerator;
  readonly fileStorage: IFileStorage;
  /** يُستخدم للاشتراك في تغيّر الجلسة فقط — لا لعمليات أعمال. */
  readonly authService: IAuthService;
  readonly useCases: {
    // منصّة
    readonly getSystemInfo: GetSystemInfo;
    readonly requestUploadTicket: RequestUploadTicket;
    readonly uploadFile: UploadFile;
    // الهوية والصلاحيات
    readonly signIn: SignIn;
    readonly signOut: SignOut;
    readonly getCurrentUser: GetCurrentUser;
    readonly listProfiles: ListProfiles;
    readonly updateProfile: UpdateProfile;
    readonly setProfileActive: SetProfileActive;
    readonly createUser: CreateUser;
    readonly listRoles: ListRoles;
    readonly listPermissions: ListPermissions;
    readonly setRolePermissions: SetRolePermissions;
    readonly assignRoleToUser: AssignRoleToUser;
    readonly removeRoleFromUser: RemoveRoleFromUser;
    // المشاريع
    readonly listProjects: ListProjects;
    readonly createProject: CreateProject;
    readonly updateProject: UpdateProject;
    readonly deleteProject: DeleteProject;
    readonly listProjectAssignments: ListProjectAssignments;
    readonly listProjectMembers: ListProjectMembers;
    readonly assignUserToProject: AssignUserToProject;
    readonly setAssignmentCanSign: SetAssignmentCanSign;
    readonly removeProjectAssignment: RemoveProjectAssignment;
    // الأصناف والبنود
    readonly searchItems: SearchItems;
    readonly createItem: CreateItem;
    readonly updateItem: UpdateItem;
    readonly deleteItem: DeleteItem;
    readonly searchBoqItems: SearchBoqItems;
    readonly createBoqItem: CreateBoqItem;
    readonly updateBoqItem: UpdateBoqItem;
    readonly listBoqComponents: ListBoqComponents;
    readonly setBoqComponents: SetBoqComponents;
    // المحاسبة
    readonly listAccounts: ListAccounts;
    readonly listPostingRules: ListPostingRules;
    readonly listJournalEntries: ListJournalEntries;
    readonly listOpeningBalances: ListOpeningBalances;
    readonly createOpeningBalance: CreateOpeningBalance;
    readonly approveOpeningBalance: ApproveOpeningBalance;
    readonly deleteOpeningBalance: DeleteOpeningBalance;
    // المشتريات
    readonly searchSuppliers: SearchSuppliers;
    readonly saveSupplier: SaveSupplier;
    readonly listSupplierBankAccounts: ListSupplierBankAccounts;
    readonly addSupplierBankAccount: AddSupplierBankAccount;
    readonly removeSupplierBankAccount: RemoveSupplierBankAccount;
    readonly listProjectItemLimits: ListProjectItemLimits;
    readonly saveProjectItemLimit: SaveProjectItemLimit;
    readonly saveSiteStock: SaveSiteStock;
    readonly listMaterialRequests: ListMaterialRequests;
    readonly createMaterialRequest: CreateMaterialRequest;
    readonly approveMaterialRequest: ApproveMaterialRequest;
    readonly rejectMaterialRequest: RejectMaterialRequest;
    readonly getMaterialRequest: GetMaterialRequest;
    readonly generatePurchaseRequest: GeneratePurchaseRequest;
    readonly listPurchaseRequests: ListPurchaseRequests;
    readonly saveSupplierQuote: SaveSupplierQuote;
    readonly comparePrices: ComparePrices;
    readonly generateSupplyOrder: GenerateSupplyOrder;
    readonly listSupplyOrders: ListSupplyOrders;
    readonly approveSupplyOrder: ApproveSupplyOrder;
    readonly generateReceiptRequests: GenerateReceiptRequests;
    readonly listReceiptRequests: ListReceiptRequests;
    readonly confirmReceipt: ConfirmReceipt;
    readonly generatePaymentRequest: GeneratePaymentRequest;
    readonly listPaymentRequests: ListPaymentRequests;
    readonly transferPayment: TransferPayment;
    readonly listTransferNotes: ListTransferNotes;
    readonly createTransferNote: CreateTransferNote;
    readonly approveTransferNote: ApproveTransferNote;
    // سير العمل والمراسلات
    readonly listInbox: ListInbox;
    readonly getTransaction: GetTransaction;
    readonly searchTransactions: SearchTransactions;
    readonly startTransaction: StartTransaction;
    readonly completeStep: CompleteStep;
    readonly setStepDuration: SetStepDuration;
    readonly closeTransaction: CloseTransaction;
    readonly cancelTransaction: CancelTransaction;
    readonly listDurationChanges: ListDurationChanges;
    readonly listWorkflowDefinitions: ListWorkflowDefinitions;
    readonly saveWorkflowDefinition: SaveWorkflowDefinition;
    readonly saveWorkflowStep: SaveWorkflowStep;
    readonly removeWorkflowStep: RemoveWorkflowStep;
    readonly listWorkSchedules: ListWorkSchedules;
    readonly saveWorkSchedule: SaveWorkSchedule;
    readonly removeWorkSchedule: RemoveWorkSchedule;
    readonly listHolidays: ListHolidays;
    readonly addHoliday: AddHoliday;
    readonly removeHoliday: RemoveHoliday;
    readonly listEvaluationSummary: ListEvaluationSummary;
    readonly listEvaluationCriteria: ListEvaluationCriteria;
    readonly saveEvaluationScore: SaveEvaluationScore;
    readonly setCriterionWeight: SetCriterionWeight;
    // المخازن
    readonly listFacilities: ListFacilities;
    readonly saveFacility: SaveFacility;
    readonly removeFacility: RemoveFacility;
    readonly listMandoubStock: ListMandoubStock;
    readonly listStockMovements: ListStockMovements;
    readonly issueStockToMandoub: IssueStockToMandoub;
    readonly returnMandoubStock: ReturnMandoubStock;
    readonly listConsumption: ListConsumption;
    readonly recordFacilityConsumption: RecordFacilityConsumption;
    readonly listEquipment: ListEquipment;
    readonly saveEquipment: SaveEquipment;
    readonly listMaintenance: ListMaintenance;
    readonly addMaintenance: AddMaintenance;
    readonly listEquipmentMovements: ListEquipmentMovements;
    readonly moveEquipment: MoveEquipment;
    readonly releaseEquipment: ReleaseEquipment;
    readonly listIdleEquipment: ListIdleEquipment;
    readonly listSurplusMaterials: ListSurplusMaterials;
    readonly saveSurplusMaterial: SaveSurplusMaterial;
    readonly removeSurplusMaterial: RemoveSurplusMaterial;
    readonly getWasteReport: GetWasteReport;
    readonly getProjectConsumption: GetProjectConsumption;
    readonly getSupervisorConsumption: GetSupervisorConsumption;
    readonly getConsumptionTrend: GetConsumptionTrend;

    // التقارير الشاملة العابرة للوحدات [Phase 8]
    readonly getProjectCostReport: GetProjectCostReport;
    readonly getPartyBalances: GetPartyBalances;
    readonly getManualEntriesReport: GetManualEntriesReport;
    readonly getArchivePendingReport: GetArchivePendingReport;
    readonly getDurationChangeReport: GetDurationChangeReport;
    readonly getOverdueTransactionsReport: GetOverdueTransactionsReport;
    readonly getDepartmentFrequencyReport: GetDepartmentFrequencyReport;

    // النسخة الاختبارية [الحسابات 1]
    readonly getDemoDataStatus: GetDemoDataStatus;
    readonly seedDemoData: SeedDemoData;
    readonly clearDemoData: ClearDemoData;
    // الإشعارات
    readonly listNotifications: ListNotifications;
    readonly markNotificationsRead: MarkNotificationsRead;
    // الحسابات المتقدّمة: المستخلصات والعهد
    readonly searchContractors: SearchContractors;
    readonly saveContractor: SaveContractor;
    readonly listContractItems: ListContractItems;
    readonly saveContractItem: SaveContractItem;
    readonly removeContractItem: RemoveContractItem;
    readonly getContractorBalances: GetContractorBalances;
    readonly listExtracts: ListExtracts;
    readonly getExtract: GetExtract;
    readonly generateExtract: GenerateExtract;
    readonly setExtractLineQty: SetExtractLineQty;
    readonly setExtractFinal: SetExtractFinal;
    readonly setExtractNotes: SetExtractNotes;
    readonly approveExtract: ApproveExtract;
    readonly listCustodies: ListCustodies;
    readonly getCustody: GetCustody;
    readonly saveCustody: SaveCustody;
    readonly saveCustodyInvoice: SaveCustodyInvoice;
    readonly removeCustodyInvoice: RemoveCustodyInvoice;
    readonly rescanCustodyDuplicates: RescanCustodyDuplicates;
    readonly reviewDuplicateInvoice: ReviewDuplicateInvoice;
    readonly returnCustodyInvoice: ReturnCustodyInvoice;
    readonly approveCustody: ApproveCustody;
    readonly readInvoiceImage: ReadInvoiceImage;
    readonly listAdvances: ListAdvances;
    readonly saveAdvance: SaveAdvance;
    readonly approveAdvance: ApproveAdvance;
    readonly listGuarantees: ListGuarantees;
    readonly saveGuarantee: SaveGuarantee;
    readonly removeGuarantee: RemoveGuarantee;
    readonly listDeductionTypes: ListDeductionTypes;
    readonly saveDeductionType: SaveDeductionType;
    // شؤون الموظفين
    readonly searchWorkers: SearchWorkers;
    readonly listWorkerPool: ListWorkerPool;
    readonly saveWorker: SaveWorker;
    readonly setWorkerStatus: SetWorkerStatus;
    readonly suggestAttendance: SuggestAttendance;
    readonly listAttendance: ListAttendance;
    readonly registerAttendance: RegisterAttendance;
    readonly getAttendanceSettings: GetAttendanceSettings;
    readonly getLaborDays: GetLaborDays;
    readonly getLaborCost: GetLaborCost;
    readonly listLoans: ListLoans;
    readonly requestLoan: RequestLoan;
    readonly withdrawLoan: WithdrawLoan;
    readonly decideLoan: DecideLoan;
    readonly getSalaryHistory: GetSalaryHistory;
    readonly changeSalary: ChangeSalary;
    readonly listProductionRatings: ListProductionRatings;
    readonly rateProduction: RateProduction;
    readonly listRecommendations: ListRecommendations;
    readonly addRecommendation: AddRecommendation;
    readonly importBankStatement: ImportBankStatement;
    // الإعدادات
    readonly getAppSettings: GetAppSettings;
    readonly listSettings: ListSettings;
    readonly updateSetting: UpdateSetting;
  };
}

export interface ContainerOverrides {
  clock?: IClock;
  idGenerator?: IIdGenerator;
  fileStorage?: IFileStorage;
  supabaseClient?: AppSupabaseClient;
}

/**
 * Build the application container.
 * Overrides let tests swap any port without touching the wiring.
 */
export function createContainer(overrides: ContainerOverrides = {}): Container {
  const client = overrides.supabaseClient ?? supabase;
  const edgeFn = new EdgeFnClient(client);

  const clock = overrides.clock ?? new SystemClock();
  const idGenerator = overrides.idGenerator ?? new CryptoIdGenerator();
  const fileStorage =
    overrides.fileStorage ??
    new CloudinaryFileStorage(edgeFn, env.VITE_CLOUDINARY_CLOUD_NAME);

  // ── Adapters ─────────────────────────────────────────────────────────
  const authService = new SupabaseAuthService(client);
  const userAdminService = new EdgeUserAdminService(edgeFn);
  const profileRepository = new SupabaseProfileRepository(client);
  const roleRepository = new SupabaseRoleRepository(client);
  const authorizationRepository = new SupabaseAuthorizationRepository(client);
  const projectRepository = new SupabaseProjectRepository(client);
  const assignmentRepository = new SupabaseProjectAssignmentRepository(client);
  const settingsRepository = new SupabaseSettingsRepository(client);
  const itemRepository = new SupabaseItemRepository(client);
  const boqRepository = new SupabaseBoqRepository(client);
  const accountRepository = new SupabaseAccountRepository(client);
  const journalRepository = new SupabaseJournalRepository(client);
  const openingBalanceRepository = new SupabaseOpeningBalanceRepository(client);
  const accountingPoster = new EdgeAccountingPoster(edgeFn);
  const supplierRepository = new SupabaseSupplierRepository(client);
  const materialRequestRepository = new SupabaseMaterialRequestRepository(client);
  const purchaseRepository = new SupabasePurchaseRepository(client);
  const receiptRepository = new SupabaseReceiptRepository(client);
  const paymentRepository = new SupabasePaymentRepository(client);
  const transferNoteRepository = new SupabaseTransferNoteRepository(client);
  const procurementWorkflow = new SupabaseProcurementWorkflow(client);
  const inboxRepository = new SupabaseInboxRepository(client);
  const workflowEngine = new SupabaseWorkflowEngine(client);
  const workflowDefinitionRepository = new SupabaseWorkflowDefinitionRepository(client);
  const workCalendarRepository = new SupabaseWorkCalendarRepository(client);
  const evaluationRepository = new SupabaseEvaluationRepository(client);
  const facilityRepository = new SupabaseFacilityRepository(client);
  const stockRepository = new SupabaseStockRepository(client);
  const equipmentRepository = new SupabaseEquipmentRepository(client);
  const surplusRepository = new SupabaseSurplusRepository(client);
  const warehouseReportRepository = new SupabaseWarehouseReportRepository(client);
  const demoDataRepository = new SupabaseDemoDataRepository(client);
  const reportRepository = new SupabaseReportRepository(client);
  const notificationRepository = new SupabaseNotificationRepository(client);
  const contractorRepository = new SupabaseContractorRepository(client);
  const extractRepository = new SupabaseExtractRepository(client);
  const custodyRepository = new SupabaseCustodyRepository(client);
  const advanceRepository = new SupabaseAdvanceRepository(client);
  const guaranteeRepository = new SupabaseGuaranteeRepository(client);
  const deductionRepository = new SupabaseDeductionRepository(client);
  const ocrReader = new TesseractOcrReader();
  const workerRepository = new SupabaseWorkerRepository(client);
  const attendanceRepository = new SupabaseAttendanceRepository(client);
  const loanRepository = new SupabaseLoanRepository(client);
  const workerFileRepository = new SupabaseWorkerFileRepository(client);
  const payrollImporter = new EdgePayrollImporter(edgeFn);

  // حالة الوحدة تُشتقّ من مرحلتها مقارنةً بالمرحلة الحالية، لا تُكتب يدويًا:
  // القائمة الثابتة كانت تبقى على «مخطّط له» بعد أن تكتمل الوحدة فعلًا.
  const systemInfoRepository = new InMemorySystemInfoRepository(
    MODULES.map((m) => ({
      key: m.key,
      nameAr: m.nameAr,
      phase: m.phase,
      status: m.phase <= CURRENT_PHASE ? ("ready" as const) : ("planned" as const),
    })),
  );

  return {
    clock,
    idGenerator,
    fileStorage,
    authService,
    useCases: {
      getSystemInfo: new GetSystemInfo(systemInfoRepository, clock),
      requestUploadTicket: new RequestUploadTicket(fileStorage),
      uploadFile: new UploadFile(fileStorage),

      signIn: new SignIn(authService),
      signOut: new SignOut(authService),
      getCurrentUser: new GetCurrentUser(
        authService,
        profileRepository,
        authorizationRepository,
      ),
      listProfiles: new ListProfiles(profileRepository),
      updateProfile: new UpdateProfile(profileRepository),
      setProfileActive: new SetProfileActive(profileRepository),
      createUser: new CreateUser(userAdminService),
      listRoles: new ListRoles(roleRepository),
      listPermissions: new ListPermissions(roleRepository),
      setRolePermissions: new SetRolePermissions(roleRepository),
      assignRoleToUser: new AssignRoleToUser(roleRepository),
      removeRoleFromUser: new RemoveRoleFromUser(roleRepository),

      listProjects: new ListProjects(projectRepository),
      createProject: new CreateProject(projectRepository, idGenerator),
      updateProject: new UpdateProject(projectRepository),
      deleteProject: new DeleteProject(projectRepository),
      listProjectAssignments: new ListProjectAssignments(assignmentRepository),
      listProjectMembers: new ListProjectMembers(assignmentRepository),
      assignUserToProject: new AssignUserToProject(assignmentRepository),
      setAssignmentCanSign: new SetAssignmentCanSign(assignmentRepository),
      removeProjectAssignment: new RemoveProjectAssignment(assignmentRepository),

      searchItems: new SearchItems(itemRepository),
      createItem: new CreateItem(itemRepository, idGenerator),
      updateItem: new UpdateItem(itemRepository),
      deleteItem: new DeleteItem(itemRepository),
      searchBoqItems: new SearchBoqItems(boqRepository),
      createBoqItem: new CreateBoqItem(boqRepository, idGenerator),
      updateBoqItem: new UpdateBoqItem(boqRepository),
      listBoqComponents: new ListBoqComponents(boqRepository),
      setBoqComponents: new SetBoqComponents(boqRepository),

      listAccounts: new ListAccounts(accountRepository),
      listPostingRules: new ListPostingRules(accountRepository),
      listJournalEntries: new ListJournalEntries(journalRepository),
      listOpeningBalances: new ListOpeningBalances(openingBalanceRepository),
      createOpeningBalance: new CreateOpeningBalance(
        openingBalanceRepository,
        idGenerator,
      ),
      approveOpeningBalance: new ApproveOpeningBalance(
        openingBalanceRepository,
        accountingPoster,
      ),
      deleteOpeningBalance: new DeleteOpeningBalance(openingBalanceRepository),

      searchSuppliers: new SearchSuppliers(supplierRepository),
      saveSupplier: new SaveSupplier(supplierRepository, idGenerator),
      listSupplierBankAccounts: new ListSupplierBankAccounts(supplierRepository),
      addSupplierBankAccount: new AddSupplierBankAccount(supplierRepository),
      removeSupplierBankAccount: new RemoveSupplierBankAccount(supplierRepository),
      listProjectItemLimits: new ListProjectItemLimits(materialRequestRepository),
      saveProjectItemLimit: new SaveProjectItemLimit(materialRequestRepository),
      saveSiteStock: new SaveSiteStock(materialRequestRepository),
      listMaterialRequests: new ListMaterialRequests(materialRequestRepository),
      createMaterialRequest: new CreateMaterialRequest(materialRequestRepository),
      approveMaterialRequest: new ApproveMaterialRequest(materialRequestRepository),
      rejectMaterialRequest: new RejectMaterialRequest(materialRequestRepository),
      getMaterialRequest: new GetMaterialRequest(materialRequestRepository),
      generatePurchaseRequest: new GeneratePurchaseRequest(procurementWorkflow),
      listPurchaseRequests: new ListPurchaseRequests(purchaseRepository),
      saveSupplierQuote: new SaveSupplierQuote(purchaseRepository),
      comparePrices: new ComparePrices(purchaseRepository),
      generateSupplyOrder: new GenerateSupplyOrder(procurementWorkflow),
      listSupplyOrders: new ListSupplyOrders(purchaseRepository),
      approveSupplyOrder: new ApproveSupplyOrder(purchaseRepository),
      generateReceiptRequests: new GenerateReceiptRequests(procurementWorkflow),
      listReceiptRequests: new ListReceiptRequests(receiptRepository),
      confirmReceipt: new ConfirmReceipt(procurementWorkflow, accountingPoster),
      generatePaymentRequest: new GeneratePaymentRequest(procurementWorkflow),
      listPaymentRequests: new ListPaymentRequests(paymentRepository),
      transferPayment: new TransferPayment(paymentRepository, accountingPoster),
      listTransferNotes: new ListTransferNotes(transferNoteRepository),
      createTransferNote: new CreateTransferNote(transferNoteRepository),
      approveTransferNote: new ApproveTransferNote(
        transferNoteRepository,
        accountingPoster,
      ),

      listInbox: new ListInbox(inboxRepository),
      getTransaction: new GetTransaction(inboxRepository),
      searchTransactions: new SearchTransactions(inboxRepository),
      startTransaction: new StartTransaction(workflowEngine),
      completeStep: new CompleteStep(workflowEngine),
      setStepDuration: new SetStepDuration(workflowEngine),
      closeTransaction: new CloseTransaction(workflowEngine),
      cancelTransaction: new CancelTransaction(workflowEngine),
      listDurationChanges: new ListDurationChanges(workflowDefinitionRepository),
      listWorkflowDefinitions: new ListWorkflowDefinitions(
        workflowDefinitionRepository,
      ),
      saveWorkflowDefinition: new SaveWorkflowDefinition(workflowDefinitionRepository),
      saveWorkflowStep: new SaveWorkflowStep(workflowDefinitionRepository),
      removeWorkflowStep: new RemoveWorkflowStep(workflowDefinitionRepository),
      listWorkSchedules: new ListWorkSchedules(workCalendarRepository),
      saveWorkSchedule: new SaveWorkSchedule(workCalendarRepository),
      removeWorkSchedule: new RemoveWorkSchedule(workCalendarRepository),
      listHolidays: new ListHolidays(workCalendarRepository),
      addHoliday: new AddHoliday(workCalendarRepository),
      removeHoliday: new RemoveHoliday(workCalendarRepository),
      listEvaluationSummary: new ListEvaluationSummary(evaluationRepository),
      listEvaluationCriteria: new ListEvaluationCriteria(evaluationRepository),
      saveEvaluationScore: new SaveEvaluationScore(evaluationRepository),
      setCriterionWeight: new SetCriterionWeight(evaluationRepository),

      listFacilities: new ListFacilities(facilityRepository),
      saveFacility: new SaveFacility(facilityRepository),
      removeFacility: new RemoveFacility(facilityRepository),
      listMandoubStock: new ListMandoubStock(stockRepository),
      listStockMovements: new ListStockMovements(stockRepository),
      issueStockToMandoub: new IssueStockToMandoub(stockRepository),
      returnMandoubStock: new ReturnMandoubStock(stockRepository),
      listConsumption: new ListConsumption(stockRepository),
      recordFacilityConsumption: new RecordFacilityConsumption(stockRepository),
      listEquipment: new ListEquipment(equipmentRepository),
      saveEquipment: new SaveEquipment(equipmentRepository),
      listMaintenance: new ListMaintenance(equipmentRepository),
      addMaintenance: new AddMaintenance(equipmentRepository),
      listEquipmentMovements: new ListEquipmentMovements(equipmentRepository),
      moveEquipment: new MoveEquipment(equipmentRepository),
      releaseEquipment: new ReleaseEquipment(equipmentRepository),
      listIdleEquipment: new ListIdleEquipment(equipmentRepository),
      listSurplusMaterials: new ListSurplusMaterials(surplusRepository),
      saveSurplusMaterial: new SaveSurplusMaterial(surplusRepository),
      removeSurplusMaterial: new RemoveSurplusMaterial(surplusRepository),
      getWasteReport: new GetWasteReport(warehouseReportRepository),
      getProjectConsumption: new GetProjectConsumption(warehouseReportRepository),
      getSupervisorConsumption: new GetSupervisorConsumption(warehouseReportRepository),
      getConsumptionTrend: new GetConsumptionTrend(warehouseReportRepository),

      getProjectCostReport: new GetProjectCostReport(reportRepository),
      getPartyBalances: new GetPartyBalances(reportRepository),
      getManualEntriesReport: new GetManualEntriesReport(reportRepository),
      getArchivePendingReport: new GetArchivePendingReport(reportRepository),
      getDurationChangeReport: new GetDurationChangeReport(reportRepository),
      getOverdueTransactionsReport: new GetOverdueTransactionsReport(reportRepository),
      getDepartmentFrequencyReport: new GetDepartmentFrequencyReport(reportRepository),

      getDemoDataStatus: new GetDemoDataStatus(demoDataRepository),
      seedDemoData: new SeedDemoData(demoDataRepository),
      clearDemoData: new ClearDemoData(demoDataRepository),

      listNotifications: new ListNotifications(notificationRepository),
      markNotificationsRead: new MarkNotificationsRead(notificationRepository),

      searchContractors: new SearchContractors(contractorRepository),
      saveContractor: new SaveContractor(contractorRepository),
      listContractItems: new ListContractItems(contractorRepository),
      saveContractItem: new SaveContractItem(contractorRepository),
      removeContractItem: new RemoveContractItem(contractorRepository),
      getContractorBalances: new GetContractorBalances(contractorRepository),
      listExtracts: new ListExtracts(extractRepository),
      getExtract: new GetExtract(extractRepository),
      generateExtract: new GenerateExtract(extractRepository),
      setExtractLineQty: new SetExtractLineQty(extractRepository),
      setExtractFinal: new SetExtractFinal(extractRepository),
      setExtractNotes: new SetExtractNotes(extractRepository),
      approveExtract: new ApproveExtract(extractRepository, accountingPoster),
      listCustodies: new ListCustodies(custodyRepository),
      getCustody: new GetCustody(custodyRepository),
      saveCustody: new SaveCustody(custodyRepository),
      saveCustodyInvoice: new SaveCustodyInvoice(custodyRepository),
      removeCustodyInvoice: new RemoveCustodyInvoice(custodyRepository),
      rescanCustodyDuplicates: new RescanCustodyDuplicates(custodyRepository),
      reviewDuplicateInvoice: new ReviewDuplicateInvoice(custodyRepository),
      returnCustodyInvoice: new ReturnCustodyInvoice(custodyRepository),
      approveCustody: new ApproveCustody(custodyRepository, accountingPoster),
      readInvoiceImage: new ReadInvoiceImage(ocrReader),
      listAdvances: new ListAdvances(advanceRepository),
      saveAdvance: new SaveAdvance(advanceRepository),
      approveAdvance: new ApproveAdvance(advanceRepository, accountingPoster),
      listGuarantees: new ListGuarantees(guaranteeRepository),
      saveGuarantee: new SaveGuarantee(guaranteeRepository),
      removeGuarantee: new RemoveGuarantee(guaranteeRepository),
      listDeductionTypes: new ListDeductionTypes(deductionRepository),
      saveDeductionType: new SaveDeductionType(deductionRepository),

      searchWorkers: new SearchWorkers(workerRepository),
      listWorkerPool: new ListWorkerPool(workerRepository),
      saveWorker: new SaveWorker(workerRepository),
      setWorkerStatus: new SetWorkerStatus(workerRepository),
      suggestAttendance: new SuggestAttendance(attendanceRepository),
      listAttendance: new ListAttendance(attendanceRepository),
      registerAttendance: new RegisterAttendance(attendanceRepository),
      getAttendanceSettings: new GetAttendanceSettings(attendanceRepository),
      getLaborDays: new GetLaborDays(attendanceRepository),
      getLaborCost: new GetLaborCost(attendanceRepository),
      listLoans: new ListLoans(loanRepository),
      requestLoan: new RequestLoan(loanRepository),
      withdrawLoan: new WithdrawLoan(loanRepository),
      decideLoan: new DecideLoan(loanRepository),
      getSalaryHistory: new GetSalaryHistory(workerFileRepository),
      changeSalary: new ChangeSalary(workerFileRepository),
      listProductionRatings: new ListProductionRatings(workerFileRepository),
      rateProduction: new RateProduction(workerFileRepository),
      listRecommendations: new ListRecommendations(workerFileRepository),
      addRecommendation: new AddRecommendation(workerFileRepository),
      importBankStatement: new ImportBankStatement(payrollImporter),

      getAppSettings: new GetAppSettings(settingsRepository),
      listSettings: new ListSettings(settingsRepository),
      updateSetting: new UpdateSetting(settingsRepository),
    },
  };
}
