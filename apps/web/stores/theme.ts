import { defineStore } from "pinia";

/** Light/dark theme via Tailwind's `darkMode: "class"` (.dark on <html>). */
export const useThemeStore = defineStore("theme", () => {
  const isDark = ref(false);

  function apply(): void {
    document.documentElement.classList.toggle("dark", isDark.value);
  }

  function set(dark: boolean): void {
    isDark.value = dark;
    apply();
    localStorage.setItem("theme", dark ? "dark" : "light");
  }

  function toggle(): void {
    set(!isDark.value);
  }

  /** Restore the saved choice, falling back to the OS preference. */
  function init(): void {
    const saved = localStorage.getItem("theme");
    isDark.value = saved
      ? saved === "dark"
      : window.matchMedia("(prefers-color-scheme: dark)").matches;
    apply();
  }

  return { isDark, set, toggle, init };
});
