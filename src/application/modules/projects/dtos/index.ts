import type { ProjectStatus } from "@core/modules/projects/entities/Project";

export interface ProjectDto {
  id: string;
  code: string;
  name: string;
  ownerEntity: string | null;
  contractValue: number;
  receivedAt: string | null;
  managerId: string | null;
  managerName: string | null;
  extractsOfficerId: string | null;
  extractsOfficerName: string | null;
  status: ProjectStatus;
  /** عدد خانات الوظائف على المشروع. */
  assigneeCount: number;
  /** الوظائف وشاغلوها — «مدير مشروع: هاني». */
  jobSlots: readonly ProjectJobSlotDto[];
}

export interface ProjectJobSlotDto {
  jobName: string;
  /** null = شاغرة. */
  holderName: string | null;
}

export interface CreateProjectDto {
  code: string;
  name: string;
  ownerEntity: string | null;
  contractValue: number;
  receivedAt: string | null;
  managerId: string | null;
  extractsOfficerId: string | null;
  status: ProjectStatus;
}

export interface UpdateProjectDto extends CreateProjectDto {
  id: string;
}

/** خانة وظيفة على المشروع يملؤها أحد شاغلي الوظيفة. */
export interface ProjectAssignmentDto {
  id: string;
  projectId: string;
  jobId: string;
  jobName: string;
  departmentName: string | null;
  /** null = شاغرة. */
  userId: string | null;
  userName: string | null;
  userCode: string | null;
  canSign: boolean;
}

/** عضو مشروع — الاسم والفئة فقط، لاختيار المندوب أو المشرف بلا كشف دفتر الموظفين. */
export interface ProjectMemberDto {
  userId: string;
  projectId: string;
  fullName: string;
  employeeType: string;
  canSign: boolean;
}

export interface AssignUserToProjectDto {
  projectId: string;
  jobId: string;
  /** null = تُضاف شاغرة ويُختار شاغلها لاحقًا. */
  userId: string | null;
  canSign: boolean;
}
