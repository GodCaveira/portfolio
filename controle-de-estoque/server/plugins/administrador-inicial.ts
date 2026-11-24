// Primeiro administrador vem do ambiente (NUXT_ADMIN_EMAIL e NUXT_ADMIN_SENHA), só se o banco ainda não tiver nenhum.
// Não há cadastro público. O MFA é cadastrado no primeiro login, pelo próprio painel.
export default defineNitroPlugin(() => {
  const { adminEmail, adminSenha } = useRuntimeConfig()
  if (!adminEmail || !adminSenha) {
    console.warn('[painel] NUXT_ADMIN_EMAIL ou NUXT_ADMIN_SENHA não definidos: nenhum administrador inicial será criado.')
    return
  }
  if (adminSenha.length < 12) {
    console.error('[painel] NUXT_ADMIN_SENHA precisa de pelo menos 12 caracteres; administrador inicial não criado.')
    return
  }
  usarAutenticacao()
    .garantirAdministradorInicial(adminEmail, adminSenha)
    .then((criado) => criado && console.info('[painel] Administrador inicial criado. Cadastre o MFA no primeiro login.'))
    .catch((erro: unknown) => console.error('[painel] Falha ao criar o administrador inicial:', erro))
})
