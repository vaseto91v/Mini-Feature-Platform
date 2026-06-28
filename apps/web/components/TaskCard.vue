<script setup lang="ts">
import type { Task } from "@mfp/shared";

const props = defineProps<{ task: Task }>();
const board = useBoardStore();
const shortId = computed(() => props.task.id.slice(0, 6).toUpperCase());
const accentClass = computed(() => {
  const map = {
    todo: "border-l-accent-gray",
    in_progress: "border-l-accent-amber",
    done: "border-l-accent-green",
  } as const;
  return map[props.task.status];
});
</script>

<template>
  <div
    class="cursor-grab rounded-md border border-neutral-200 border-l-[3px] bg-white p-3 shadow-card transition hover:border-neutral-300 hover:shadow-panel active:cursor-grabbing dark:border-surface-dark-border dark:bg-surface-dark-3 dark:hover:border-surface-dark-border"
    :class="[accentClass, task.status === 'done' ? 'opacity-75' : '']"
    role="button"
    tabindex="0"
    @click="board.selectTask(task.id)"
    @keyup.enter="board.selectTask(task.id)"
  >
    <p class="font-mono text-[11px] text-neutral-400 dark:text-surface-dark-faint">
      {{ shortId }}
    </p>
    <p
      class="mt-1 text-[13px] font-medium leading-snug text-neutral-800 dark:text-surface-dark-text"
      :class="task.status === 'done' ? 'text-neutral-500 line-through dark:text-surface-dark-muted' : ''"
    >
      {{ task.title }}
    </p>
    <p class="mt-2 font-mono text-[10px] text-neutral-400 dark:text-surface-dark-faint">
      {{ relativeTime(task.createdAt) }}
    </p>
  </div>
</template>
