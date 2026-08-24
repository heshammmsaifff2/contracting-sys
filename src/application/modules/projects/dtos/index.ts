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
  /** عدد الموظفين المعتمدين على المشروع. */
  assigneeCount: number;
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

export interface ProjectAssignmentDto {
  id: string;
  projectId: string;
  userId: string;
  userName: string;
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
  userId: string;
  canSign: boolean;
}
