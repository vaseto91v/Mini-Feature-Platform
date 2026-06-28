<script setup lang="ts">
import type { Task, TaskStatus } from "@mfp/shared";

const api = useApi();
const projects = useProjectsStore();

const tasks = ref<Task[]>([]);
const loading = ref(true);

onMounted(async () => {
  await Promise.all([
    projects.loaded ? Promise.resolve() : projects.fetchAll(),
    api
      .get<Task[]>("/tasks")
      .then((rows) => {
        tasks.value = rows;
      }),
  ]);
  loading.value = false;
});

const projectName = (id: string): string =>
  projects.byId(id)?.name ?? "Unknown project";

const ORDER: TaskStatus[] = ["todo", "in_progress", "done"];
// Open issues first (todo, in_progress), then done; newest within each group.
const sorted = computed(() =>
  [...tasks.value].sort(
    (a, b) => ORDER.indexOf(a.status) - ORDER.indexOf(b.status),
  ),
);

const counts = computed(() => ({
  total: tasks.value.length,
  open: tasks.value.filter((t) => t.status !== "done").length,
}));
</script>

<template>
  <div class="mx-auto max-w-4xl px-6 py-6">
    <header class="mb-5">
      <h1 class="text-title font-semibold text-neutral-900 dark:text-surface-dark-text">
        My issues
      </h1>
      <p class="text-caption text-neutral-500 dark:text-surface-dark-muted">
        {{ counts.open }} open · {{ counts.total }} total across all projects
      </p>
    </header>

    <!-- Loading -->
    <div v-if="loading" class="flex flex-col gap-2">
      <div
        v-for="i in 5"
        :key="i"
        class="h-14 animate-skeleton rounded-lg bg-neutral-200 dark:bg-surface-dark-2"
      />
    </div>

    <!-- Empty -->
    <div
      v-else-if="tasks.length === 0"
      class="rounded-xl border border-dashed border-neutral-300 bg-white py-16 text-center dark:border-surface-dark-border dark:bg-surface-dark-2"
    >
      <h2 class="text-heading font-semibold text-neutral-900 dark:text-surface-dark-text">
        No issues yet
      </h2>
      <p class="mt-1 text-caption text-neutral-500 dark:text-surface-dark-muted">
        Open a project and create issues on its board.
      </p>
    </div>

    <!-- List -->
    <div
      v-else
      class="divide-y divide-neutral-100 overflow-hidden rounded-lg border border-neutral-200 bg-white dark:divide-surface-dark-border dark:border-surface-dark-border dark:bg-surface-dark-2"
    >
      <NuxtLink
        v-for="t in sorted"
        :key="t.id"
        :to="`/projects/${t.projectId}`"
        class="flex items-center gap-3 px-4 py-3 transition hover:bg-neutral-50 dark:hover:bg-surface-dark-3"
      >
        <StatusBadge :status="t.status" />
        <span
          class="flex-1 truncate text-body text-neutral-800 dark:text-surface-dark-text"
          :class="t.status === 'done' ? 'text-neutral-400 line-through dark:text-surface-dark-faint' : ''"
        >
          {{ t.title }}
        </span>
        <span class="hidden text-caption text-neutral-500 dark:text-surface-dark-muted sm:inline">
          {{ projectName(t.projectId) }}
        </span>
        <span class="font-mono text-[11px] text-neutral-400 dark:text-surface-dark-faint">
          {{ relativeTime(t.createdAt) }}
        </span>
      </NuxtLink>
    </div>
  </div>
</template>
