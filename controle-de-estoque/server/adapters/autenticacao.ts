import { and, count, eq, gt, isNull, lt, lte, or, sql } from 'drizzle-orm'
import type { Cifra } from '../core/cifra'
import { gerarHashSenha, verificarSenha, verificarSenhaFicticia } from '../core/senha'
import { gerarCodigosRecuperacao, hashSegredo, normalizarCodigoRecuperacao, novoTokenSessao } from '../core/tokens'
import { gerarSegredoTotp, uriOtpauth, verificarTotp } from '../core/totp'
import type { Banco } from '../db/cliente'
import { administrador, codigoRecuperacao, sessao, type EtapaSessao } from '../db/schema'

export const MAX_TENTATIVAS = 5
export const BLOQUEIO_MINUTOS = 15
// Duração da sessão em segundos: a parcial (senha certa, falta o código) vive pouco.
export const DURACAO_SESSAO: Record<EtapaSessao, number> = { mfa: 10 * 60, cadastro_mfa: 10 * 60, completa: 8 * 60 * 60 }
const EMISSOR = 'Controle de estoque'

export type ResultadoSenha =
  | { tipo: 'ok'; token: string; etapa: 'mfa' | 'cadastro_mfa' }
  | { tipo: 'credenciais_invalidas' }
  | { tipo: 'bloqueado' }

export type ResultadoCodigo =
  | { tipo: 'ok'; token: string }
  | { tipo: 'codigo_invalido' }
  | { tipo: 'bloqueado' }
  | { tipo: 'sessao_invalida' }

export type ResultadoCadastro = Exclude<ResultadoCodigo, { tipo: 'ok' }> | { tipo: 'ok'; token: string; codigosRecuperacao: string[] }

export interface SessaoAtiva {
  administradorId: number
  email: string
  etapa: EtapaSessao
}

export interface Autenticacao {
  garantirAdministradorInicial(email: string, senha: string): Promise<boolean>
  entrarComSenha(email: string, senha: string): Promise<ResultadoSenha>
  iniciarCadastroMfa(token: string): Promise<{ segredo: string; uri: string } | null>
  confirmarCadastroMfa(token: string, codigo: string): Promise<ResultadoCadastro>
  verificarMfa(token: string, codigo: string): Promise<ResultadoCodigo>
  sessao(token: string): Promise<SessaoAtiva | null>
  codigosRestantes(administradorId: number): Promise<number>
  sair(token: string): Promise<void>
}

