const PUBLIC_ROUTES = new Set(["/login", "/register"]);

export default defineNuxtRouteMiddleware(async (to) => {
  const auth = useAuthStore();
  if (!auth.initialized) await auth.init();

  const isPublic = PUBLIC_ROUTES.has(to.path);
  if (!auth.isAuthenticated && !isPublic) {
    return navigateTo("/login");
  }
  if (auth.isAuthenticated && isPublic) {
    return navigateTo("/");
  }
});
