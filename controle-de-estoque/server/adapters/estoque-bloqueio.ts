import { eq } from 'drizzle-orm'
import type { Estoque, ResultadoCompra } from '../core/estoque'
import type { Banco } from '../db/cliente'
import { pedido, produto } from '../db/schema'

// Técnica 2: bloqueio de linha (SELECT ... FOR UPDATE).
// A transação trava a linha do produto ao ler. Outra transação que queira a mesma
// linha espera até a primeira terminar e então lê o saldo já atualizado.
export function estoqueBloqueio(db: Banco): Estoque {
  return {
    async comprarUnidade(produtoId, clienteRef): Promise<ResultadoCompra> {
      return db.transaction(async (tx) => {
        const [linha] = await tx
          .select({ quantidade: produto.quantidade })
          .from(produto)
          .where(eq(produto.id, produtoId))
          .for('update')

        if (!linha) return { tipo: 'produto_inexistente' }
        if (linha.quantidade < 1) return { tipo: 'esgotado' }

        await tx.update(produto).set({ quantidade: linha.quantidade - 1 }).where(eq(produto.id, produtoId))
        const [novo] = await tx.insert(pedido).values({ produtoId, clienteRef }).returning({ id: pedido.id })
        return { tipo: 'comprado', pedidoId: novo!.id }
      })
    },
  }
}
