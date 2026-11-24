import { z } from 'zod'

export const credenciais = z.object({
  email: z.email().max(200),
  senha: z.string().min(1).max(200),
})

// 6 dígitos do aplicativo autenticador ou um código de recuperação (xxxxx-xxxxx).
export const codigoMfa = z.object({
  codigo: z.string().trim().min(6).max(20),
})

export const ajusteEstoque = z.object({
  quantidade: z.number().int().min(0).max(100_000),
})

export const idProduto = z.object({
  id: z.coerce.number().int().positive(),
})

export const simulacao = z.object({
  produtoId: z.number().int().positive(),
  clientes: z.number().int().min(2).max(100),
})
