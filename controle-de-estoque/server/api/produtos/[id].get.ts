import { eq } from 'drizzle-orm'
import { z } from 'zod'
import { produto } from '../../db/schema'

const parametros = z.object({ id: z.coerce.number().int().positive() })

// GET /api/produtos/:id: saldo atual, para conferir o resultado da disputa.
export default defineEventHandler(async (event) => {
  const { id } = await getValidatedRouterParams(event, parametros.parse)
  const [linha] = await usarBanco().select().from(produto).where(eq(produto.id, id))
  if (!linha) throw createError({ statusCode: 404, statusMessage: 'Produto não encontrado' })
  return linha
})
