import { estoqueBloqueio } from '../adapters/estoque-bloqueio'
import { estoqueCondicional } from '../adapters/estoque-condicional'
import type { Estoque, EstrategiaEstoque } from '../core/estoque'
import { criarBanco, type Banco } from '../db/cliente'

let banco: Banco | undefined
let estoqueAtual: Estoque | undefined

export function usarBanco(): Banco {
  if (!banco) {
    const { databaseUrl } = useRuntimeConfig()
    if (!databaseUrl) throw new Error('NUXT_DATABASE_URL não definida')
    banco = criarBanco(databaseUrl).db
  }
  return banco
}

export function usarEstoque(): Estoque {
  if (!estoqueAtual) {
    const estrategia = useRuntimeConfig().estrategiaEstoque as EstrategiaEstoque
    if (estrategia !== 'condicional' && estrategia !== 'bloqueio') {
      throw new Error(`NUXT_ESTRATEGIA_ESTOQUE inválida: ${estrategia}`)
    }
    estoqueAtual = estrategia === 'bloqueio' ? estoqueBloqueio(usarBanco()) : estoqueCondicional(usarBanco())
  }
  return estoqueAtual
}
