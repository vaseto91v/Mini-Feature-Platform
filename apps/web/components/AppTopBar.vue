<script setup lang="ts">
const auth = useAuthStore();
const theme = useThemeStore();
const router = useRouter();

const menuOpen = ref(false);

async function logout(): Promise<void> {
  await auth.logout();
  router.push("/login");
}
</script>

<template>
  <header
    class="flex h-[52px] items-center justify-between border-b border-neutral-200 bg-white px-4 dark:border-surface-dark-border dark:bg-surface-dark-2"
  >
    <NuxtLink to="/" class="flex items-center gap-3">
      <AppLogo />
    </NuxtLink>

    <div class="relative flex items-center gap-3">
      <span class="hidden text-caption text-neutral-500 dark:text-surface-dark-muted sm:inline">
        {{ auth.user?.email }}
      </span>
      <button
        type="button"
        class="flex h-8 w-8 items-center justify-center rounded-full text-neutral-500 transition hover:bg-neutral-100 dark:text-surface-dark-muted dark:hover:bg-surface-dark-3"
        :aria-label="theme.isDark ? 'Switch to light mode' : 'Switch to dark mode'"
        :title="theme.isDark ? 'Light mode' : 'Dark mode'"
        @click="theme.toggle()"
      >
        <svg
          v-if="theme.isDark"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="2"
          stroke-linecap="round"
          stroke-linejoin="round"
          class="h-[18px] w-[18px]"
        >
          <circle cx="12" cy="12" r="4" />
          <path
            d="M12 2v2m0 16v2M4.93 4.93l1.41 1.41m11.32 11.32l1.41 1.41M2 12h2m16 0h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41"
          />
        </svg>
        <svg
          v-else
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="2"
          stroke-linecap="round"
          stroke-linejoin="round"
          class="h-[18px] w-[18px]"
        >
          <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
        </svg>
      </button>
      <button
        type="button"
        class="rounded-full outline-none ring-primary-50 focus:ring-[3px]"
        @click="menuOpen = !menuOpen"
      >
        <AvatarBadge v-if="auth.user" :value="auth.user.email" :size="30" />
      </button>

      <div
        v-if="menuOpen"
        class="absolute right-0 top-11 z-30 w-44 rounded-md border border-neutral-200 bg-white py-1 shadow-pop dark:border-surface-dark-border dark:bg-surface-dark-3"
        @mouseleave="menuOpen = false"
      >
        <div class="border-b border-neutral-100 px-3 py-2 dark:border-surface-dark-border">
          <p class="truncate text-caption font-medium text-neutral-800 dark:text-surface-dark-text">
            {{ auth.user?.email }}
          </p>
          <p class="text-[11px] uppercase tracking-wide text-neutral-400 dark:text-surface-dark-faint">
            {{ auth.user?.role }}
          </p>
        </div>
        <button
          type="button"
          class="w-full px-3 py-2 text-left text-caption text-neutral-700 hover:bg-neutral-50 dark:text-surface-dark-muted dark:hover:bg-surface-dark-2"
          @click="logout"
        >
          Sign out
        </button>
      </div>
    </div>
  </header>
</template>
