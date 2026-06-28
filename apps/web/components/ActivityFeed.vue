<script setup lang="ts">
import type { Activity, TaskStatus } from "@mfp/shared";

const activity = useActivityStore();
const auth = useAuthStore();

const STATUS_LABEL: Record<TaskStatus, string> = {
  todo: "To Do",
  in_progress: "In Progress",
  done: "Done",
};

const DOT: Record<string, string> = {
  "project.created": "bg-accent-blue",
  "task.created": "bg-accent-green",
  "task.status_changed": "bg-accent-amber",
};

const groups = computed(() => {
  const map = new Map<string, Activity[]>();
  for (const a of activity.items) {
    const key = dayLabel(a.createdAt);
    const bucket = map.get(key) ?? [];
    bucket.push(a);
    map.set(key, bucket);
  }
  return Array.from(map, ([label, items]) => ({ label, items }));
});

function actor(a: Activity): string {
  return a.actorId && a.actorId === auth.user?.id ? "You" : "A teammate";
}

function describe(a: Activity): string {
  const d = a.data as Record<string, unknown>;
  switch (a.type) {
    case "project.created":
      return "created this project";
    case "task.created":
      return `created "${String(d.title ?? "a task")}"`;
    case "task.status_changed":
      return `moved a task ${STATUS_LABEL[d.from as TaskStatus] ?? d.from} → ${STATUS_LABEL[d.to as TaskStatus] ?? d.to}`;
    default:
      return a.type;
  }
}
</script>

<template>
  <aside class="flex flex-col bg-white dark:bg-surface-dark-2">
    <header class="border-b border-neutral-200 px-4 py-3 dark:border-surface-dark-border">
      <h2 class="text-body font-semibold text-neutral-900 dark:text-surface-dark-text">
        Activity
      </h2>
    </header>
    <div class="flex-1 overflow-y-auto p-4 scrollbar-thin">
      <p
        v-if="activity.items.length === 0"
        class="text-caption text-neutral-400 dark:text-surface-dark-faint"
      >
        No activity yet.
      </p>
      <div v-for="g in groups" :key="g.label" class="mb-5">
        <p
          class="mb-2.5 font-mono text-[11px] uppercase tracking-wide text-neutral-400 dark:text-surface-dark-faint"
        >
          {{ g.label }}
        </p>
        <ul class="flex flex-col gap-3">
          <li v-for="a in g.items" :key="a.id" class="flex gap-2.5">
            <span
              class="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full"
              :class="DOT[a.type] ?? 'bg-neutral-300'"
            />
            <div class="min-w-0">
              <p class="text-caption leading-snug text-neutral-700 dark:text-surface-dark-muted">
                <span class="font-medium text-neutral-900 dark:text-surface-dark-text">{{
                  actor(a)
                }}</span>
                {{ describe(a) }}
              </p>
              <p class="mt-0.5 text-[11px] text-neutral-400 dark:text-surface-dark-faint">
                {{ relativeTime(a.createdAt) }}
              </p>
            </div>
          </li>
        </ul>
      </div>
    </div>
  </aside>
</template>
