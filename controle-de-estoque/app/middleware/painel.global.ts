// Leva cada etapa do login para a sua página. A tela só organiza a navegação:
// quem garante o acesso é a API, que confere a sessão em toda rota /api/painel.
const PAGINA_DA_ETAPA = {
  sem_sessao: '/painel/entrar',
  mfa: '/painel/verificacao',
  cadastro_mfa: '/painel/cadastro-mfa',
  completa: '/painel',
} as const

export default defineNuxtRouteMiddleware(async (para) => {
  if (!para.path.startsWith('/painel')) return

  let etapa: keyof typeof PAGINA_DA_ETAPA = 'sem_sessao'
  try {
    etapa = (await $fetch('/api/auth/sessao')).etapa
  } catch {
    // 401: sem sessão.
  }
  const destino = PAGINA_DA_ETAPA[etapa]
  if (para.path !== destino) return navigateTo(destino, { replace: true })
})
