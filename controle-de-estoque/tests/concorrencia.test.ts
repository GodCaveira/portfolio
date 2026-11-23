import postgres from 'postgres'
import { afterAll, describe, expect, it } from 'vitest'
import { estoqueBloqueio } from '../server/adapters/estoque-bloqueio'
import { estoqueCondicional } from '../server/adapters/estoque-condicional'
import type { Estoque, ResultadoCompra } from '../server/core/estoque'
import { criarBanco } from '../server/db/cliente'

// Os pedidos usam o papel da aplicação (mesmos privilégios da API).
// O papel de administrador só prepara e limpa os dados de cada teste.
const appUrl = process.env.TEST_APP_URL
const adminUrl = process.env.TEST_ADMIN_URL
if (!appUrl || !adminUrl) throw new Error('Defina TEST_APP_URL e TEST_ADMIN_URL')

const CLIENTES = 50
const RODADAS = 10

const admin = postgres(adminUrl, { max: 1 })
const app = criarBanco(appUrl, 20)

afterAll(async () => {
  await app.fechar()
  await admin.end()
})

async function criarProduto(quantidade: number): Promise<number> {
  const [linha] = await admin<{ id: number }[]>`
    INSERT INTO produto (nome, quantidade) VALUES ('Produto de teste', ${quantidade}) RETURNING id`
  return linha!.id
}

async function apagarProduto(id: number) {
  await admin`DELETE FROM pedido WHERE produto_id = ${id}`
  await admin`DELETE FROM produto WHERE id = ${id}`
}

async function situacao(id: number) {
  const [p] = await admin<{ quantidade: number }[]>`SELECT quantidade FROM produto WHERE id = ${id}`
  const [c] = await admin<{ total: number }[]>`SELECT count(*)::int AS total FROM pedido WHERE produto_id = ${id}`
  return { saldo: p!.quantidade, pedidos: c!.total }
}

function disputar(estoque: Estoque, produtoId: number): Promise<ResultadoCompra[]> {
  return Promise.all(
    Array.from({ length: CLIENTES }, (_, i) => estoque.comprarUnidade(produtoId, `cliente-teste-${i}`)),
  )
}

const contar = (rs: ResultadoCompra[], tipo: ResultadoCompra['tipo']) => rs.filter((r) => r.tipo === tipo).length

const tecnicas: [string, Estoque][] = [
  ['atualização condicional atômica', estoqueCondicional(app.db)],
  ['bloqueio de linha', estoqueBloqueio(app.db)],
]

describe.each(tecnicas)('%s', (_nome, estoque) => {
  it(`1 unidade e ${CLIENTES} pedidos simultâneos: exatamente 1 compra (${RODADAS} rodadas)`, async () => {
    for (let rodada = 0; rodada < RODADAS; rodada++) {
      const id = await criarProduto(1)
      try {
        const resultados = await disputar(estoque, id)
        expect(contar(resultados, 'comprado')).toBe(1)
        expect(contar(resultados, 'esgotado')).toBe(CLIENTES - 1)
        expect(await situacao(id)).toEqual({ saldo: 0, pedidos: 1 })
      } finally {
        await apagarProduto(id)
      }
    }
  })

  it(`5 unidades e ${CLIENTES} pedidos simultâneos: exatamente 5 compras`, async () => {
    const id = await criarProduto(5)
    try {
      const resultados = await disputar(estoque, id)
      expect(contar(resultados, 'comprado')).toBe(5)
      expect(await situacao(id)).toEqual({ saldo: 0, pedidos: 5 })
    } finally {
      await apagarProduto(id)
    }
  })

  it('produto inexistente não vira compra', async () => {
    expect(await estoque.comprarUnidade(2_000_000_000, 'cliente-teste')).toEqual({ tipo: 'produto_inexistente' })
  })
})
