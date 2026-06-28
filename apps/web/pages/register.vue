<script setup lang="ts">
import { registerInputSchema } from "@mfp/shared";

definePageMeta({ layout: "auth" });

const auth = useAuthStore();
const router = useRouter();

const organizationName = ref("");
const email = ref("");
const password = ref("");
const errors = ref<Record<string, string>>({});
const error = ref("");
const loading = ref(false);

async function submit(): Promise<void> {
  error.value = "";
  // Validate against the same schema the API enforces (@mfp/shared).
  const result = validateWith(registerInputSchema, {
    organizationName: organizationName.value,
    email: email.value,
    password: password.value,
  });
  errors.value = result.errors;
  if (!result.success) return;

  loading.value = true;
  try {
    await auth.register(result.data);
    router.push("/");
  } catch (err) {
    error.value =
      err instanceof ApiError ? err.message : "Could not create organization";
  } finally {
    loading.value = false;
  }
}
</script>

<template>
  <div class="w-[360px] rounded-xl bg-white p-7 shadow-pop dark:bg-surface-dark-2">
    <div class="mb-5 flex justify-center">
      <AppLogo :size="26" />
    </div>
    <h1 class="mb-5 text-center text-heading font-semibold text-neutral-900 dark:text-surface-dark-text">
      Create your organization
    </h1>
    <form class="flex flex-col gap-3.5" @submit.prevent="submit">
      <UiTextField
        v-model="organizationName"
        label="Organization name"
        placeholder="Acme Inc."
        :error="errors.organizationName"
        required
      />
      <UiTextField
        v-model="email"
        label="Work email"
        type="email"
        placeholder="you@acme.com"
        autocomplete="email"
        :error="errors.email"
        required
      />
      <UiTextField
        v-model="password"
        label="Password"
        type="password"
        placeholder="••••••••"
        autocomplete="new-password"
        hint="At least 8 characters."
        :error="errors.password"
        required
      />
      <p v-if="error" class="text-caption text-accent-red">{{ error }}</p>
      <UiButton type="submit" :loading="loading" block>
        Create organization
      </UiButton>
    </form>
    <p class="mt-5 text-center text-caption text-neutral-500 dark:text-surface-dark-muted">
      Already have an account?
      <NuxtLink to="/login" class="font-medium text-primary hover:underline">
        Sign in
      </NuxtLink>
    </p>
  </div>
</template>
