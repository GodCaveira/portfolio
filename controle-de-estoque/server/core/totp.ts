import { createHmac, randomBytes } from 'node:crypto'

// TOTP da RFC 6238 (HMAC-SHA1, passo de 30 s, 6 dígitos): o formato que os aplicativos autenticadores leem.
const PASSO_SEGUNDOS = 30
const DIGITOS = 6
// Aceita o passo anterior e o seguinte, para tolerar relógio um pouco fora e o tempo de digitar.
const JANELA = 1

const ALFABETO = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567'

export function base32(bytes: Buffer): string {
  let bits = 0
  let valor = 0
  let saida = ''
  for (const byte of bytes) {
    valor = (valor << 8) | byte
    bits += 8
    while (bits >= 5) {
      saida += ALFABETO[(valor >>> (bits - 5)) & 31]
      bits -= 5
    }
  }
  if (bits > 0) saida += ALFABETO[(valor << (5 - bits)) & 31]
  return saida
}

export function deBase32(texto: string): Buffer {
  let bits = 0
  let valor = 0
  const bytes: number[] = []
  for (const letra of texto.replace(/=+$/, '').toUpperCase()) {
    const indice = ALFABETO.indexOf(letra)
    if (indice < 0) throw new Error('Segredo base32 inválido')
    valor = (valor << 5) | indice
    bits += 5
    if (bits >= 8) {
      bytes.push((valor >>> (bits - 8)) & 255)
      bits -= 8
    }
  }
  return Buffer.from(bytes)
}

// 20 bytes (160 bits), o tamanho recomendado pela RFC 4226 para HMAC-SHA1.
export function gerarSegredoTotp(): string {
  return base32(randomBytes(20))
}

export function passoAtual(agora: Date): number {
  return Math.floor(agora.getTime() / 1000 / PASSO_SEGUNDOS)
}

export function codigoTotp(segredo: string, passo: number, digitos = DIGITOS): string {
  const contador = Buffer.alloc(8)
  contador.writeBigUInt64BE(BigInt(passo))
  const hmac = createHmac('sha1', deBase32(segredo)).update(contador).digest()
  const deslocamento = hmac[hmac.length - 1]! & 0x0f
  const numero = hmac.readUInt32BE(deslocamento) & 0x7fffffff
  return String(numero % 10 ** digitos).padStart(digitos, '0')
}

// Devolve o passo em que o código vale, ou null. Quem chama ainda precisa recusar passo já usado.
export function verificarTotp(segredo: string, codigo: string, agora: Date): number | null {
  if (!/^\d{6}$/.test(codigo)) return null
  const atual = passoAtual(agora)
  for (let d = -JANELA; d <= JANELA; d++) {
    if (codigoTotp(segredo, atual + d) === codigo) return atual + d
  }
  return null
}

export function uriOtpauth(segredo: string, conta: string, emissor: string): string {
  const rotulo = encodeURIComponent(`${emissor}:${conta}`)
  const params = new URLSearchParams({ secret: segredo, issuer: emissor, algorithm: 'SHA1', digits: '6', period: '30' })
  return `otpauth://totp/${rotulo}?${params}`
}
