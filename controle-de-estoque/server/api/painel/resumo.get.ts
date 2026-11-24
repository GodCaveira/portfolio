import { asc, desc, eq } from 'drizzle-orm'
import type { SessaoAtiva } from '../../adapters/autenticacao'
import { pedido, produto } from '../../db/schema'

// GET /api/painel/resumo: produtos, últimos pedidos, técnica em uso e códigos de recuperação restantes.
export default defineEventHandler(async (event) => {
  // Preenchido pelo middleware do painel. O tipo explícito vale também para a tela, que não enxerga a extensão do contexto.
  const administrador: SessaoAtiva = event.context.administrador!
  const db = usarBanco()
  const [produtos, pedidos, codigosRestantes] = await Promise.all([
    db.select().from(produto).orderBy(asc(produto.id)),
    db
      .select({ id: pedido.id, produto: produto.nome, clienteRef: pedido.clienteRef, criadoEm: pedido.criadoEm })
      .from(pedido)
      .innerJoin(produto, eq(produto.id, pedido.produtoId))
      .orderBy(desc(pedido.id))
      .limit(20),
    usarAutenticacao().codigosRestantes(administrador.administradorId),
  ])
  return {
    administrador: administrador.email,
    estrategia: useRuntimeConfig().estrategiaEstoque,
    codigosRestantes,
    produtos,
    pedidos,
  }
})
