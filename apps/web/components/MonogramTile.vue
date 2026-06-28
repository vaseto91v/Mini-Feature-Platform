<script setup lang="ts">
const props = withDefaults(
  defineProps<{ name: string; seed?: string; size?: number }>(),
  { size: 36 },
);

const label = computed(() => monogram(props.name));
const accentClass = computed(() => ACCENT_SOFT[accentFor(props.seed ?? props.name)]);
</script>

<template>
  <span
    class="inline-flex items-center justify-center rounded-lg font-semibold"
    :class="accentClass"
    :style="{
      width: `${size}px`,
      height: `${size}px`,
      fontSize: `${Math.round(size * 0.34)}px`,
    }"
  >
    {{ label }}
  </span>
</template>
