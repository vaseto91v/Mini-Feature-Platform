// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  // Static SPA - no SSR (authenticated, highly interactive app; deploys to S3/CloudFront).
  ssr: false,
  compatibilityDate: "2024-11-01",
  devtools: { enabled: false },

  modules: ["@pinia/nuxt", "@nuxtjs/tailwindcss"],

  tailwindcss: { cssPath: "~/assets/css/main.css" },

  devServer: { port: 3001 },

  runtimeConfig: {
    public: {
      apiBase: process.env.NUXT_PUBLIC_API_BASE ?? "http://localhost:3000",
    },
  },

  app: {
    head: {
      title: "Mini Feature Platform",
      htmlAttrs: { lang: "en" },
      meta: [{ name: "viewport", content: "width=device-width, initial-scale=1" }],
      link: [
        { rel: "preconnect", href: "https://fonts.googleapis.com" },
        { rel: "preconnect", href: "https://fonts.gstatic.com", crossorigin: "" },
        {
          rel: "stylesheet",
          href: "https://fonts.googleapis.com/css2?family=Geist:wght@400;500;600&family=Geist+Mono:wght@400;500&display=swap",
        },
      ],
    },
  },

  typescript: { strict: true },
});
