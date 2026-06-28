<script setup lang="ts">
import { createProjectInputSchema, type Project } from "@mfp/shared";

const projects = useProjectsStore();
const toasts = useToastStore();

const showModal = ref(false);
const newName = ref("");
const nameError = ref("");
const submitting = ref(false);

const pendingDelete = ref<Project | null>(null);

onMounted(() => {
  if (!projects.loaded) projects.fetchAll();
});

function openModal(): void {
  newName.value = "";
  nameError.value = "";
  showModal.value = true;
}

function confirmDelete(): void {
  if (!pendingDelete.value) return;
  // Optimistic delete + dark "Undo" toast is handled in the store.
  projects.remove(pendingDelete.value.id);
  pendingDelete.value = null;
}

async function create(): Promise<void> {
  // Validate against the same schema the API enforces (@mfp/shared).
  const result = validateWith(createProjectInputSchema, { name: newName.value });
  nameError.value = result.errors.name ?? "";
  if (!result.success) return;

  submitting.value = true;
  try {
    const project = await projects.create(result.data);
    showModal.value = false;
    newName.value = "";
    toasts.success("Project created", project.name);
    navigateTo(`/projects/${project.id}`);
  } catch (err) {
    toasts.error(
      "Could not create project",
      err instanceof ApiError ? err.message : undefined,
    );
  } finally {
    submitting.value = false;
  }
}
</script>

<template>
  <div class="mx-auto max-w-5xl px-6 py-6">
    <header class="mb-5 flex items-center justify-between">
      <div>
        <h1 class="text-title font-semibold text-neutral-900 dark:text-surface-dark-text">
          Projects
        </h1>
        <p class="text-caption text-neutral-500 dark:text-surface-dark-muted">
          {{ projects.items.length }}
          {{ projects.items.length === 1 ? "project" : "projects" }}
        </p>
      </div>
      <UiButton v-if="projects.items.length" @click="openModal">
        + New project
      </UiButton>
    </header>

    <!-- Loading -->
    <div
      v-if="projects.loading"
      class="grid grid-cols-1 gap-3.5 sm:grid-cols-2 lg:grid-cols-3"
    >
      <div
        v-for="i in 6"
        :key="i"
        class="h-[116px] animate-skeleton rounded-lg bg-neutral-200 dark:bg-surface-dark-2"
      />
    </div>

    <!-- Empty state: the whole card is the single call to action. -->
    <div
      v-else-if="projects.items.length === 0"
      role="button"
      tabindex="0"
      aria-label="Create your first project"
      class="group flex w-full cursor-pointer flex-col items-center justify-center rounded-xl border border-dashed border-neutral-300 bg-white py-16 text-center transition hover:border-primary-300 hover:bg-primary-50/40 focus:border-primary-300 focus:outline-none dark:border-surface-dark-border dark:bg-surface-dark-2 dark:hover:border-primary-500/60 dark:hover:bg-primary-500/10"
      @click="openModal"
      @keyup.enter="openModal"
    >
      <div
        class="mb-4 flex h-16 w-16 items-center justify-center rounded-xl bg-primary-50 text-2xl text-primary transition group-hover:bg-primary-100 dark:bg-primary-500/15 dark:text-primary-200"
      >
        +
      </div>
      <h2 class="text-heading font-semibold text-neutral-900 dark:text-surface-dark-text">
        Create your first project
      </h2>
      <p class="mt-1 max-w-[340px] text-caption text-neutral-500 dark:text-surface-dark-muted">
        Start tracking tasks on the board.
      </p>
    </div>

    <!-- Grid -->
    <div v-else class="grid grid-cols-1 gap-3.5 sm:grid-cols-2 lg:grid-cols-3">
      <NuxtLink
        v-for="p in projects.items"
        :key="p.id"
        :to="`/projects/${p.id}`"
        class="group relative rounded-lg border border-neutral-200 bg-white p-4 shadow-card transition hover:border-primary-200 hover:shadow-panel dark:border-surface-dark-border dark:bg-surface-dark-2 dark:hover:border-primary-500/50"
      >
        <button
          type="button"
          class="absolute right-2.5 top-2.5 rounded p-1 text-neutral-400 opacity-0 transition hover:bg-accent-red-soft hover:text-accent-red focus:opacity-100 group-hover:opacity-100 dark:hover:bg-accent-red/15"
          aria-label="Delete project"
          title="Delete project"
          @click.stop.prevent="pendingDelete = p"
        >
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
            stroke-linecap="round"
            stroke-linejoin="round"
            class="h-4 w-4"
          >
            <path
              d="M3 6h18M8 6V4a1 1 0 011-1h6a1 1 0 011 1v2m2 0v14a1 1 0 01-1 1H6a1 1 0 01-1-1V6m3 5v6m6-6v6"
            />
          </svg>
        </button>
        <MonogramTile :name="p.name" :seed="p.id" />
        <h3 class="mt-3 text-body font-semibold text-neutral-900 dark:text-surface-dark-text">
          {{ p.name }}
        </h3>
        <p class="mt-1 text-caption text-neutral-500 dark:text-surface-dark-muted">
          Created {{ relativeTime(p.createdAt) }}
        </p>
      </NuxtLink>
    </div>

    <ModalShell v-if="showModal" title="New project" @close="showModal = false">
      <UiTextField
        v-model="newName"
        label="Project name"
        placeholder="e.g. Website redesign"
        :error="nameError"
        @keyup.enter="create"
      />
      <template #footer>
        <UiButton variant="secondary" size="sm" @click="showModal = false">
          Cancel
        </UiButton>
        <UiButton size="sm" :loading="submitting" @click="create">
          Create project
        </UiButton>
      </template>
    </ModalShell>

    <ModalShell
      v-if="pendingDelete"
      title="Delete project"
      @close="pendingDelete = null"
    >
      <p class="text-body text-neutral-700 dark:text-surface-dark-muted">
        Delete
        <span class="font-semibold text-neutral-900 dark:text-surface-dark-text">{{
          pendingDelete.name
        }}</span>? This permanently removes the project and all of its tasks.
      </p>
      <template #footer>
        <UiButton variant="secondary" size="sm" @click="pendingDelete = null">
          Cancel
        </UiButton>
        <UiButton variant="danger" size="sm" @click="confirmDelete">
          Delete project
        </UiButton>
      </template>
    </ModalShell>
  </div>
</template>
