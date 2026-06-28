// Apply the saved/OS theme as the app boots (before first paint).
export default defineNuxtPlugin(() => {
  useThemeStore().init();
});
