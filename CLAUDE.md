# Portfólio

Três projetos pequenos para o portfólio do Djo, cada um provando uma habilidade que recrutador testa: concorrência, integração por webhook e IA dentro de uma aplicação. Tudo roda em Docker para desenvolver e testar.

**Livro (leia primeiro):** https://claude.ai/artifact/PLPUZu4Dx4AVdabmiDDRMq

## Regras que valem sempre

1. **Ler o livro antes de propor escopo.** Se não conseguir abrir o artefato, pare e avise o Djo. Não construa com base em memória ou suposição.
2. **Regra de atualização:** a cada mudança (decisão tomada, peça ou conexão nova, mudança de estado), atualizar o livro publicado e este arquivo na mesma hora. Em divergência entre os dois, vale o livro.
3. **Este repositório é público.** Antes de cada commit, conferir que não há segredo, dado real, IP ou nome de pessoa. Segredos ficam fora do git.
4. **Não descrever como existente o que é plano.** Hoje só existe o núcleo de concorrência do projeto 1 (API, as duas técnicas e o teste). O painel do projeto 1 e os projetos 2 e 3 são plano.
5. **Cada projeto tem README com três partes:** o que é, qual problema resolve e limitações conhecidas.
6. **Dados de teste e demo sempre fictícios.**

## Decisões já tomadas (resumo; a fonte é o livro)

- Linguagem TypeScript estrito, framework Nuxt 4 com Nitro (tela e API no mesmo projeto), Zod em `shared/`.
- PostgreSQL sempre, um usuário por aplicação, com Drizzle como ORM.
- Tela, quando houver: Vue 3 com Tailwind e o design system de dashboard (sidebar escura, cards, acento verde).
- Cada pasta é um projeto independente, com package.json e docker-compose próprios.
- Projeto 1 com painel completo, login e MFA (TOTP): escolha do Djo, contra a recomendação de uma tela mínima. O risco é o escopo de segurança atrasar o problema central, a concorrência.
- Tudo em container, rede Docker segmentada.
- Segurança padrão como parte da entrega: LGPD, MFA com TOTP (só em login de painel ou conta administrativa), testes de segurança, segredos fora do git, validação na fronteira, GRC, GSI, GDPR quando houver titular na UE, WAF. GPO não se aplica.
- Bloqueio automático de IP malicioso e honeypot passivo (observa e registra, sem reação ofensiva).
- Clean Architecture na proporção mínima e YAGNI.
- Projeto 3 usa modelo local com Ollama em servidor próprio (só CPU, modelo de cerca de 3B), por um adaptador. O nome exato do modelo fica para o projeto 3.
- Projeto 1: o README compara atualização condicional atômica e bloqueio de linha, com teste de pedidos simultâneos que confirma exatamente 1 compra.
- Ordem de construção: 1, depois 2, depois 3. Dentro do projeto 1: núcleo de concorrência, depois painel com login e MFA, depois camada de defesa.
- Projeto 1: a API usa a atualização condicional por padrão (`ESTRATEGIA_ESTOQUE=bloqueio` troca a técnica). Esquema criado por script SQL na primeira subida do banco, sem drizzle-kit. TypeScript 5.9 (não 7, por causa do vue-tsc), postgres.js 3.4, npm. Porta local 3010.

## Estrutura

```
controle-de-estoque/   projeto 1: concorrência (a última unidade)
site-de-assinaturas/   projeto 2: webhook, pagamento fictício
atendimento-ia/        projeto 3: agente de IA integrado, base de respostas, revisão humana
```

## Em aberto

- Nome exato do modelo do Ollama (decidir ao chegar no projeto 3).
