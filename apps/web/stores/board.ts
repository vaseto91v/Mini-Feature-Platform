import type { CreateTaskInput, Task, TaskStatus } from "@mfp/shared";
import { defineStore } from "pinia";

/** How long a delete can be undone before it's committed to the server. */
const UNDO_MS = 5000;

export const useBoardStore = defineStore("board", () => {
  const api = useApi();
  const toasts = useToastStore();

  const projectId = ref<string | null>(null);
  const tasks = ref<Task[]>([]);
  const loading = ref(false);
  const selectedTaskId = ref<string | null>(null);

  const columns = computed<Record<TaskStatus, Task[]>>(() => ({
    todo: tasks.value.filter((t) => t.status === "todo"),
    in_progress: tasks.value.filter((t) => t.status === "in_progress"),
    done: tasks.value.filter((t) => t.status === "done"),
  }));

  /** The task open in the detail modal, kept in sync with the live task list. */
  const selectedTask = computed<Task | null>(
    () => tasks.value.find((t) => t.id === selectedTaskId.value) ?? null,
  );

  async function load(pid: string): Promise<void> {
    projectId.value = pid;
    loading.value = true;
    try {
      tasks.value = await api.get<Task[]>(`/projects/${pid}/tasks`);
    } finally {
      loading.value = false;
    }
  }

  async function createTask(input: CreateTaskInput): Promise<Task> {
    if (!projectId.value) throw new Error("No project loaded");
    const task = await api.post<Task>(
      `/projects/${projectId.value}/tasks`,
      input,
    );
    tasks.value = [task, ...tasks.value];
    return task;
  }

  /** Optimistic status change: update locally first, roll back + toast on failure. */
  async function moveTask(taskId: string, status: TaskStatus): Promise<void> {
    const task = tasks.value.find((t) => t.id === taskId);
    if (!task || task.status === status) return;

    const previous = task.status;
    task.status = status; // optimistic

    try {
      const updated = await api.patch<Task>(`/tasks/${taskId}/status`, { status });
      const idx = tasks.value.findIndex((t) => t.id === taskId);
      if (idx !== -1) tasks.value[idx] = updated; // reconcile with server truth
    } catch (err) {
      task.status = previous; // rollback
      const detail = err instanceof ApiError ? err.message : "Please try again";
      toasts.error("Couldn't move task - changes rolled back", detail, [
        { label: "Retry", danger: true, onClick: () => void moveTask(taskId, status) },
      ]);
    }
  }

  function selectTask(id: string): void {
    selectedTaskId.value = id;
  }

  function clearSelection(): void {
    selectedTaskId.value = null;
  }

  /**
   * Optimistic delete with an undo window: the row leaves the board immediately,
   * but the server delete is deferred so "Undo" can cancel it.
   */
  function deleteTask(taskId: string): void {
    const index = tasks.value.findIndex((t) => t.id === taskId);
    if (index === -1) return;
    const task = tasks.value[index]!;

    tasks.value = tasks.value.filter((t) => t.id !== taskId);
    if (selectedTaskId.value === taskId) selectedTaskId.value = null;

    const restore = (): void => {
      const next = [...tasks.value];
      next.splice(Math.min(index, next.length), 0, task);
      tasks.value = next;
    };

    let committed = false;
    const commit = async (): Promise<void> => {
      if (committed) return;
      committed = true;
      try {
        await api.del<null>(`/tasks/${taskId}`);
      } catch (err) {
        restore();
        toasts.error(
          "Couldn't delete issue",
          err instanceof ApiError ? err.message : undefined,
        );
      }
    };
    const timer = setTimeout(commit, UNDO_MS);

    toasts.push({
      variant: "info",
      title: "Issue deleted",
      subtitle: task.title,
      timeout: UNDO_MS,
      actions: [
        {
          label: "Undo",
          onClick: () => {
            clearTimeout(timer);
            if (!committed) restore();
          },
        },
      ],
    });
  }

  /** Apply a task create/update arriving from another client via SSE. */
  function applyRemoteTask(task: Task): void {
    const idx = tasks.value.findIndex((t) => t.id === task.id);
    if (idx === -1) tasks.value = [task, ...tasks.value];
    else tasks.value[idx] = task;
  }

  function applyRemoteStatus(taskId: string, status: TaskStatus): void {
    const task = tasks.value.find((t) => t.id === taskId);
    if (task) task.status = status;
  }

  function reset(): void {
    tasks.value = [];
    projectId.value = null;
    selectedTaskId.value = null;
  }

  return {
    projectId,
    tasks,
    loading,
    columns,
    selectedTaskId,
    selectedTask,
    load,
    createTask,
    moveTask,
    deleteTask,
    selectTask,
    clearSelection,
    applyRemoteTask,
    applyRemoteStatus,
    reset,
  };
});
