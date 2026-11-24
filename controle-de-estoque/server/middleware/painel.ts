import type { SessaoAtiva } from '../adapters/autenticacao'

declare module 'h3' {
  interface H3EventContext {
    administrador?: SessaoAtiva
  }
}

// Uma regra só para todo o painel: rota nova em /api/painel já nasce exigindo login completo.
export default defineEventHandler(async (event) => {
  const caminho = event.path
  const protegido = caminho.startsWith('/api/painel/') || caminho.startsWith('/api/auth/')
  if (!protegido) return

  // Defesa extra contra CSRF, além do SameSite=Strict: pedido que muda estado vindo de outra origem é recusado.
  if (!['GET', 'HEAD', 'OPTIONS'].includes(event.method)) {
    const origem = getRequestHeader(event, 'origin')
    if (origem && !mesmaOrigem(origem, getRequestHost(event))) {
      throw createError({ statusCode: 403, statusMessage: 'Forbidden', message: 'Origem não permitida' })
    }
  }

  if (caminho.startsWith('/api/painel/')) {
    event.context.administrador = await exigirSessao(event, 'completa')
  }
})

function mesmaOrigem(origem: string, host: string): boolean {
  try {
    return new URL(origem).host === host
  } catch {
    return false
  }
}
