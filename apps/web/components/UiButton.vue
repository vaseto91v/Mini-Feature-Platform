<script setup lang="ts">
const props = withDefaults(
  defineProps<{
    variant?: "primary" | "secondary" | "ghost" | "danger";
    size?: "sm" | "md";
    block?: boolean;
    loading?: boolean;
    disabled?: boolean;
    type?: "button" | "submit";
  }>(),
  { variant: "primary", size: "md", type: "button" },
);

const variantClass: Record<string, string> = {
  primary: "bg-primary text-white hover:bg-primary-600 shadow-card",
  secondary:
    "bg-white text-neutral-800 border border-neutral-300 hover:bg-neutral-50 dark:bg-surface-dark-3 dark:text-surface-dark-text dark:border-surface-dark-border dark:hover:bg-surface-dark-2",
  ghost:
    "text-neutral-600 hover:bg-neutral-100 dark:text-surface-dark-muted dark:hover:bg-surface-dark-3",
  danger:
    "text-accent-red hover:bg-accent-red-soft dark:hover:bg-accent-red/15",
};
const sizeClass: Record<string, string> = {
  sm: "text-caption px-2.5 py-1.5",
  md: "text-body px-4 py-2",
};
</script>

<template>
  <button
    :type="type"
    :disabled="disabled || loading"
    class="inline-flex items-center justify-center gap-2 rounded font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-50"
    :class="[variantClass[variant], sizeClass[size], block ? 'w-full' : '']"
  >
    <UiSpinner v-if="loading" :size="size === 'sm' ? 13 : 15" />
    <slot />
  </button>
</template>
