import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useUseCases } from "@presentation/app/providers/di-context";
import { useAppSettings } from "@presentation/app/providers/settings-context";
import { unwrap } from "@presentation/shared/lib/query";
import type {
  AssignUserToProjectDto,
  CreateProjectDto,
  UpdateProjectDto,
} from "@application/modules/projects/dtos";

export const PROJECTS_KEY = ["projects"] as const;
export const assignmentsKey = (projectId: string) =>
  ["project-assignments", projectId] as const;

/** RLS تُرجع المشاريع المعتمدة فقط — لا فلترة في الواجهة. */
export function useProjects() {
  const { listProjects } = useUseCases();
  return useQuery({
    queryKey: PROJECTS_KEY,
    queryFn: async () => unwrap(await listProjects.execute()),
  });
}

export function useCreateProject() {
  const { createProject } = useUseCases();
  const { currency } = useAppSettings();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: CreateProjectDto) =>
      unwrap(await createProject.execute({ ...input, currency })),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: PROJECTS_KEY }),
  });
}

export function useUpdateProject() {
  const { updateProject } = useUseCases();
  const { currency } = useAppSettings();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: UpdateProjectDto) =>
      unwrap(await updateProject.execute({ ...input, currency })),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: PROJECTS_KEY }),
  });
}

export function useDeleteProject() {
  const { deleteProject } = useUseCases();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => unwrap(await deleteProject.execute({ id })),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: PROJECTS_KEY }),
  });
}

/** أعضاء المشروع لاختيار المندوب/المشرف — بلا حاجة لصلاحية user.read. */
export function useProjectMembers(projectId: string | null) {
  const { listProjectMembers } = useUseCases();
  return useQuery({
    queryKey: ["project-members", projectId ?? "all"],
    queryFn: async () => unwrap(await listProjectMembers.execute({ projectId })),
  });
}

export function useProjectAssignments(projectId: string | null) {
  const { listProjectAssignments } = useUseCases();

  return useQuery({
    queryKey: assignmentsKey(projectId ?? ""),
    queryFn: async () =>
      unwrap(await listProjectAssignments.execute({ projectId: projectId ?? "" })),
    enabled: projectId !== null,
  });
}

export function useAssignUserToProject(projectId: string) {
  const { assignUserToProject } = useUseCases();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: AssignUserToProjectDto) =>
      unwrap(await assignUserToProject.execute(input)),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: assignmentsKey(projectId) });
      await queryClient.invalidateQueries({ queryKey: PROJECTS_KEY });
      // الاعتماد يغيّر المشاريع التي يراها المستخدم، فنُبطل صورته أيضًا
      await queryClient.invalidateQueries({ queryKey: ["current-user"] });
    },
  });
}

export function useSetAssignmentCanSign(projectId: string) {
  const { setAssignmentCanSign } = useUseCases();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: { id: string; canSign: boolean }) =>
      unwrap(await setAssignmentCanSign.execute(input)),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: assignmentsKey(projectId) }),
  });
}

export function useRemoveAssignment(projectId: string) {
  const { removeProjectAssignment } = useUseCases();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) =>
      unwrap(await removeProjectAssignment.execute({ id })),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: assignmentsKey(projectId) });
      await queryClient.invalidateQueries({ queryKey: PROJECTS_KEY });
      await queryClient.invalidateQueries({ queryKey: ["current-user"] });
    },
  });
}
