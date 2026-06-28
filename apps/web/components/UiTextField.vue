<script setup lang="ts">
const props = defineProps<{
  modelValue?: string;
  label?: string;
  type?: string;
  placeholder?: string;
  error?: string;
  hint?: string;
  autocomplete?: string;
  required?: boolean;
}>();
defineEmits<{ "update:modelValue": [string] }>();

const inputId = useId();
</script>

<template>
  <div>
    <label
      v-if="label"
      :for="inputId"
      class="mb-1.5 block text-caption font-medium text-neutral-700 dark:text-surface-dark-muted"
      >{{ label }}</label
    >
    <input
      :id="inputId"
      :type="type ?? 'text'"
      :value="modelValue"
      :placeholder="placeholder"
      :autocomplete="autocomplete"
      :required="required"
      class="w-full rounded border bg-white px-3 py-2 text-body text-neutral-950 outline-none transition placeholder:text-neutral-400 focus:border-primary focus:ring-[3px] focus:ring-primary-50 dark:bg-surface-dark-3 dark:text-surface-dark-text dark:placeholder:text-surface-dark-faint dark:focus:ring-primary-500/25"
      :class="
        error
          ? 'border-accent-red'
          : 'border-neutral-300 dark:border-surface-dark-border'
      "
      @input="
        $emit('update:modelValue', ($event.target as HTMLInputElement).value)
      "
    />
    <p v-if="error" class="mt-1.5 text-caption text-accent-red">{{ error }}</p>
    <p
      v-else-if="hint"
      class="mt-1.5 text-caption text-neutral-500 dark:text-surface-dark-muted"
    >
      {{ hint }}
    </p>
  </div>
</template>
