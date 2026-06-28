<script setup lang="ts">
import type { TaskStatus } from "@mfp/shared";

const props = defineProps<{ status: TaskStatus }>();

const MAP: Record<TaskStatus, { label: string; dot: string; chip: string }> = {
  todo: {
    label: "To Do",
    dot: "bg-status-todo",
    chip: "text-status-todo bg-status-todo-bg dark:bg-surface-dark-3 dark:text-surface-dark-muted",
  },
  in_progress: {
    label: "In Progress",
    dot: "bg-status-progress",
    chip: "text-status-progress-fg bg-status-progress-bg dark:bg-status-progress/15 dark:text-status-progress",
  },
  done: {
    label: "Done",
    dot: "bg-status-done",
    chip: "text-status-done-fg bg-status-done-bg dark:bg-status-done/15 dark:text-status-done",
  },
};

const meta = computed(() => MAP[props.status]);
</script>

<template>
  <span
    class="inline-flex items-center gap-1.5 rounded px-2.5 py-1 text-caption font-medium"
    :class="meta.chip"
  >
    <span class="h-2 w-2 rounded-full" :class="meta.dot" />
    {{ meta.label }}
  </span>
</template>
