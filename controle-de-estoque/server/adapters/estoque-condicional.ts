import { and, eq, gt, sql } from 'drizzle-orm'
import type { Estoque, ResultadoCompra } from '../core/estoque'
import type { Banco } from '../db/cliente'
import { pedido, produto } from '../db/schema'

// Técnica 1: atualização condicional atômica.
// Um único UPDATE baixa o estoque só se ainda houver saldo. O banco serializa as
// escritas na mesma linha; quem chega depois reavalia o WHERE e não altera nada.
export function estoqueCondicional(db: Banco): Estoque {
  return {
    async comprarUnidade(produtoId, clienteRef): Promise<ResultadoCompra> {
      return db.transaction(async (tx) => {
        const baixados = await tx
          .update(produto)
          .set({ quantidade: sql`${produto.quantidade} - 1` })
          .where(and(eq(produto.id, produtoId), gt(produto.quantidade, 0)))
          .returning({ id: produto.id })

        if (baixados.length === 0) {
          const existe = await tx.select({ id: produto.id }).from(produto).where(eq(produto.id, produtoId))
          return existe.length === 0 ? { tipo: 'produto_inexistente' } : { tipo: 'esgotado' }
        }

        const [novo] = await tx.insert(pedido).values({ produtoId, clienteRef }).returning({ id: pedido.id })
        return { tipo: 'comprado', pedidoId: novo!.id }
      })
    },
  }
}
