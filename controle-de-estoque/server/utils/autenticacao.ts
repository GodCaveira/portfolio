import type { H3Event } from 'h3'
import { criarAutenticacao, DURACAO_SESSAO, type Autenticacao, type SessaoAtiva } from '../adapters/autenticacao'
import { criarCifra } from '../core/cifra'
import type { EtapaSessao } from '../db/schema'

let autenticacao: Autenticacao | undefined

export function usarAutenticacao(): Autenticacao {
  if (!autenticacao) {
    const { totpChave } = useRuntimeConfig()
    autenticacao = criarAutenticacao(usarBanco(), criarCifra(totpChave))
  }
  return autenticacao
}

// __Host-: o navegador só aceita o cookie com Secure, Path=/ e sem Domain, então um subdomínio não o sobrescreve.
// Navegadores tratam 127.0.0.1 e localhost como contexto seguro, então funciona no teste local em HTTP.
const COOKIE = '__Host-sessao'
const OPCOES = { httpOnly: true, secure: true, sameSite: 'strict', path: '/' } as const

export function lerTokenSessao(event: H3Event): string | undefined {
  return getCookie(event, COOKIE)
}

export function gravarTokenSessao(event: H3Event, token: string, etapa: EtapaSessao) {
  setCookie(event, COOKIE, token, { ...OPCOES, maxAge: DURACAO_SESSAO[etapa] })
}

export function apagarTokenSessao(event: H3Event) {
  deleteCookie(event, COOKIE, OPCOES)
}

export async function exigirSessao(event: H3Event, etapa: EtapaSessao): Promise<SessaoAtiva & { token: string }> {
  const token = lerTokenSessao(event)
  const atual = token ? await usarAutenticacao().sessao(token) : null
  if (!token || !atual || atual.etapa !== etapa) throw erroDeSessao()
  return { ...atual, token }
}
