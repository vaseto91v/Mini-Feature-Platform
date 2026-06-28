<script setup lang="ts">
const auth = useAuthStore();
const org = useOrgStore();
const router = useRouter();

onMounted(() => {
  if (!org.loaded) org.load();
});

const ROLE_LABEL: Record<string, string> = {
  owner: "Owner",
  admin: "Admin",
  member: "Member",
};

const members = computed(() => org.organization?.members ?? []);

async function signOut(): Promise<void> {
  await auth.logout();
  router.push("/login");
}
</script>

<template>
  <div class="mx-auto max-w-2xl px-6 py-6">
    <h1 class="mb-5 text-title font-semibold text-neutral-900 dark:text-surface-dark-text">
      Account
    </h1>

    <!-- Profile -->
    <section
      class="mb-4 overflow-hidden rounded-lg border border-neutral-200 bg-white dark:border-surface-dark-border dark:bg-surface-dark-2"
    >
      <header class="border-b border-neutral-100 px-5 py-3 dark:border-surface-dark-border">
        <h2 class="text-body font-semibold text-neutral-900 dark:text-surface-dark-text">
          Profile
        </h2>
      </header>
      <div class="flex items-center gap-3 px-5 py-4">
        <AvatarBadge v-if="auth.user" :value="auth.user.email" :size="40" />
        <div>
          <p class="text-body text-neutral-800 dark:text-surface-dark-text">
            {{ auth.user?.email }}
          </p>
          <p class="text-caption text-neutral-500 dark:text-surface-dark-muted">
            {{ auth.user ? ROLE_LABEL[auth.user.role] ?? auth.user.role : "" }}
          </p>
        </div>
      </div>
    </section>

    <!-- Organization -->
    <section
      class="mb-4 overflow-hidden rounded-lg border border-neutral-200 bg-white dark:border-surface-dark-border dark:bg-surface-dark-2"
    >
      <header class="border-b border-neutral-100 px-5 py-3 dark:border-surface-dark-border">
        <h2 class="text-body font-semibold text-neutral-900 dark:text-surface-dark-text">
          Organization
        </h2>
      </header>
      <dl class="divide-y divide-neutral-100 dark:divide-surface-dark-border">
        <div class="flex items-center justify-between px-5 py-3">
          <dt class="text-caption text-neutral-500 dark:text-surface-dark-muted">Name</dt>
          <dd class="text-body text-neutral-800 dark:text-surface-dark-text">
            {{ org.organization?.name ?? "-" }}
          </dd>
        </div>
        <div class="flex items-center justify-between px-5 py-3">
          <dt class="text-caption text-neutral-500 dark:text-surface-dark-muted">
            Created
          </dt>
          <dd class="text-body text-neutral-800 dark:text-surface-dark-text">
            {{
              org.organization ? relativeTime(org.organization.createdAt) : "-"
            }}
          </dd>
        </div>
      </dl>

      <div class="border-t border-neutral-100 px-5 py-3 dark:border-surface-dark-border">
        <p class="mb-2 text-caption font-medium text-neutral-500 dark:text-surface-dark-muted">
          Members ({{ members.length }})
        </p>
        <div class="flex flex-col gap-2">
          <div
            v-for="m in members"
            :key="m.id"
            class="flex items-center gap-2.5"
          >
            <AvatarBadge :value="m.email" :size="28" />
            <span class="flex-1 truncate text-caption text-neutral-700 dark:text-surface-dark-muted">
              {{ m.email }}
            </span>
            <span class="text-[11px] uppercase tracking-wide text-neutral-400 dark:text-surface-dark-faint">
              {{ ROLE_LABEL[m.role] ?? m.role }}
            </span>
          </div>
        </div>
      </div>

      <p class="border-t border-neutral-100 px-5 py-3 text-caption text-neutral-400 dark:border-surface-dark-border dark:text-surface-dark-faint">
        Signing up creates an organization with you as its owner. This build is
        single-user per organization - inviting teammates and managing roles are
        out of scope.
      </p>
    </section>

    <!-- Session -->
    <section
      class="flex items-center justify-between rounded-lg border border-neutral-200 bg-white px-5 py-4 dark:border-surface-dark-border dark:bg-surface-dark-2"
    >
      <div>
        <p class="text-body font-medium text-neutral-800 dark:text-surface-dark-text">
          Sign out
        </p>
        <p class="text-caption text-neutral-500 dark:text-surface-dark-muted">
          End your session on this device.
        </p>
      </div>
      <UiButton variant="secondary" size="sm" @click="signOut">Sign out</UiButton>
    </section>
  </div>
</template>
