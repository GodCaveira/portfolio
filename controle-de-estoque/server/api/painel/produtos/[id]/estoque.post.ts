import { ajusteEstoque, idProduto } from '#shared/schemas/painel'
import { eq } from 'drizzle-orm'
import { produto } from '../../../../db/schema'

// POST /api/painel/produtos/:id/estoque { quantidade } -> produto atualizado
// Define o saldo (reposição ou correção de inventário). Não é o caminho da compra, que sempre baixa de 1 em 1.
export default defineEventHandler(async (event) => {
  const { id } = await getValidatedRouterParams(event, idProduto.parse)
  const { quantidade } = await readValidatedBody(event, ajusteEstoque.parse)
  const [atualizado] = await usarBanco().update(produto).set({ quantidade }).where(eq(produto.id, id)).returning()
  if (!atualizado) throw createError({ statusCode: 404, message: 'Produto não encontrado' })
  return atualizado
})
