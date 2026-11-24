import { randomUUID } from 'node:crypto'
import postgres from 'postgres'
import { afterAll, describe, expect, it } from 'vitest'
import { criarAutenticacao, MAX_TENTATIVAS } from '../server/adapters/autenticacao'
import { criarCifra } from '../server/core/cifra'
import { gerarHashSenha } from '../server/core/senha'
import { codigoTotp, gerarSegredoTotp, passoAtual } from '../server/core/totp'
import { criarBanco } from '../server/db/cliente'

// Mesmo arranjo do teste de concorrência: o serviço usa o papel da aplicação; o administrador do banco
// só prepara e confere os dados.
const appUrl = process.env.TEST_APP_URL
const adminUrl = process.env.TEST_ADMIN_URL
if (!appUrl || !adminUrl) throw new Error('Defina TEST_APP_URL e TEST_ADMIN_URL')

const SENHA = 'senha-ficticia-de-teste'
const admin = postgres(adminUrl, { max: 1 })
const app = criarBanco(appUrl, 20)
const cifra = criarCifra('chave-de-teste-com-mais-de-32-caracteres')

// Relógio controlado: cada teste avança o tempo quando precisa de um código novo.
let instante = new Date('2026-01-01T12:00:00Z')
const auth = criarAutenticacao(app.db, cifra, { agora: () => instante })
const codigoAgora = (segredo: string) => codigoTotp(segredo, passoAtual(instante))
const avancar = (segundos: number) => (instante = new Date(instante.getTime() + segundos * 1000))

const criados: number[] = []
afterAll(async () => {
  if (criados.length) await admin`DELETE FROM administrador WHERE id IN ${admin(criados)}`
  await app.fechar()
  await admin.end()
})

// Conta com MFA já cadastrado (ou sem, para o teste de cadastro).
async function criarConta(comMfa = true) {
  const email = `teste-${randomUUID()}@exemplo.test`
  const segredo = gerarSegredoTotp()
  const [linha] = await admin<{ id: number }[]>`
    INSERT INTO administrador (email, senha_hash, totp_cifrado)
    VALUES (${email}, ${await gerarHashSenha(SENHA)}, ${comMfa ? cifra.cifrar(segredo) : null})
    RETURNING id`
  criados.push(linha!.id)
  return { id: linha!.id, email, segredo }
}

async function tokenParcial(email: string): Promise<string> {
  const r = await auth.entrarComSenha(email, SENHA)
  if (r.tipo !== 'ok') throw new Error(`login falhou: ${r.tipo}`)
  return r.token
}

const contar = <T extends { tipo: string }>(rs: T[], tipo: T['tipo']) => rs.filter((r) => r.tipo === tipo).length

describe('login com senha', () => {
  it('e-mail inexistente e senha errada dão o mesmo resultado', async () => {
    const { email } = await criarConta()
    expect(await auth.entrarComSenha('ninguem@exemplo.test', SENHA)).toEqual({ tipo: 'credenciais_invalidas' })
    expect(await auth.entrarComSenha(email, 'senha-errada')).toEqual({ tipo: 'credenciais_invalidas' })
  })

  it(`força bruta: depois de ${MAX_TENTATIVAS} senhas erradas, nem a senha certa entra`, async () => {
    const { email } = await criarConta()
    for (let i = 0; i < MAX_TENTATIVAS; i++) {
      expect((await auth.entrarComSenha(email, `errada-${i}`)).tipo).toBe('credenciais_invalidas')
    }
    expect(await auth.entrarComSenha(email, SENHA)).toEqual({ tipo: 'bloqueado' })
  })

  it(`força bruta em paralelo: de 50 tentativas simultâneas, só ${MAX_TENTATIVAS} são conferidas`, async () => {
    const { email } = await criarConta()
    const resultados = await Promise.all(Array.from({ length: 50 }, (_, i) => auth.entrarComSenha(email, `errada-${i}`)))
    expect(contar(resultados, 'credenciais_invalidas')).toBe(MAX_TENTATIVAS)
    expect(contar(resultados, 'bloqueado')).toBe(50 - MAX_TENTATIVAS)
  })

  it('bloqueio vencido libera a conta e recomeça a contagem', async () => {
    const { id, email } = await criarConta()
    await admin`UPDATE administrador SET tentativas = ${MAX_TENTATIVAS}, bloqueado_ate = now() - interval '1 second' WHERE id = ${id}`
    expect((await auth.entrarComSenha(email, SENHA)).tipo).toBe('ok')
    const [conta] = await admin<{ tentativas: number }[]>`SELECT tentativas FROM administrador WHERE id = ${id}`
    expect(conta!.tentativas).toBe(1)
  })

  it('senha certa sozinha não zera o contador (o código ainda conta)', async () => {
    const { email } = await criarConta()
    for (let i = 0; i < MAX_TENTATIVAS - 1; i++) await auth.entrarComSenha(email, `errada-${i}`)
    const token = await tokenParcial(email) // 5ª tentativa: certa, mas a conta já chega ao limite
    expect(await auth.verificarMfa(token, '000000')).toEqual({ tipo: 'bloqueado' })
  })
})

