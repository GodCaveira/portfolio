import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'node:crypto'

// AES-256-GCM para o segredo TOTP guardado no banco: quem só tem uma cópia do banco não gera códigos.
// A chave vem do ambiente (fora do git) e é reduzida a 32 bytes por SHA-256; por isso exige texto longo e aleatório.
export interface Cifra {
  cifrar(texto: string): string
  decifrar(cifrado: string): string
}

export function criarCifra(chaveTexto: string): Cifra {
  if (chaveTexto.length < 32) throw new Error('A chave de cifra precisa de pelo menos 32 caracteres')
  const chave = createHash('sha256').update(chaveTexto).digest()

  return {
    cifrar(texto) {
      const iv = randomBytes(12)
      const cifra = createCipheriv('aes-256-gcm', chave, iv)
      const corpo = Buffer.concat([cifra.update(texto, 'utf8'), cifra.final()])
      return ['v1', iv, cifra.getAuthTag(), corpo].map((p) => (typeof p === 'string' ? p : p.toString('base64url'))).join('.')
    },
    decifrar(cifrado) {
      const [versao, iv, tag, corpo] = cifrado.split('.')
      if (versao !== 'v1' || !iv || !tag || !corpo) throw new Error('Formato de dado cifrado desconhecido')
      const decifra = createDecipheriv('aes-256-gcm', chave, Buffer.from(iv, 'base64url'))
      decifra.setAuthTag(Buffer.from(tag, 'base64url'))
      return Buffer.concat([decifra.update(Buffer.from(corpo, 'base64url')), decifra.final()]).toString('utf8')
    },
  }
}
