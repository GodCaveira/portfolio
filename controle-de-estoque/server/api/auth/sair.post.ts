// POST /api/auth/sair: apaga a sessão no banco, não só o cookie.
export default defineEventHandler(async (event) => {
  const token = lerTokenSessao(event)
  if (token) await usarAutenticacao().sair(token)
  apagarTokenSessao(event)
  setResponseStatus(event, 204)
  return null
})
