// GET /api/auth/sessao -> { etapa, email } ou 401. A tela usa para decidir a próxima página.
export default defineEventHandler(async (event) => {
  const token = lerTokenSessao(event)
  const atual = token ? await usarAutenticacao().sessao(token) : null
  if (!atual) throw createError({ statusCode: 401, message: 'Sem sessão' })
  return { etapa: atual.etapa, email: atual.email }
})
