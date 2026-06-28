<script setup lang="ts">
const route = useRoute();
const projectId = route.params.id as string;

const board = useBoardStore();
const activity = useActivityStore();
const projects = useProjectsStore();
const stream = useProjectStream(projectId);

const showActivity = ref(true);
const showNewTask = ref(false);

const project = computed(() => projects.byId(projectId));

onMounted(async () => {
  if (!projects.loaded) projects.fetchAll();
  await Promise.all([board.load(projectId), activity.load(projectId)]);
  stream.connect();
});

onBeforeUnmount(() => {
  stream.disconnect();
  board.reset();
  activity.reset();
});
</script>

<template>
  <div class="flex h-[calc(100vh-52px)] flex-col">
    <!-- Toolbar -->
    <div
      class="flex items-center justify-between border-b border-neutral-200 bg-white px-6 py-2.5 dark:border-surface-dark-border dark:bg-surface-dark-2"
    >
      <div class="flex items-center gap-2.5">
        <NuxtLink
          to="/"
          class="text-caption text-neutral-400 transition hover:text-neutral-600 dark:hover:text-surface-dark-text"
        >
          Projects
        </NuxtLink>
        <span class="text-neutral-300 dark:text-surface-dark-faint">/</span>
        <MonogramTile
          v-if="project"
          :name="project.name"
          :seed="project.id"
          :size="22"
        />
        <h1 class="text-body font-semibold text-neutral-900 dark:text-surface-dark-text">
          {{ project?.name ?? "Board" }}
        </h1>
      </div>
      <div class="flex items-center gap-2">
        <UiButton
          variant="secondary"
          size="sm"
          @click="showActivity = !showActivity"
        >
          {{ showActivity ? "Hide activity" : "Activity" }}
        </UiButton>
        <UiButton size="sm" @click="showNewTask = true">Create issue</UiButton>
      </div>
    </div>

    <!-- Board + activity -->
    <div class="flex flex-1 overflow-hidden">
      <div class="flex-1 overflow-hidden">
        <div
          v-if="board.loading"
          class="flex gap-3 p-4"
        >
          <div
            v-for="i in 3"
            :key="i"
            class="h-64 w-72 animate-skeleton rounded-lg bg-neutral-200 dark:bg-surface-dark-2"
          />
        </div>
        <TaskBoard v-else class="h-full" />
      </div>
      <ActivityFeed
        v-if="showActivity"
        class="w-[300px] shrink-0 border-l border-neutral-200 dark:border-surface-dark-border"
      />
    </div>

    <NewTaskModal v-if="showNewTask" @close="showNewTask = false" />
    <TaskDetailModal
      v-if="board.selectedTask"
      :task="board.selectedTask"
      @close="board.clearSelection()"
    />
  </div>
</template>
