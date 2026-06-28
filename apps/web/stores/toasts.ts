import { defineStore } from "pinia";

export interface ToastAction {
  label: string;
  onClick: () => void;
  danger?: boolean;
}

export interface Toast {
  id: string;
  variant: "success" | "error" | "info";
  title: string;
  subtitle?: string;
  actions?: ToastAction[];
  /** ms before auto-dismiss; 0 = sticky. */
  timeout?: number;
}

export const useToastStore = defineStore("toasts", () => {
  const items = ref<Toast[]>([]);

  function dismiss(id: string): void {
    items.value = items.value.filter((t) => t.id !== id);
  }

  function push(toast: Omit<Toast, "id">): string {
    const id = crypto.randomUUID();
    items.value.push({ id, ...toast });
    // Errors are sticky by default (they often carry a Retry action).
    const timeout = toast.timeout ?? (toast.variant === "error" ? 0 : 4000);
    if (timeout > 0) setTimeout(() => dismiss(id), timeout);
    return id;
  }

  const success = (title: string, subtitle?: string) =>
    push({ variant: "success", title, subtitle });
  const error = (title: string, subtitle?: string, actions?: ToastAction[]) =>
    push({ variant: "error", title, subtitle, actions });
  const info = (title: string, subtitle?: string, actions?: ToastAction[]) =>
    push({ variant: "info", title, subtitle, actions });

  return { items, push, dismiss, success, error, info };
});
