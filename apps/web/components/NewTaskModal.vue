<script setup lang="ts">
import { createTaskInputSchema, type TaskStatus } from "@mfp/shared";

const emit = defineEmits<{ close: [] }>();

const board = useBoardStore();
const toasts = useToastStore();

const title = ref("");
const status = ref<TaskStatus>("todo");
const titleError = ref("");
const submitting = ref(false);

const statusOptions = [
  { value: "todo", label: "To Do" },
  { value: "in_progress", label: "In Progress" },
  { value: "done", label: "Done" },
];

async function submit(): Promise<void> {
  // Validate against the same schema the API enforces (@mfp/shared).
  const result = validateWith(createTaskInputSchema, {
    title: title.value,
    status: status.value,
  });
  titleError.value = result.errors.title ?? "";
  if (!result.success) return;

  submitting.value = true;
  try {
    await board.createTask(result.data);
    toasts.success("Issue created");
    emit("close");
  } catch (err) {
    toasts.error(
      "Could not create issue",
      err instanceof ApiError ? err.message : undefined,
    );
  } finally {
    submitting.value = false;
  }
}
</script>

<template>
  <ModalShell title="Create issue" @close="emit('close')">
    <div class="flex flex-col gap-3.5">
      <UiTextField
        v-model="title"
        label="Title"
        placeholder="What needs doing?"
        :error="titleError"
        @keyup.enter="submit"
      />
      <UiSelect v-model="status" label="Status" :options="statusOptions" />
    </div>
    <template #footer>
      <UiButton variant="secondary" size="sm" @click="emit('close')">
        Cancel
      </UiButton>
      <UiButton size="sm" :loading="submitting" @click="submit">
        Create issue
      </UiButton>
    </template>
  </ModalShell>
</template>
