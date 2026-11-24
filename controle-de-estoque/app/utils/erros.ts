type ErroDaApi = { data?: { message?: string; data?: { motivo?: string } } }

// Mensagem que a API mandou (sempre em português), ou uma genérica se nem chegou resposta.
export function mensagemDeErro(erro: unknown): string {
  return (erro as ErroDaApi)?.data?.message || 'Não foi possível falar com o servidor. Tente de novo.'
}

// Sessão vencida ou ausente: a tela volta para a senha.
export function sessaoPerdida(erro: unknown): boolean {
  return (erro as ErroDaApi)?.data?.data?.motivo === 'sessao'
}
