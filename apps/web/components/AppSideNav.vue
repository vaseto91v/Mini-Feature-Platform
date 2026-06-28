<script setup lang="ts">
const links = [
  { to: "/", label: "Projects" },
  { to: "/my-issues", label: "My issues" },
  { to: "/account", label: "Account" },
];

const route = useRoute();
// "Projects" stays active across the projects/board routes; the rest match
// their own path (exact or nested) without leaking into siblings.
const isActive = (to: string): boolean => {
  if (to === "/") {
    return route.path === "/" || route.path.startsWith("/projects");
  }
  return route.path === to || route.path.startsWith(`${to}/`);
};
</script>

<template>
  <aside
    class="hidden w-rail shrink-0 border-r border-neutral-200 bg-white p-3 dark:border-surface-dark-border dark:bg-surface-dark-2 md:block"
  >
    <nav class="flex flex-col gap-0.5">
      <NuxtLink
        v-for="link in links"
        :key="link.to"
        :to="link.to"
        class="flex items-center gap-2 rounded px-3 py-2 text-body font-medium"
        :class="
          isActive(link.to)
            ? 'bg-primary-50 text-primary dark:bg-primary-500/15 dark:text-primary-200'
            : 'text-neutral-700 hover:bg-neutral-50 dark:text-surface-dark-muted dark:hover:bg-surface-dark-3'
        "
      >
        {{ link.label }}
      </NuxtLink>
    </nav>
  </aside>
</template>
