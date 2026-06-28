<script setup lang="ts">
const props = withDefaults(
  defineProps<{ value: string; size?: number }>(),
  { size: 28 },
);

const text = computed(() => initials(props.value));
const accentClass = computed(() => ACCENT_SOLID[accentFor(props.value)]);
</script>

<template>
  <span
    class="inline-flex items-center justify-center rounded-full font-medium"
    :class="accentClass"
    :style="{
      width: `${size}px`,
      height: `${size}px`,
      fontSize: `${Math.round(size * 0.4)}px`,
    }"
    :title="value"
  >
    {{ text }}
  </span>
</template>
