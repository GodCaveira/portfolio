import { novoPedido } from '#shared/schemas/pedido'

// POST /api/pedidos { produtoId, clienteRef }
// 201 com o pedido, 409 se esgotou, 404 se o produto não existe, 400 se o corpo é inválido.
export default defineEventHandler(async (event) => {
  const corpo = await readValidatedBody(event, novoPedido.parse)
  const resultado = await usarEstoque().comprarUnidade(corpo.produtoId, corpo.clienteRef)

  switch (resultado.tipo) {
    case 'comprado':
      setResponseStatus(event, 201)
      return { pedidoId: resultado.pedidoId }
    case 'esgotado':
      throw createError({ statusCode: 409, statusMessage: 'Produto esgotado' })
    case 'produto_inexistente':
      throw createError({ statusCode: 404, statusMessage: 'Produto não encontrado' })
  }
})
