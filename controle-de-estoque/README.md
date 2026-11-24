# Controle de estoque

**Estado:** em construção. O núcleo de concorrência e o painel administrativo com login e MFA (TOTP) estão prontos e testados. Falta a camada de defesa (limite de requisições, bloqueio de IP e honeypot).

## O que é

Uma API de pedidos que garante que a última unidade em estoque seja vendida uma vez só, mesmo quando vários clientes pedem no mesmo instante. Tem também um painel administrativo, protegido por senha e código do aplicativo autenticador, para repor estoque, ver os pedidos e disparar compras simultâneas pela tela. Feita em Nuxt 4 (Nitro) com TypeScript estrito, Vue 3, Tailwind, Drizzle e PostgreSQL, rodando em Docker.

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

### O painel e o login

O painel fica em `/painel`. Não há cadastro público: o primeiro administrador vem do `.env` (`ADMIN_EMAIL` e `ADMIN_SENHA`) e é criado só se o banco ainda não tiver nenhum. No primeiro login, o painel pede para cadastrar o aplicativo autenticador (QR code) e mostra 10 códigos de recuperação, uma única vez.

| Peça | Como é feita |
|---|---|
| Senha | scrypt (N=2^15, r=8, p=3, uma das combinações mínimas da OWASP), do próprio Node. E-mail inexistente gasta o mesmo tempo de uma senha errada. |
| TOTP | RFC 6238 (SHA-1, 30 s, 6 dígitos), aceitando um passo antes e um depois. Testado com os vetores da própria RFC. |
| Segredo TOTP no banco | Cifrado com AES-256-GCM; a chave (`TOTP_CHAVE`) fica no ambiente. Uma cópia só do banco não gera códigos. |
| Códigos de recuperação | 10 códigos de 50 bits; o banco guarda só o SHA-256. Cada um vale uma vez. |
| Sessão | Token aleatório no cookie `__Host-sessao` (HttpOnly, Secure, SameSite=Strict); o banco guarda só o hash. A sessão parcial (senha certa, falta o código) dura 10 minutos; a completa, 8 horas. O token muda ao concluir o login. |
| Limite de tentativas | 5 erros (senha e código somados) bloqueiam a conta por 15 minutos. Só o login completo zera a contagem. |
| CSRF | SameSite=Strict e recusa de pedido que muda estado vindo de outra origem. |
| Rotas do painel | Um middleware exige sessão completa em todo `/api/painel/*`; rota nova já nasce protegida. |

O limite de tentativas, o código TOTP e o código de recuperação usam o mesmo padrão do estoque: um `UPDATE` condicional atômico. A tentativa é gasta antes de a senha ser conferida, então 50 tentativas simultâneas não passam do limite. O mesmo código enviado em vários pedidos ao mesmo tempo entra uma vez só.

[`tests/autenticacao.test.ts`](tests/autenticacao.test.ts) prova isso com banco real:
- força bruta em série e em paralelo (de 50 tentativas simultâneas, só 5 são conferidas);
- reuso do código TOTP, em série e em paralelo;
- código de recuperação de uso único;
- sessão parcial que não serve para pular etapa;
- sessão vencida e logout.

[`tests/seguranca.test.ts`](tests/seguranca.test.ts) cobre as peças puras: TOTP, senha, cifra e códigos.

## Como rodar

Precisa de Docker.

```sh
cp .env.example .env        # troque senhas e chave (use só letras e números)
docker compose --profile test run --rm --build test   # roda os testes
docker compose up -d --build                          # sobe API e painel em 127.0.0.1:3010
```

```sh
curl -X POST localhost:3010/api/pedidos -H 'content-type: application/json' \
  -d '{"produtoId":1,"clienteRef":"cliente-1"}'   # 201, depois 409
curl localhost:3010/api/produtos/1                # saldo
```

O banco nasce com um produto fictício com 1 unidade. Para recomeçar do zero (apaga também o administrador e o MFA): `docker compose down -v`.

### Segurança já aplicada

- A API usa um papel de banco próprio, só com os privilégios de que precisa (por exemplo, sem `DELETE` em `produto`, `pedido` e `administrador`).
- O banco fica numa rede Docker interna, sem porta publicada; a API só escuta em `127.0.0.1`.
- O container da API roda sem root, com sistema de arquivos somente leitura e sem capabilities.
- Toda entrada passa por Zod; o cliente é uma referência opaca, não um nome, para não guardar dado pessoal.
- Senhas e chave de cifra ficam no `.env`, fora do git.

## Limitações conhecidas

- Reserva com prazo (carrinho abandonado) está fora do escopo: a unidade só sai do estoque na compra.
- O desenho cobre um único banco PostgreSQL. Estoque distribuído entre vários bancos exigiria outra abordagem.
- Uma compra leva sempre 1 unidade.
- Ainda não há limite de requisições por IP, bloqueio de IP nem honeypot. Eles vêm na próxima etapa deste projeto.
- O bloqueio é por conta: quem souber o e-mail do administrador consegue mantê-lo bloqueado errando a senha de propósito. O limite por IP da próxima etapa reduz esse risco.
- Quem tiver a senha antes do primeiro login cadastra o próprio autenticador. Por isso a senha inicial deve ser trocada no `.env` antes de subir e o primeiro login deve ser feito logo.
- Não há troca de senha nem recadastro do autenticador pela tela. Sem o celular e sem os 10 códigos, o acesso só volta com `docker compose down -v` (que apaga tudo) ou mexendo direto no banco.
- Um único administrador, sem papéis nem permissões diferentes.
- As tabelas são criadas por um script SQL na primeira subida do banco, sem ferramenta de migração. O esquema do Drizzle em `server/db/schema.ts` precisa ser mantido igual a ele à mão, e mudar o esquema exige recriar o banco (`docker compose down -v`).
