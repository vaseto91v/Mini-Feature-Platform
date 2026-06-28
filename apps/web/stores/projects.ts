import type { CreateProjectInput, Project } from "@mfp/shared";
import { defineStore } from "pinia";

/** How long a delete can be undone before it's committed to the server. */
const UNDO_MS = 5000;

export const useProjectsStore = defineStore("projects", () => {
  const api = useApi();
  const toasts = useToastStore();
  const items = ref<Project[]>([]);
  const loading = ref(false);
  const loaded = ref(false);

  async function fetchAll(): Promise<void> {
    loading.value = true;
    try {
      items.value = await api.get<Project[]>("/projects");
      loaded.value = true;
    } finally {
      loading.value = false;
    }
  }

  async function create(input: CreateProjectInput): Promise<Project> {
    const project = await api.post<Project>("/projects", input);
    items.value = [project, ...items.value];
    return project;
  }

  /**
   * Optimistic delete with an undo window. Removing a project cascades to its
   * tasks on the server, so the actual delete is deferred until the undo
   * window passes.
   */
  function remove(id: string): void {
    const index = items.value.findIndex((p) => p.id === id);
    if (index === -1) return;
    const project = items.value[index]!;

    items.value = items.value.filter((p) => p.id !== id);

    const restore = (): void => {
      const next = [...items.value];
      next.splice(Math.min(index, next.length), 0, project);
      items.value = next;
    };

    let committed = false;
    const commit = async (): Promise<void> => {
      if (committed) return;
      committed = true;
      try {
        await api.del<null>(`/projects/${id}`);
      } catch (err) {
        restore();
        toasts.error(
          "Couldn't delete project",
          err instanceof ApiError ? err.message : undefined,
        );
      }
    };
    const timer = setTimeout(commit, UNDO_MS);

    toasts.push({
      variant: "info",
      title: "Project deleted",
      subtitle: project.name,
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

  const byId = (id: string): Project | null =>
    items.value.find((p) => p.id === id) ?? null;

  return { items, loading, loaded, fetchAll, create, remove, byId };
});
