# Controle de estoque

**Estado:** em construção. O núcleo de concorrência (API, as duas técnicas e o teste) está pronto e testado. O painel com login e MFA (TOTP) ainda não existe.

## O que é

Uma API de pedidos que garante que a última unidade em estoque seja vendida uma vez só, mesmo quando vários clientes pedem no mesmo instante. Feita em Nuxt 4 (Nitro) com TypeScript estrito, Drizzle e PostgreSQL, rodando em Docker.

```
Cliente A ─┐                        ┌─ UPDATE produto SET quantidade = quantidade - 1
           ├─► POST /api/pedidos ─► │  WHERE id = $1 AND quantidade > 0
Cliente B ─┘                        └─ 1 linha alterada → 201   0 linhas → 409
```

## Qual problema resolve

Há 1 unidade em estoque e dois clientes pedem ao mesmo tempo. Se a aplicação lê o saldo, vê 1 nos dois pedidos e depois grava, as duas compras passam e a loja vende o que não tem (condição de corrida). Aqui quem decide é o banco, dentro de uma transação, e só um pedido leva a unidade.

### As duas técnicas

| | Atualização condicional atômica | Bloqueio de linha |
|---|---|---|
| Arquivo | [`server/adapters/estoque-condicional.ts`](server/adapters/estoque-condicional.ts) | [`server/adapters/estoque-bloqueio.ts`](server/adapters/estoque-bloqueio.ts) |
| Como funciona | Um `UPDATE ... WHERE quantidade > 0`. Quem chega depois espera a linha liberar, reavalia o `WHERE` e não altera nada. | `SELECT ... FOR UPDATE` trava a linha; a regra de saldo roda no código; os outros esperam e leem o saldo já baixado. |
| Idas ao banco por compra | 2 (update e insert) | 3 (select, update e insert) |
| Onde fica a regra | No SQL | No TypeScript, entre a leitura e a escrita |
| Quando usar | Regra simples que cabe num `WHERE` | Regra que precisa ler a linha antes de decidir (limite por cliente, preço, várias colunas) |

As duas passam no mesmo teste. A escolhida para a API é a atualização condicional (`ESTRATEGIA_ESTOQUE=condicional`), por ser mais curta e manter a linha travada por menos tempo. A outra fica disponível com `ESTRATEGIA_ESTOQUE=bloqueio`.

### O teste que prova

[`tests/concorrencia.test.ts`](tests/concorrencia.test.ts) roda contra um PostgreSQL de verdade, usando o mesmo papel de banco da API, e para cada técnica:

- 1 unidade e 50 pedidos simultâneos, repetido 10 vezes: exatamente 1 compra, 49 recusas, saldo 0 e 1 pedido gravado;
- 5 unidades e 50 pedidos simultâneos: exatamente 5 compras;
- produto inexistente não vira compra.

## Como rodar

Precisa de Docker.

```sh
cp .env.example .env        # troque as senhas (use só letras e números)
docker compose --profile test run --rm --build test   # roda o teste
docker compose up -d --build                          # sobe a API em 127.0.0.1:3010
```

```sh
curl -X POST localhost:3010/api/pedidos -H 'content-type: application/json' \
  -d '{"produtoId":1,"clienteRef":"cliente-1"}'   # 201, depois 409
curl localhost:3010/api/produtos/1                # saldo
```

O banco nasce com um produto fictício com 1 unidade. Para recomeçar do zero: `docker compose down -v`.

### Segurança já aplicada

- A API usa um papel de banco próprio, só com `SELECT`/`UPDATE` em `produto` e `SELECT`/`INSERT` em `pedido`.
- O banco fica numa rede Docker interna, sem porta publicada; a API só escuta em `127.0.0.1`.
- O container da API roda sem root, com sistema de arquivos somente leitura e sem capabilities.
- Toda entrada passa por Zod; o cliente é uma referência opaca, não um nome, para não guardar dado pessoal.
- Senhas ficam no `.env`, fora do git.

## Limitações conhecidas

- Reserva com prazo (carrinho abandonado) está fora do escopo: a unidade só sai do estoque na compra.
- O desenho cobre um único banco PostgreSQL. Estoque distribuído entre vários bancos exigiria outra abordagem.
- Uma compra leva sempre 1 unidade.
- Ainda não há login, painel, MFA, limite de requisições, bloqueio de IP nem honeypot. Eles vêm nas próximas etapas deste projeto.
- As tabelas são criadas por um script SQL na primeira subida do banco, sem ferramenta de migração. O esquema do Drizzle em `server/db/schema.ts` precisa ser mantido igual a ele à mão.
