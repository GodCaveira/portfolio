import { simulacao } from '#shared/schemas/painel'
import { eq } from 'drizzle-orm'
import { produto } from '../../db/schema'

// POST /api/painel/simulacao { produtoId, clientes } -> { comprados, esgotados, saldo }
// Dispara N compras ao mesmo tempo pelo mesmo caminho da API pública, para ver a disputa pela tela.
export default defineEventHandler(async (event) => {
  const { produtoId, clientes } = await readValidatedBody(event, simulacao.parse)
  const estoque = usarEstoque()
  const resultados = await Promise.all(
    Array.from({ length: clientes }, (_, i) => estoque.comprarUnidade(produtoId, `simulacao-${i + 1}`)),
  )
  if (resultados.some((r) => r.tipo === 'produto_inexistente')) {
    throw createError({ statusCode: 404, message: 'Produto não encontrado' })
  }
  const [linha] = await usarBanco().select({ saldo: produto.quantidade }).from(produto).where(eq(produto.id, produtoId))
  return {
    estrategia: useRuntimeConfig().estrategiaEstoque,
    clientes,
    comprados: resultados.filter((r) => r.tipo === 'comprado').length,
    esgotados: resultados.filter((r) => r.tipo === 'esgotado').length,
    saldo: linha?.saldo ?? 0,
  }
})
