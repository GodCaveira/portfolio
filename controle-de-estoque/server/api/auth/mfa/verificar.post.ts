import { codigoMfa } from '#shared/schemas/painel'

// POST /api/auth/mfa/verificar { codigo } -> 204
// Aceita o código de 6 dígitos do autenticador ou um código de recuperação.
export default defineEventHandler(async (event) => {
  const { token } = await exigirSessao(event, 'mfa')
  const { codigo } = await readValidatedBody(event, codigoMfa.parse)
  const resultado = await usarAutenticacao().verificarMfa(token, codigo)

  if (resultado.tipo !== 'ok') throw erroDeCodigo(resultado.tipo)
  gravarTokenSessao(event, resultado.token, 'completa')
  setResponseStatus(event, 204)
  return null
})
