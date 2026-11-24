import tailwindcss from '@tailwindcss/vite'

export default defineNuxtConfig({
  compatibilityDate: '2026-11-01',
  devtools: { enabled: false },
  typescript: { strict: true },
  css: ['~/assets/css/main.css'],
  vite: { plugins: [tailwindcss()] },
  app: {
    head: {
      htmlAttrs: { lang: 'pt-BR' },
      title: 'Controle de estoque',
      meta: [{ name: 'robots', content: 'noindex' }],
    },
  },
  // O painel roda só no navegador: a tela pergunta à API em que etapa do login está.
  routeRules: {
    '/painel': { ssr: false },
    '/painel/**': { ssr: false },
  },
  runtimeConfig: {
    // Preenchidos por variáveis de ambiente NUXT_*, nunca pelo código.
    databaseUrl: '',
    estrategiaEstoque: 'condicional',
    totpChave: '',
    adminEmail: '',
    adminSenha: '',
  },
})
