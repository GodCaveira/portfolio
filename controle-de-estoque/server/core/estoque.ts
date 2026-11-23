// Regra do negócio: uma compra leva uma unidade, e o estoque nunca vende o que não tem.
// As duas técnicas de concorrência implementam esta mesma porta (ver server/adapters).

export type ResultadoCompra =
  | { tipo: 'comprado'; pedidoId: number }
  | { tipo: 'esgotado' }
  | { tipo: 'produto_inexistente' }

export interface Estoque {
  comprarUnidade(produtoId: number, clienteRef: string): Promise<ResultadoCompra>
}

export type EstrategiaEstoque = 'condicional' | 'bloqueio'
