# Portfólio

Três projetos pequenos para o portfólio do Djo, cada um provando uma habilidade que recrutador testa: concorrência, integração por webhook e IA dentro de uma aplicação. Tudo roda em Docker para desenvolver e testar.

**Livro (leia primeiro):** https://claude.ai/artifact/PLPUZu4Dx4AVdabmiDDRMq

## Regras que valem sempre

1. **Ler o livro antes de propor escopo.** Se não conseguir abrir o artefato, pare e avise o Djo. Não construa com base em memória ou suposição.
2. **Regra de atualização:** a cada mudança (decisão tomada, peça ou conexão nova, mudança de estado), atualizar o livro publicado e este arquivo na mesma hora. Em divergência entre os dois, vale o livro.
3. **Este repositório é público.** Antes de cada commit, conferir que não há segredo, dado real, IP ou nome de pessoa. Segredos ficam fora do git.
4. **Nada aqui está implementado ainda.** Não descrever como existente o que é plano.
5. **Cada projeto tem README com três partes:** o que é, qual problema resolve e limitações conhecidas.
6. **Dados de teste e demo sempre fictícios.**

## Decisões já tomadas (resumo; a fonte é o livro)

- Linguagem TypeScript estrito, framework Nuxt 4 com Nitro (tela e API no mesmo projeto), Zod em `shared/`.
- PostgreSQL sempre, um usuário por aplicação.
- Tudo em container, rede Docker segmentada.
- Segurança padrão como parte da entrega: LGPD, MFA com TOTP (só em login de painel ou conta administrativa), testes de segurança, segredos fora do git, validação na fronteira, GRC, GSI, GDPR quando houver titular na UE, WAF. GPO não se aplica.
- Bloqueio automático de IP malicioso e honeypot passivo (observa e registra, sem reação ofensiva).
- Clean Architecture na proporção mínima e YAGNI.
- Projeto 3 usa modelo local com Ollama, por um adaptador; modelo específico ainda a escolher.
- Projeto 1: o README compara atualização condicional atômica e bloqueio de linha, com teste de pedidos simultâneos que confirma exatamente 1 compra.
- Ordem de construção: 1, depois 2, depois 3.

## Estrutura

```
controle-de-estoque/   projeto 1: concorrência (a última unidade)
site-de-assinaturas/   projeto 2: webhook, pagamento fictício
atendimento-ia/        projeto 3: agente de IA integrado, base de respostas, revisão humana
```

## Em aberto

- Modelo do Ollama e a máquina onde ele roda.
