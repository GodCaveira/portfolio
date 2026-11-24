import { bigint, integer, pgTable, serial, text, timestamp } from 'drizzle-orm/pg-core'

// Espelha docker/postgres/01-init.sh, que cria as tabelas de verdade.
export const produto = pgTable('produto', {
  id: serial('id').primaryKey(),
  nome: text('nome').notNull(),
  quantidade: integer('quantidade').notNull(),
})

export const pedido = pgTable('pedido', {
  id: serial('id').primaryKey(),
  produtoId: integer('produto_id').notNull().references(() => produto.id),
  clienteRef: text('cliente_ref').notNull(),
  criadoEm: timestamp('criado_em', { withTimezone: true }).notNull().defaultNow(),
})

export const administrador = pgTable('administrador', {
  id: serial('id').primaryKey(),
  email: text('email').notNull().unique(),
  senhaHash: text('senha_hash').notNull(),
  totpCifrado: text('totp_cifrado'),
  totpUltimoPasso: bigint('totp_ultimo_passo', { mode: 'number' }),
  tentativas: integer('tentativas').notNull().default(0),
  bloqueadoAte: timestamp('bloqueado_ate', { withTimezone: true }),
})

export const codigoRecuperacao = pgTable('codigo_recuperacao', {
  id: serial('id').primaryKey(),
  administradorId: integer('administrador_id').notNull().references(() => administrador.id),
  hash: text('hash').notNull(),
  usadoEm: timestamp('usado_em', { withTimezone: true }),
})

export type EtapaSessao = 'mfa' | 'cadastro_mfa' | 'completa'

export const sessao = pgTable('sessao', {
  tokenHash: text('token_hash').primaryKey(),
  administradorId: integer('administrador_id').notNull().references(() => administrador.id),
  etapa: text('etapa').$type<EtapaSessao>().notNull(),
  totpPendenteCifrado: text('totp_pendente_cifrado'),
  expiraEm: timestamp('expira_em', { withTimezone: true }).notNull(),
})
