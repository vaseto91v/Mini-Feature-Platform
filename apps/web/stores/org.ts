import type { Organization } from "@mfp/shared";
import { defineStore } from "pinia";

/** Current tenant + its members (shared by the Members and Settings pages). */
export const useOrgStore = defineStore("org", () => {
  const api = useApi();
  const organization = ref<Organization | null>(null);
  const loading = ref(false);
  const loaded = ref(false);

  async function load(): Promise<void> {
    loading.value = true;
    try {
      organization.value = await api.get<Organization>("/organization");
      loaded.value = true;
    } finally {
      loading.value = false;
    }
  }

  return { organization, loading, loaded, load };
});
