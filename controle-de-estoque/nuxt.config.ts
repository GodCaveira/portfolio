export default defineNuxtConfig({
  compatibilityDate: '2026-11-01',
  devtools: { enabled: false },
  typescript: { strict: true },
  runtimeConfig: {
    // Preenchidos por variáveis de ambiente: NUXT_DATABASE_URL e NUXT_ESTRATEGIA_ESTOQUE.
    databaseUrl: '',
    estrategiaEstoque: 'condicional',
  },
})
