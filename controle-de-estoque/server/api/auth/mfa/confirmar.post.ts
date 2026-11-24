import { codigoMfa } from '#shared/schemas/painel'

// POST /api/auth/mfa/confirmar { codigo } -> { codigosRecuperacao }
// Os códigos de recuperação aparecem só aqui, uma única vez; o banco guarda apenas o hash.
export default defineEventHandler(async (event) => {
  const { token } = await exigirSessao(event, 'cadastro_mfa')
  const { codigo } = await readValidatedBody(event, codigoMfa.parse)
  const resultado = await usarAutenticacao().confirmarCadastroMfa(token, codigo)

  if (resultado.tipo !== 'ok') throw erroDeCodigo(resultado.tipo)
  gravarTokenSessao(event, resultado.token, 'completa')
  setResponseHeader(event, 'Cache-Control', 'no-store')
  return { codigosRecuperacao: resultado.codigosRecuperacao }
})
