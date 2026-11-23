import { drizzle } from 'drizzle-orm/postgres-js'
import postgres from 'postgres'
import * as schema from './schema'

export function criarBanco(url: string, maxConexoes = 10) {
  const sql = postgres(url, { max: maxConexoes })
  return { db: drizzle(sql, { schema }), fechar: () => sql.end() }
}

export type Banco = ReturnType<typeof criarBanco>['db']
