import { credenciais } from '#shared/schemas/painel'

// POST /api/auth/entrar { email, senha } -> { etapa: 'mfa' | 'cadastro_mfa' }
export default defineEventHandler(async (event) => {
  const { email, senha } = await readValidatedBody(event, credenciais.parse)
  const resultado = await usarAutenticacao().entrarComSenha(email, senha)
  if (resultado.tipo !== 'ok') throw erroDeLogin()

  gravarTokenSessao(event, resultado.token, resultado.etapa)
  return { etapa: resultado.etapa }
})
