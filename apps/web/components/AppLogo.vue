<script setup lang="ts">
withDefaults(defineProps<{ size?: number; showWordmark?: boolean }>(), {
  size: 24,
  showWordmark: true,
});
</script>

<template>
  <div class="flex items-center gap-2">
    <span
      class="flex flex-col items-center justify-center gap-[3px] rounded-md bg-primary"
      :style="{ width: `${size}px`, height: `${size}px` }"
    >
      <span class="block h-[2px] w-1/2 rounded-full bg-white" />
      <span class="block h-[2px] w-1/2 rounded-full bg-white opacity-70" />
    </span>
    <span
      v-if="showWordmark"
      class="text-body font-semibold text-neutral-900 dark:text-surface-dark-text"
    >
      Mini Feature Platform
    </span>
  </div>
</template>
