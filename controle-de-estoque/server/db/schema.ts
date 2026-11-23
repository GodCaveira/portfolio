import { integer, pgTable, serial, text, timestamp } from 'drizzle-orm/pg-core'

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
