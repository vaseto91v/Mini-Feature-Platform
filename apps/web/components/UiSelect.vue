<script setup lang="ts">
defineProps<{
  modelValue: string;
  options: { value: string; label: string }[];
  label?: string;
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
    <select
      :id="inputId"
      :value="modelValue"
      class="w-full rounded border border-neutral-300 bg-white px-3 py-2 text-body text-neutral-950 outline-none transition focus:border-primary focus:ring-[3px] focus:ring-primary-50 dark:border-surface-dark-border dark:bg-surface-dark-3 dark:text-surface-dark-text dark:focus:ring-primary-500/25"
      @change="
        $emit('update:modelValue', ($event.target as HTMLSelectElement).value)
      "
    >
      <option v-for="o in options" :key="o.value" :value="o.value">
        {{ o.label }}
      </option>
    </select>
  </div>
</template>