// `agora` só existe para os testes controlarem o relógio do TOTP.
export function criarAutenticacao(db: Banco, cifra: Cifra, opcoes: { agora?: () => Date } = {}): Autenticacao {
  const agora = opcoes.agora ?? (() => new Date())

  // Gasta uma tentativa antes de conferir senha ou código, num único UPDATE condicional.
  // Com 50 tentativas simultâneas, só as 5 primeiras chegam a ser conferidas; as outras já encontram a conta bloqueada.
  // Bloqueio vencido recomeça a contagem do zero.
  async function reservarTentativa(id: number): Promise<boolean> {
    const linhas = await db
      .update(administrador)
      .set({
        tentativas: sql`CASE WHEN ${administrador.bloqueadoAte} IS NULL THEN ${administrador.tentativas} + 1 ELSE 1 END`,
        bloqueadoAte: sql`CASE
          WHEN ${administrador.bloqueadoAte} IS NULL AND ${administrador.tentativas} + 1 >= ${MAX_TENTATIVAS}
          THEN now() + make_interval(mins => ${BLOQUEIO_MINUTOS})
          ELSE NULL END`,
      })
      .where(and(eq(administrador.id, id), or(isNull(administrador.bloqueadoAte), lte(administrador.bloqueadoAte, sql`now()`))))
      .returning({ id: administrador.id })
    return linhas.length === 1
  }

  async function criarSessao(administradorId: number, etapa: EtapaSessao, totpPendenteCifrado: string | null = null) {
    const token = novoTokenSessao()
    // Limpeza oportunista: não precisa de tarefa agendada para apagar sessões vencidas.
    await db.delete(sessao).where(lt(sessao.expiraEm, sql`now()`))
    await db.insert(sessao).values({
      tokenHash: hashSegredo(token),
      administradorId,
      etapa,
      totpPendenteCifrado,
      expiraEm: sql`now() + make_interval(secs => ${DURACAO_SESSAO[etapa]})`,
    })
    return token
  }

  async function lerSessao(token: string) {
    const [linha] = await db
      .select({
        administradorId: sessao.administradorId,
        etapa: sessao.etapa,
        totpPendenteCifrado: sessao.totpPendenteCifrado,
        email: administrador.email,
        totpCifrado: administrador.totpCifrado,
      })
      .from(sessao)
      .innerJoin(administrador, eq(administrador.id, sessao.administradorId))
      .where(and(eq(sessao.tokenHash, hashSegredo(token)), gt(sessao.expiraEm, sql`now()`)))
      .limit(1)
    return linha ?? null
  }

  // Login completo: zera o contador e troca o token, para a sessão parcial não virar a completa (fixação de sessão).
  async function concluirLogin(tokenParcial: string, administradorId: number): Promise<string> {
    await db.update(administrador).set({ tentativas: 0, bloqueadoAte: null }).where(eq(administrador.id, administradorId))
    await db.delete(sessao).where(eq(sessao.tokenHash, hashSegredo(tokenParcial)))
    return criarSessao(administradorId, 'completa')
  }

  // O passo só avança: o mesmo código (ou um mais antigo) não entra de novo, nem em pedidos simultâneos.
  async function aceitarTotp(administradorId: number, totpCifrado: string, codigo: string): Promise<boolean> {
    const passo = verificarTotp(cifra.decifrar(totpCifrado), codigo, agora())
    if (passo === null) return false
    const linhas = await db
      .update(administrador)
      .set({ totpUltimoPasso: passo })
      .where(
        and(
          eq(administrador.id, administradorId),
          or(isNull(administrador.totpUltimoPasso), lt(administrador.totpUltimoPasso, passo)),
        ),
      )
      .returning({ id: administrador.id })
    return linhas.length === 1
  }

  async function aceitarRecuperacao(administradorId: number, codigo: string): Promise<boolean> {
    const normalizado = normalizarCodigoRecuperacao(codigo)
    if (!normalizado) return false
    const linhas = await db
      .update(codigoRecuperacao)
      .set({ usadoEm: sql`now()` })
      .where(
        and(
          eq(codigoRecuperacao.administradorId, administradorId),
          eq(codigoRecuperacao.hash, hashSegredo(normalizado)),
          isNull(codigoRecuperacao.usadoEm),
        ),
      )
      .returning({ id: codigoRecuperacao.id })
    return linhas.length === 1
  }

  return {
    // Cria o primeiro administrador a partir do ambiente, só se ainda não houver nenhum.
    async garantirAdministradorInicial(email, senha) {
      const [{ total } = { total: 0 }] = await db.select({ total: count() }).from(administrador)
      if (total > 0) return false
      const senhaHash = await gerarHashSenha(senha)
      const linhas = await db
        .insert(administrador)
        .values({ email: email.toLowerCase(), senhaHash })
        .onConflictDoNothing()
        .returning({ id: administrador.id })
      return linhas.length === 1
    },

    async entrarComSenha(email, senha) {
      const [conta] = await db
        .select({ id: administrador.id, senhaHash: administrador.senhaHash, totpCifrado: administrador.totpCifrado })
        .from(administrador)
        .where(eq(administrador.email, email.toLowerCase()))
        .limit(1)
      if (!conta) {
        await verificarSenhaFicticia(senha)
        return { tipo: 'credenciais_invalidas' }
      }
      if (!(await reservarTentativa(conta.id))) {
        await verificarSenhaFicticia(senha)
        return { tipo: 'bloqueado' }
      }
      if (!(await verificarSenha(senha, conta.senhaHash))) return { tipo: 'credenciais_invalidas' }
      // Senha certa não zera o contador: só o login completo zera. Senão, quem tem a senha
      // poderia alternar senha e código para tentar códigos sem limite.
      const etapa = conta.totpCifrado ? 'mfa' : 'cadastro_mfa'
      return { tipo: 'ok', etapa, token: await criarSessao(conta.id, etapa) }
    },

    async iniciarCadastroMfa(token) {
      const atual = await lerSessao(token)
      if (!atual || atual.etapa !== 'cadastro_mfa') return null
      const segredo = gerarSegredoTotp()
      await db
        .update(sessao)
        .set({ totpPendenteCifrado: cifra.cifrar(segredo) })
        .where(eq(sessao.tokenHash, hashSegredo(token)))
      return { segredo, uri: uriOtpauth(segredo, atual.email, EMISSOR) }
    },

    async confirmarCadastroMfa(token, codigo) {
      const atual = await lerSessao(token)
      if (!atual || atual.etapa !== 'cadastro_mfa' || !atual.totpPendenteCifrado) return { tipo: 'sessao_invalida' }
      const { administradorId, totpPendenteCifrado } = atual
      if (!(await reservarTentativa(administradorId))) return { tipo: 'bloqueado' }

      const passo = verificarTotp(cifra.decifrar(totpPendenteCifrado), codigo, agora())
      if (passo === null) return { tipo: 'codigo_invalido' }

      const codigos = gerarCodigosRecuperacao()
      const cadastrou = await db.transaction(async (tx) => {
        // Só grava se ainda não houver MFA: dois cadastros simultâneos não se sobrescrevem.
        const linhas = await tx
          .update(administrador)
          .set({ totpCifrado: totpPendenteCifrado, totpUltimoPasso: passo })
          .where(and(eq(administrador.id, administradorId), isNull(administrador.totpCifrado)))
          .returning({ id: administrador.id })
        if (linhas.length === 0) return false
        await tx.insert(codigoRecuperacao).values(codigos.map((c) => ({ administradorId, hash: hashSegredo(c) })))
        return true
      })
      if (!cadastrou) return { tipo: 'sessao_invalida' }

      return { tipo: 'ok', token: await concluirLogin(token, administradorId), codigosRecuperacao: codigos }
    },

    async verificarMfa(token, codigo) {
      const atual = await lerSessao(token)
      if (!atual || atual.etapa !== 'mfa' || !atual.totpCifrado) return { tipo: 'sessao_invalida' }
      const { administradorId, totpCifrado } = atual
      if (!(await reservarTentativa(administradorId))) return { tipo: 'bloqueado' }

      const limpo = codigo.trim()
      const valido = /^\d{6}$/.test(limpo)
        ? await aceitarTotp(administradorId, totpCifrado, limpo)
        : await aceitarRecuperacao(administradorId, limpo)
      if (!valido) return { tipo: 'codigo_invalido' }

      return { tipo: 'ok', token: await concluirLogin(token, administradorId) }
    },

    async sessao(token) {
      const atual = await lerSessao(token)
      return atual && { administradorId: atual.administradorId, email: atual.email, etapa: atual.etapa }
    },

    async codigosRestantes(administradorId) {
      const [{ total } = { total: 0 }] = await db
        .select({ total: count() })
        .from(codigoRecuperacao)
        .where(and(eq(codigoRecuperacao.administradorId, administradorId), isNull(codigoRecuperacao.usadoEm)))
      return total
    },

    async sair(token) {
      await db.delete(sessao).where(eq(sessao.tokenHash, hashSegredo(token)))
    },
  }
}