describe('cadastro do MFA no primeiro login', () => {
  it('senha certa leva ao cadastro; código certo conclui e entrega 10 códigos de recuperação', async () => {
    const { id, email } = await criarConta(false)
    const r = await auth.entrarComSenha(email, SENHA)
    expect(r).toMatchObject({ tipo: 'ok', etapa: 'cadastro_mfa' })
    const token = (r as { token: string }).token

    const cadastro = await auth.iniciarCadastroMfa(token)
    expect(cadastro!.uri).toContain('otpauth://totp/')
    expect(await auth.confirmarCadastroMfa(token, '000000')).toEqual({ tipo: 'codigo_invalido' })

    const ok = await auth.confirmarCadastroMfa(token, codigoAgora(cadastro!.segredo))
    expect(ok.tipo).toBe('ok')
    if (ok.tipo !== 'ok') return
    expect(ok.codigosRecuperacao).toHaveLength(10)
    expect(await auth.sessao(ok.token)).toMatchObject({ etapa: 'completa', email })
    // A sessão parcial foi trocada pela completa.
    expect(await auth.sessao(token)).toBeNull()

    // No banco: segredo cifrado (não o texto aberto) e códigos só como hash.
    const [conta] = await admin<{ totp_cifrado: string; tentativas: number }[]>`
      SELECT totp_cifrado, tentativas FROM administrador WHERE id = ${id}`
    expect(conta!.totp_cifrado).not.toContain(cadastro!.segredo)
    expect(conta!.tentativas).toBe(0)
    const hashes = await admin<{ hash: string }[]>`SELECT hash FROM codigo_recuperacao WHERE administrador_id = ${id}`
    expect(hashes.map((h) => h.hash)).not.toContain(ok.codigosRecuperacao[0])
  })

  it('sessão de cadastro não serve para pular para a verificação, e vice-versa', async () => {
    const semMfa = await criarConta(false)
    const comMfa = await criarConta(true)
    expect(await auth.verificarMfa(await tokenParcial(semMfa.email), '000000')).toEqual({ tipo: 'sessao_invalida' })
    expect(await auth.iniciarCadastroMfa(await tokenParcial(comMfa.email))).toBeNull()
  })
})

