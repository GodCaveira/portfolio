import { createHash, randomBytes } from 'node:crypto'
import { base32 } from './totp'

// Token de sessão: 32 bytes aleatórios no cookie; o banco guarda só o SHA-256,
// então um vazamento do banco não entrega sessões válidas.
export function novoTokenSessao(): string {
  return randomBytes(32).toString('base64url')
}

// Códigos de recuperação têm 50 bits aleatórios cada, então SHA-256 basta (não precisam de hash lento).
export function hashSegredo(valor: string): string {
  return createHash('sha256').update(valor).digest('hex')
}

export const QUANTIDADE_CODIGOS = 10

// Formato xxxxx-xxxxx em base32 minúsculo, fácil de copiar à mão.
export function gerarCodigosRecuperacao(): string[] {
  return Array.from({ length: QUANTIDADE_CODIGOS }, () => {
    const texto = base32(randomBytes(7)).slice(0, 10).toLowerCase()
    return `${texto.slice(0, 5)}-${texto.slice(5)}`
  })
}

// Aceita o código com ou sem hífen, maiúsculo ou minúsculo.
export function normalizarCodigoRecuperacao(codigo: string): string {
  const limpo = codigo.toLowerCase().replace(/[^a-z2-7]/g, '')
  return limpo.length === 10 ? `${limpo.slice(0, 5)}-${limpo.slice(5)}` : ''
}
