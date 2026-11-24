<script setup lang="ts">
import { Boxes } from '@lucide/vue'
</script>

<template>
  <main class="mx-auto max-w-2xl px-4 py-16">
    <div class="mb-6 flex items-center gap-3 text-lg font-semibold">
      <Boxes :size="24" class="text-acento" aria-hidden="true" />
      Controle de estoque
    </div>
    <h1 class="mb-3 text-3xl font-semibold text-balance">Dois clientes, uma unidade: só um compra.</h1>
    <p class="mb-6 text-texto-2">
      Projeto de portfólio sobre concorrência. Os pedidos disputam a mesma linha do PostgreSQL, e o banco decide quem leva a
      última unidade. Dados de demonstração, todos fictícios.
    </p>
    <div class="cartao mb-6">
      <h2 class="mb-2 font-semibold">API pública</h2>
      <ul class="grid gap-1 font-mono text-sm">
        <li>POST /api/pedidos <span class="text-texto-2">{ produtoId, clienteRef }</span></li>
        <li>GET /api/produtos/:id</li>
      </ul>
    </div>
    <NuxtLink to="/painel" class="botao botao-primario">Entrar no painel</NuxtLink>
  </main>
</template>
