/**
 * Hooks المجدوِل.
 * المعاينة تُحسب في القاعدة بتوقيت الشركة ومواعيد دوامها، لا في المتصفّح.
 */
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useUseCases } from "@presentation/app/providers/di-context";
import { unwrap } from "@presentation/shared/lib/query";
import type {
  ScheduleKind,
  ScheduleSpec,
} from "@core/modules/workflow/entities/ScheduledTask";
import type { SaveScheduledTaskDto } from "@application/modules/workflow/dtos";

export const SCHEDULED_TASKS_KEY = ["scheduled-tasks"] as const;
export const TASK_RUNS_KEY = ["scheduled-task-runs"] as const;

export function useScheduledTasks() {
  const { listScheduledTasks } = useUseCases();

  return useQuery({
    queryKey: SCHEDULED_TASKS_KEY,
    queryFn: async () => unwrap(await listScheduledTasks.execute()),
  });
}

export function useSaveScheduledTask() {
  const { saveScheduledTask } = useUseCases();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: SaveScheduledTaskDto) =>
      unwrap(await saveScheduledTask.execute(input)),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: SCHEDULED_TASKS_KEY }),
  });
}

export function useRemoveScheduledTask() {
  const { removeScheduledTask } = useUseCases();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => unwrap(await removeScheduledTask.execute({ id })),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: SCHEDULED_TASKS_KEY }),
  });
}

/** تشغيل يدوي على الجمهور الحقيقي — ليس تجربة جافّة. */
export function useRunScheduledTaskNow() {
  const { runScheduledTaskNow } = useUseCases();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => unwrap(await runScheduledTaskNow.execute({ id })),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: SCHEDULED_TASKS_KEY });
      await queryClient.invalidateQueries({ queryKey: TASK_RUNS_KEY });
      await queryClient.invalidateQueries({ queryKey: ["inbox"] });
    },
  });
}

export function useScheduledTaskRuns(taskId: string | null) {
  const { listScheduledTaskRuns } = useUseCases();

  return useQuery({
    queryKey: [...TASK_RUNS_KEY, taskId ?? ""],
    queryFn: async () =>
      unwrap(await listScheduledTaskRuns.execute({ taskId: taskId ?? "" })),
    enabled: taskId !== null,
  });
}

export function useSchedulePreview(
  kind: ScheduleKind,
  spec: ScheduleSpec,
  shiftToWorkday: boolean,
  enabled: boolean,
) {
  const { previewSchedule } = useUseCases();

  return useQuery({
    queryKey: ["schedule-preview", kind, JSON.stringify(spec), shiftToWorkday],
    queryFn: async () =>
      unwrap(await previewSchedule.execute({ kind, spec, shiftToWorkday, count: 5 })),
    enabled,
  });
}
