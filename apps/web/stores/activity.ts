import type { Activity } from "@mfp/shared";
import { defineStore } from "pinia";

export const useActivityStore = defineStore("activity", () => {
  const api = useApi();
  const items = ref<Activity[]>([]);
  const loading = ref(false);

  async function load(projectId: string): Promise<void> {
    loading.value = true;
    try {
      items.value = await api.get<Activity[]>(`/projects/${projectId}/activity`);
    } finally {
      loading.value = false;
    }
  }

  /** Prepend a live activity (from SSE), deduped by id. */
  function prepend(activity: Activity): void {
    if (items.value.some((a) => a.id === activity.id)) return;
    items.value = [activity, ...items.value];
  }

  function reset(): void {
    items.value = [];
  }

  return { items, loading, load, prepend, reset };
});
