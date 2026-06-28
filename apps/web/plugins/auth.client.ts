// Restore the session from the httpOnly refresh cookie before the app renders.
export default defineNuxtPlugin(async () => {
  const auth = useAuthStore();
  await auth.init();
});
