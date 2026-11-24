import { describe, expect, it } from 'vitest'
import { criarCifra } from '../server/core/cifra'
import { gerarHashSenha, verificarSenha } from '../server/core/senha'
import { gerarCodigosRecuperacao, normalizarCodigoRecuperacao } from '../server/core/tokens'
import { base32, codigoTotp, deBase32, verificarTotp } from '../server/core/totp'

// Peças puras, sem banco.
describe('TOTP (RFC 6238)', () => {
  // Vetores do apêndice B da RFC, com o segredo ASCII "12345678901234567890" e 8 dígitos.
  const segredoRfc = base32(Buffer.from('12345678901234567890'))
  it.each([
    [59, '94287082'],
    [1111111109, '07081804'],
    [1111111111, '14050471'],
    [1234567890, '89005924'],
    [2000000000, '69279037'],
    [20000000000, '65353130'],
  ])('instante %i gera %s', (segundos, esperado) => {
    expect(codigoTotp(segredoRfc, Math.floor(segundos / 30), 8)).toBe(esperado)
  })

  it('base32 ida e volta', () => {
    const bytes = Buffer.from([0, 1, 2, 250, 251, 252, 253, 254, 255])
    expect(deBase32(base32(bytes))).toEqual(bytes)
  })

  it('aceita o passo anterior e o seguinte, e recusa dois passos de distância', () => {
    const agora = new Date(1_700_000_000_000)
    const passo = Math.floor(agora.getTime() / 30_000)
    expect(verificarTotp(segredoRfc, codigoTotp(segredoRfc, passo - 1), agora)).toBe(passo - 1)
    expect(verificarTotp(segredoRfc, codigoTotp(segredoRfc, passo + 1), agora)).toBe(passo + 1)
    expect(verificarTotp(segredoRfc, codigoTotp(segredoRfc, passo - 2), agora)).toBeNull()
    expect(verificarTotp(segredoRfc, 'abc123', agora)).toBeNull()
  })
})

describe('senha', () => {
  it('confere a senha certa e recusa a errada', async () => {
    const hash = await gerarHashSenha('senha-de-teste-longa')
    expect(hash.startsWith('scrypt$')).toBe(true)
    expect(await verificarSenha('senha-de-teste-longa', hash)).toBe(true)
    expect(await verificarSenha('senha-de-teste-errada', hash)).toBe(false)
  })

  it('a mesma senha gera hashes diferentes (sal aleatório)', async () => {
    expect(await gerarHashSenha('igual')).not.toBe(await gerarHashSenha('igual'))
  })
})

describe('cifra do segredo TOTP', () => {
  const cifra = criarCifra('chave-de-teste-com-mais-de-32-caracteres')

  it('decifra o que cifrou e não guarda o texto aberto', () => {
    const cifrado = cifra.cifrar('JBSWY3DPEHPK3PXP')
    expect(cifrado).not.toContain('JBSWY3DPEHPK3PXP')
    expect(cifra.decifrar(cifrado)).toBe('JBSWY3DPEHPK3PXP')
  })

  it('recusa dado adulterado e chave errada', () => {
    const cifrado = cifra.cifrar('JBSWY3DPEHPK3PXP')
    const partes = cifrado.split('.')
    partes[3] = Buffer.from('outro conteúdo').toString('base64url')
    expect(() => cifra.decifrar(partes.join('.'))).toThrow()
    expect(() => criarCifra('outra-chave-de-teste-com-mais-de-32-caracteres').decifrar(cifrado)).toThrow()
  })

  it('recusa chave curta', () => {
    expect(() => criarCifra('curta')).toThrow()
  })
})

describe('códigos de recuperação', () => {
  it('gera 10 códigos diferentes no formato xxxxx-xxxxx', () => {
    const codigos = gerarCodigosRecuperacao()
    expect(codigos).toHaveLength(10)
    expect(new Set(codigos).size).toBe(10)
    for (const c of codigos) expect(c).toMatch(/^[a-z2-7]{5}-[a-z2-7]{5}$/)
  })

  it('aceita o código sem hífen e em maiúsculas', () => {
    expect(normalizarCodigoRecuperacao('ABCDE23456')).toBe('abcde-23456')
    expect(normalizarCodigoRecuperacao(' abcde-23456 ')).toBe('abcde-23456')
    expect(normalizarCodigoRecuperacao('curto')).toBe('')
  })
})
