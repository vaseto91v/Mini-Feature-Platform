<script setup lang="ts">
import { loginInputSchema } from "@mfp/shared";

definePageMeta({ layout: "auth" });

const auth = useAuthStore();
const router = useRouter();

const email = ref("");
const password = ref("");
const errors = ref<Record<string, string>>({});
const error = ref("");
const loading = ref(false);

async function submit(): Promise<void> {
  error.value = "";
  // Validate against the same schema the API enforces (@mfp/shared).
  const result = validateWith(loginInputSchema, {
    email: email.value,
    password: password.value,
  });
  errors.value = result.errors;
  if (!result.success) return;

  loading.value = true;
  try {
    await auth.login(result.data);
    router.push("/");
  } catch (err) {
    error.value = err instanceof ApiError ? err.message : "Sign in failed";
  } finally {
    loading.value = false;
  }
}
</script>

<template>
  <div class="w-[340px] rounded-xl bg-white p-7 shadow-pop dark:bg-surface-dark-2">
    <div class="mb-5 flex justify-center">
      <AppLogo :size="26" />
    </div>
    <h1 class="mb-5 text-center text-heading font-semibold text-neutral-900 dark:text-surface-dark-text">
      Sign in to your workspace
    </h1>
    <form class="flex flex-col gap-3.5" @submit.prevent="submit">
      <UiTextField
        v-model="email"
        label="Email"
        type="email"
        placeholder="you@company.com"
        autocomplete="email"
        :error="errors.email"
        required
      />
      <UiTextField
        v-model="password"
        label="Password"
        type="password"
        placeholder="••••••••"
        autocomplete="current-password"
        :error="errors.password"
        required
      />
      <p v-if="error" class="text-caption text-accent-red">{{ error }}</p>
      <UiButton type="submit" :loading="loading" block>Sign in</UiButton>
    </form>
    <p class="mt-5 text-center text-caption text-neutral-500 dark:text-surface-dark-muted">
      No account?
      <NuxtLink to="/register" class="font-medium text-primary hover:underline">
        Create an organization
      </NuxtLink>
    </p>
  </div>
</template>
