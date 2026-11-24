import { renderSVG } from 'uqr'

// POST /api/auth/mfa/cadastro -> { segredo, uri, qrSvg }
// Gera um segredo novo a cada chamada; ele só passa a valer depois de confirmado com um código.
export default defineEventHandler(async (event) => {
  const { token } = await exigirSessao(event, 'cadastro_mfa')
  const cadastro = await usarAutenticacao().iniciarCadastroMfa(token)
  if (!cadastro) throw erroDeSessao()

  // O segredo aparece só nesta resposta; ela não pode ficar em cache.
  setResponseHeader(event, 'Cache-Control', 'no-store')
  return { ...cadastro, qrSvg: renderSVG(cadastro.uri, { border: 2 }) }
})
