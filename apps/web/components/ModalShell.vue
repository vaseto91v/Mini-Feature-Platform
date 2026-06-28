<script setup lang="ts">
defineProps<{ title: string }>();
const emit = defineEmits<{ close: [] }>();

function onKey(e: KeyboardEvent): void {
  if (e.key === "Escape") emit("close");
}
onMounted(() => window.addEventListener("keydown", onKey));
onUnmounted(() => window.removeEventListener("keydown", onKey));
</script>

<template>
  <div
    class="fixed inset-0 z-40 flex items-start justify-center bg-[rgba(31,35,41,0.55)] p-4 pt-[12vh]"
    @click.self="emit('close')"
  >
    <div class="w-[460px] rounded-xl bg-white shadow-modal dark:bg-surface-dark-2">
      <header
        class="flex items-center justify-between border-b border-neutral-100 px-5 py-3.5 dark:border-surface-dark-border"
      >
        <h2 class="text-body font-semibold text-neutral-900 dark:text-surface-dark-text">
          {{ title }}
        </h2>
        <button
          type="button"
          class="text-neutral-400 transition hover:text-neutral-600 dark:hover:text-surface-dark-text"
          aria-label="Close"
          @click="emit('close')"
        >
          ✕
        </button>
      </header>
      <div class="px-5 py-4">
        <slot />
      </div>
      <footer
        v-if="$slots.footer"
        class="flex justify-end gap-2 border-t border-neutral-100 px-5 py-3.5 dark:border-surface-dark-border"
      >
        <slot name="footer" />
      </footer>
    </div>
  </div>
</template>
