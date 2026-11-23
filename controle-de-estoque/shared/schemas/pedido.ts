import { z } from 'zod'

// Validação na fronteira: tudo que entra pela API passa por aqui.
// O cliente é uma referência opaca, não um nome, para não guardar dado pessoal.
export const novoPedido = z.object({
  produtoId: z.number().int().positive(),
  clienteRef: z.string().regex(/^[a-z0-9-]{1,40}$/, 'use de 1 a 40 caracteres: a-z, 0-9 ou hífen'),
})

export type NovoPedido = z.infer<typeof novoPedido>