describe('código TOTP', () => {
  it('código certo conclui o login e zera o contador', async () => {
    const { id, email, segredo } = await criarConta()
    avancar(60)
    const r = await auth.verificarMfa(await tokenParcial(email), codigoAgora(segredo))
    expect(r.tipo).toBe('ok')
    if (r.tipo === 'ok') expect(await auth.sessao(r.token)).toMatchObject({ etapa: 'completa' })
    const [conta] = await admin<{ tentativas: number }[]>`SELECT tentativas FROM administrador WHERE id = ${id}`
    expect(conta!.tentativas).toBe(0)
  })

  it('reuso: o mesmo código não entra duas vezes', async () => {
    const { email, segredo } = await criarConta()
    avancar(60)
    const codigo = codigoAgora(segredo)
    expect((await auth.verificarMfa(await tokenParcial(email), codigo)).tipo).toBe('ok')
    expect(await auth.verificarMfa(await tokenParcial(email), codigo)).toEqual({ tipo: 'codigo_invalido' })
  })

  it('reuso em paralelo: o mesmo código em 4 sessões simultâneas entra exatamente 1 vez', async () => {
    const { email, segredo } = await criarConta()
    avancar(60)
    // 4 sessões parciais + 4 códigos = 8 tentativas: o contador volta a zero entre as duas fases,
    // senão o teste mediria o bloqueio, não o reuso.
    const tokens = [await tokenParcial(email), await tokenParcial(email), await tokenParcial(email), await tokenParcial(email)]
    await admin`UPDATE administrador SET tentativas = 0 WHERE email = ${email}`
    const codigo = codigoAgora(segredo)
    const resultados = await Promise.all(tokens.map((t) => auth.verificarMfa(t, codigo)))
    expect(contar(resultados, 'ok')).toBe(1)
    expect(contar(resultados, 'codigo_invalido')).toBe(3)
  })

  it('código de um passo já usado ou anterior é recusado', async () => {
    const { email, segredo } = await criarConta()
    avancar(60)
    const antigo = codigoAgora(segredo)
    avancar(30)
    expect((await auth.verificarMfa(await tokenParcial(email), codigoAgora(segredo))).tipo).toBe('ok')
    // O código antigo ainda estaria na janela de tolerância, mas o passo dele já ficou para trás.
    expect(await auth.verificarMfa(await tokenParcial(email), antigo)).toEqual({ tipo: 'codigo_invalido' })
  })

  it(`força bruta no código: depois de ${MAX_TENTATIVAS} códigos errados, nem o certo entra`, async () => {
    const { email, segredo } = await criarConta()
    const token = await tokenParcial(email) // 1 tentativa
    for (let i = 0; i < MAX_TENTATIVAS - 1; i++) {
      expect(await auth.verificarMfa(token, '000000')).toEqual({ tipo: 'codigo_invalido' })
    }
    avancar(60)
    expect(await auth.verificarMfa(token, codigoAgora(segredo))).toEqual({ tipo: 'bloqueado' })
  })
})

describe('código de recuperação', () => {
  async function contaComCodigos() {
    const conta = await criarConta(false)
    const r = await auth.entrarComSenha(conta.email, SENHA)
    const token = (r as { token: string }).token
    const cadastro = await auth.iniciarCadastroMfa(token)
    avancar(60)
    const ok = await auth.confirmarCadastroMfa(token, codigoAgora(cadastro!.segredo))
    if (ok.tipo !== 'ok') throw new Error('cadastro falhou')
    return { ...conta, codigos: ok.codigosRecuperacao }
  }

  it('entra no lugar do TOTP e só vale uma vez', async () => {
    const { id, email, codigos } = await contaComCodigos()
    expect((await auth.verificarMfa(await tokenParcial(email), codigos[0]!.toUpperCase())).tipo).toBe('ok')
    expect(await auth.verificarMfa(await tokenParcial(email), codigos[0]!)).toEqual({ tipo: 'codigo_invalido' })
    expect(await auth.codigosRestantes(id)).toBe(9)
  })

  it('uso em paralelo: o mesmo código em 4 sessões simultâneas entra exatamente 1 vez', async () => {
    const { email, codigos } = await contaComCodigos()
    const tokens = [await tokenParcial(email), await tokenParcial(email), await tokenParcial(email), await tokenParcial(email)]
    await admin`UPDATE administrador SET tentativas = 0 WHERE email = ${email}` // mesmo motivo do teste do TOTP
    const resultados = await Promise.all(tokens.map((t) => auth.verificarMfa(t, codigos[1]!)))
    expect(contar(resultados, 'ok')).toBe(1)
    expect(contar(resultados, 'codigo_invalido')).toBe(3)
  })
})

describe('sessão', () => {
  it('sair apaga a sessão no banco', async () => {
    const { email, segredo } = await criarConta()
    avancar(60)
    const r = await auth.verificarMfa(await tokenParcial(email), codigoAgora(segredo))
    if (r.tipo !== 'ok') throw new Error('login falhou')
    await auth.sair(r.token)
    expect(await auth.sessao(r.token)).toBeNull()
  })

  it('sessão vencida não vale', async () => {
    const { id, email } = await criarConta()
    const token = await tokenParcial(email)
    await admin`UPDATE sessao SET expira_em = now() - interval '1 second' WHERE administrador_id = ${id}`
    expect(await auth.sessao(token)).toBeNull()
  })

  it('o banco guarda o hash do token, não o token', async () => {
    const { id, email } = await criarConta()
    const token = await tokenParcial(email)
    const linhas = await admin<{ token_hash: string }[]>`SELECT token_hash FROM sessao WHERE administrador_id = ${id}`
    expect(linhas.map((l) => l.token_hash)).not.toContain(token)
  })
})
