import type { ResultadoCodigo } from '../adapters/autenticacao'

// A mesma resposta para e-mail inexistente, senha errada e conta bloqueada: quem tenta adivinhar não descobre qual foi.
export function erroDeLogin() {
  return createError({
    statusCode: 401,
    statusMessage: 'Unauthorized',
    message: 'E-mail ou senha incorretos. Depois de 5 tentativas erradas, o acesso fica bloqueado por 15 minutos.',
  })
}

// `motivo` deixa a tela voltar para a senha sem depender do texto da mensagem.
export function erroDeSessao() {
  return createError({ statusCode: 401, statusMessage: 'Unauthorized', message: 'Sessão inválida ou vencida. Entre de novo.', data: { motivo: 'sessao' } })
}

// Código errado, código já usado e conta bloqueada também dão a mesma resposta.
export function erroDeCodigo(tipo: Exclude<ResultadoCodigo['tipo'], 'ok'>) {
  if (tipo === 'sessao_invalida') return erroDeSessao()
  return createError({
    statusCode: 401,
    statusMessage: 'Unauthorized',
    message: 'Código incorreto ou já usado. Depois de 5 tentativas erradas, o acesso fica bloqueado por 15 minutos.',
  })
}
