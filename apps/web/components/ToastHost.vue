<script setup lang="ts">
import type { Toast, ToastAction } from "~/stores/toasts";

const toasts = useToastStore();

const leftBar: Record<Toast["variant"], string> = {
  success: "bg-accent-green",
  error: "bg-accent-red",
  info: "bg-primary",
};

function onAction(toast: Toast, action: ToastAction): void {
  action.onClick();
  toasts.dismiss(toast.id);
}
</script>

<template>
  <div class="fixed right-4 top-4 z-50 flex w-[360px] flex-col gap-2">
    <TransitionGroup name="toast">
      <div
        v-for="t in toasts.items"
        :key="t.id"
        class="relative overflow-hidden rounded-md border p-3 pl-4 shadow-pop"
        :class="
          t.variant === 'info'
            ? 'border-neutral-800 bg-neutral-950 text-white'
            : t.variant === 'error'
              ? 'border-accent-red/30 bg-white dark:bg-surface-dark-2'
              : 'border-neutral-200 bg-white dark:border-surface-dark-border dark:bg-surface-dark-2'
        "
      >
        <span class="absolute inset-y-0 left-0 w-[3px]" :class="leftBar[t.variant]" />
        <div class="flex items-start gap-2.5">
          <span
            v-if="t.variant !== 'info'"
            class="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[11px] font-bold"
            :class="
              t.variant === 'success'
                ? 'bg-accent-green-soft text-accent-green'
                : 'bg-accent-red-soft text-accent-red'
            "
          >
            {{ t.variant === "success" ? "✓" : "!" }}
          </span>
          <div class="min-w-0 flex-1">
            <p
              class="text-body font-medium"
              :class="
                t.variant === 'info'
                  ? 'text-white'
                  : 'text-neutral-900 dark:text-surface-dark-text'
              "
            >
              {{ t.title }}
            </p>
            <p
              v-if="t.subtitle"
              class="mt-0.5 text-caption"
              :class="
                t.variant === 'info'
                  ? 'text-neutral-300'
                  : 'text-neutral-500 dark:text-surface-dark-muted'
              "
            >
              {{ t.subtitle }}
            </p>
            <div v-if="t.actions?.length" class="mt-2 flex gap-3">
              <button
                v-for="a in t.actions"
                :key="a.label"
                type="button"
                class="text-caption font-medium hover:underline"
                :class="a.danger ? 'text-accent-red' : 'text-primary'"
                @click="onAction(t, a)"
              >
                {{ a.label }}
              </button>
            </div>
          </div>
          <button
            type="button"
            class="text-neutral-400 transition hover:text-neutral-600"
            :class="t.variant === 'info' ? 'text-neutral-500 hover:text-neutral-300' : ''"
            aria-label="Dismiss"
            @click="toasts.dismiss(t.id)"
          >
            ✕
          </button>
        </div>
      </div>
    </TransitionGroup>
  </div>
</template>

<style scoped>
.toast-enter-active,
.toast-leave-active {
  transition: all 0.22s ease;
}
.toast-enter-from {
  opacity: 0;
  transform: translateX(16px);
}
.toast-leave-to {
  opacity: 0;
  transform: translateX(16px);
}
</style>
