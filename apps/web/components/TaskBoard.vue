<script setup lang="ts">
import type { Task, TaskStatus } from "@mfp/shared";
import draggable from "vuedraggable";

const board = useBoardStore();

const COLUMNS: { status: TaskStatus; title: string; dot: string }[] = [
  { status: "todo", title: "To Do", dot: "bg-status-todo" },
  { status: "in_progress", title: "In Progress", dot: "bg-status-progress" },
  { status: "done", title: "Done", dot: "bg-status-done" },
];

// Local mirror that vuedraggable owns; rebuilt from the store except mid-drag.
const lists = reactive<Record<TaskStatus, Task[]>>({
  todo: [],
  in_progress: [],
  done: [],
});
let dragging: boolean = false;

function rebuild(): void {
  lists.todo = [...board.columns.todo];
  lists.in_progress = [...board.columns.in_progress];
  lists.done = [...board.columns.done];
}

watch(
  () => board.tasks,
  () => {
    if (!dragging) rebuild();
  },
  { deep: true, immediate: true },
);

function onDragStart(): void {
  dragging = true;
}

function onDragEnd(): void {
  dragging = false;
  rebuild();
}

interface ChangeEvent {
  added?: { element: Task };
}

function onChange(status: TaskStatus, evt: ChangeEvent): void {
  if (evt.added) {
    // Persist optimistically; the store reconciles or rolls back + toasts.
    void board.moveTask(evt.added.element.id, status);
  }
}
</script>

<template>
  <div
    class="flex gap-3 overflow-x-auto bg-neutral-100 p-4 scrollbar-thin dark:bg-surface-dark"
  >
    <section
      v-for="col in COLUMNS"
      :key="col.status"
      class="flex w-72 shrink-0 flex-col rounded-lg bg-neutral-50/60 dark:bg-surface-dark-2/50"
    >
      <header class="flex items-center gap-2 px-3 py-2.5">
        <span class="h-2 w-2 rounded-full" :class="col.dot" />
        <h3 class="text-caption font-semibold text-neutral-700 dark:text-surface-dark-muted">
          {{ col.title }}
        </h3>
        <span
          class="ml-1 rounded-full bg-neutral-200 px-1.5 text-[11px] font-medium text-neutral-600 dark:bg-surface-dark-3 dark:text-surface-dark-muted"
        >
          {{ lists[col.status].length }}
        </span>
      </header>

      <draggable
        :list="lists[col.status]"
        :group="{ name: 'board' }"
        item-key="id"
        class="flex min-h-[120px] flex-1 flex-col gap-2 px-2 pb-3"
        ghost-class="opacity-40"
        drag-class="rotate-[1.5deg]"
        @start="onDragStart"
        @end="onDragEnd"
        @change="onChange(col.status, $event)"
      >
        <template #item="{ element }">
          <TaskCard :task="element" />
        </template>
      </draggable>
    </section>
  </div>
</template>
