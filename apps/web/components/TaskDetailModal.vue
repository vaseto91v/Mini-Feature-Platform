<script setup lang="ts">
import { TASK_STATUSES, type Task } from "@mfp/shared";

const props = defineProps<{ task: Task }>();
const emit = defineEmits<{ close: [] }>();

const board = useBoardStore();

const shortId = computed(() => props.task.id.slice(0, 6).toUpperCase());

const STATUS_LABELS: Record<string, string> = {
  todo: "To Do",
  in_progress: "In Progress",
  done: "Done",
};
const statusOptions = TASK_STATUSES.map((value) => ({
  value,
  label: STATUS_LABELS[value] ?? value,
}));

// Changing the status reuses the optimistic move (PATCH) flow.
const status = computed({
  get: () => props.task.status,
  set: (value) => void board.moveTask(props.task.id, value),
});

function remove(): void {
  // Optimistic delete + dark "Undo" toast is handled in the board store.
  board.deleteTask(props.task.id);
  emit("close");
}
</script>

<template>
  <ModalShell :title="`Issue ${shortId}`" @close="emit('close')">
    <div class="flex flex-col gap-4">
      <div>
        <p class="mb-1 text-caption font-medium text-neutral-500 dark:text-surface-dark-muted">
          Title
        </p>
        <p class="text-body text-neutral-900 dark:text-surface-dark-text">
          {{ task.title }}
        </p>
      </div>

      <UiSelect v-model="status" label="Status" :options="statusOptions" />

      <div class="flex gap-6 text-caption text-neutral-500 dark:text-surface-dark-muted">
        <div>
          <p class="mb-0.5 font-medium">Created</p>
          <p>{{ relativeTime(task.createdAt) }}</p>
        </div>
        <div>
          <p class="mb-0.5 font-medium">ID</p>
          <p class="font-mono">{{ shortId }}</p>
        </div>
      </div>
    </div>

    <template #footer>
      <UiButton variant="danger" size="sm" class="mr-auto" @click="remove">
        Delete
      </UiButton>
      <UiButton variant="secondary" size="sm" @click="emit('close')">
        Close
      </UiButton>
    </template>
  </ModalShell>
</template>
