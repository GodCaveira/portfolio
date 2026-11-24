<script setup lang="ts">
import { KeyRound, Package, ShoppingCart, Zap } from '@lucide/vue'

definePageMeta({ layout: false })
useHead({ title: 'Painel · Controle de estoque' })

const { data: resumo, error: erroResumo, refresh } = await useFetch('/api/painel/resumo')

// Sessão vencida no meio do uso (8 horas): a API responde 401 e a tela volta para o login.
watch(erroResumo, (e) => {
  if (e?.statusCode === 401) void navigateTo('/painel/entrar', { replace: true })
})

const totalUnidades = computed(() => resumo.value?.produtos.reduce((soma, p) => soma + p.quantidade, 0) ?? 0)
const nomeTecnica = computed(() =>
  resumo.value?.estrategia === 'bloqueio' ? 'bloqueio de linha (SELECT … FOR UPDATE)' : 'atualização condicional atômica',
)

// Reposição: um campo por produto, preenchido com o saldo atual.
const novasQuantidades = ref<Record<number, number>>({})
watch(
  () => resumo.value?.produtos,
  (produtos) => {
    for (const p of produtos ?? []) novasQuantidades.value[p.id] = p.quantidade
  },
  { immediate: true },
)
const salvando = ref<number | null>(null)
const erroEstoque = ref('')

async function salvarEstoque(id: number) {
  erroEstoque.value = ''
  salvando.value = id
  try {
    await $fetch(`/api/painel/produtos/${id}/estoque`, { method: 'POST', body: { quantidade: novasQuantidades.value[id] } })
    await refresh()
  } catch (e) {
    erroEstoque.value = mensagemDeErro(e)
  } finally {
    salvando.value = null
  }
}

// Simulação: N compras simultâneas do mesmo produto, pelo mesmo caminho da API pública.
const produtoSimulado = ref<number>()
const clientes = ref(50)
const simulando = ref(false)
const erroSimulacao = ref('')
type ResultadoSimulacao = { clientes: number; comprados: number; esgotados: number; saldo: number; estrategia: string }
const resultado = ref<ResultadoSimulacao | null>(null)
watch(
  () => resumo.value?.produtos[0]?.id,
  (id) => (produtoSimulado.value ??= id),
  { immediate: true },
)

async function simular() {
  if (!produtoSimulado.value) return
  erroSimulacao.value = ''
  simulando.value = true
  try {
    // Tipo explícito pelo mesmo motivo do cadastro do MFA (inferência das rotas estoura a profundidade).
    resultado.value = await $fetch<ResultadoSimulacao>('/api/painel/simulacao', {
      method: 'POST',
      body: { produtoId: produtoSimulado.value, clientes: clientes.value },
    })
    await refresh()
  } catch (e) {
    erroSimulacao.value = mensagemDeErro(e)
  } finally {
    simulando.value = false
  }
}

const formatarHora = (iso: string) =>
  new Date(iso).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit' })
</script>

<template>
  <NuxtLayout name="painel" :email="resumo?.administrador">
    <p v-if="erroResumo && erroResumo.statusCode !== 401" class="aviso-erro mb-6" role="alert">{{ mensagemDeErro(erroResumo) }}</p>

    <template v-if="resumo">
      <!-- Números principais -->
      <section class="mb-6 grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4" aria-label="Resumo">
        <div class="cartao flex items-start justify-between">
          <div>
            <p class="text-sm text-texto-2">Produtos</p>
            <p class="numeros mt-1 text-2xl font-semibold">{{ resumo.produtos.length }}</p>
          </div>
          <Package :size="22" class="text-acento" aria-hidden="true" />
        </div>
        <div class="cartao flex items-start justify-between">
          <div>
            <p class="text-sm text-texto-2">Unidades em estoque</p>
            <p class="numeros mt-1 text-2xl font-semibold">{{ totalUnidades }}</p>
          </div>
          <Zap :size="22" class="text-acento" aria-hidden="true" />
        </div>
        <div class="cartao flex items-start justify-between">
          <div>
            <p class="text-sm text-texto-2">Últimos pedidos</p>
            <p class="numeros mt-1 text-2xl font-semibold">{{ resumo.pedidos.length }}</p>
          </div>
          <ShoppingCart :size="22" class="text-acento" aria-hidden="true" />
        </div>
        <div class="cartao flex items-start justify-between">
          <div>
            <p class="text-sm text-texto-2">Códigos de recuperação</p>
            <p class="numeros mt-1 text-2xl font-semibold" :class="{ 'text-aviso-texto': resumo.codigosRestantes <= 2 }">
              {{ resumo.codigosRestantes }} <span class="text-sm font-normal text-texto-2">de 10</span>
            </p>
          </div>
          <KeyRound :size="22" class="text-acento" aria-hidden="true" />
        </div>
      </section>

      <div class="grid gap-6 xl:grid-cols-[3fr_2fr]">
        <!-- Produtos e reposição -->
        <section class="cartao min-w-0" aria-labelledby="titulo-produtos">
          <h2 id="titulo-produtos" class="mb-1 font-semibold">Estoque</h2>
          <p class="mb-4 text-sm text-texto-2">Defina o saldo de cada produto. Compras sempre baixam uma unidade por vez.</p>
          <div class="overflow-x-auto">
            <table class="w-full min-w-[28rem] text-sm">
              <thead>
                <tr class="border-b border-borda text-left text-xs uppercase tracking-wide text-texto-2">
                  <th class="py-2 pr-3 font-medium">Produto</th>
                  <th class="py-2 pr-3 text-right font-medium">Saldo</th>
                  <th class="py-2 font-medium">Novo saldo</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="p in resumo.produtos" :key="p.id" class="border-b border-borda last:border-0">
                  <td class="py-3 pr-3">{{ p.nome }}</td>
                  <td class="numeros py-3 pr-3 text-right">
                    <span v-if="p.quantidade === 0" class="rounded-full bg-neg-fundo px-2 py-0.5 text-xs font-semibold text-neg-texto">esgotado</span>
                    <span v-else>{{ p.quantidade }}</span>
                  </td>
                  <td class="py-2">
                    <form class="flex gap-2" @submit.prevent="salvarEstoque(p.id)">
                      <label class="sr-only" :for="`qtd-${p.id}`">Novo saldo de {{ p.nome }}</label>
                      <input :id="`qtd-${p.id}`" v-model.number="novasQuantidades[p.id]" class="campo numeros w-24" type="number" min="0" max="100000" required>
                      <button class="botao" type="submit" :disabled="salvando === p.id">Salvar</button>
                    </form>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
          <p v-if="erroEstoque" class="aviso-erro mt-3" role="alert">{{ erroEstoque }}</p>
        </section>

        <!-- Simulação da disputa -->
        <section class="cartao min-w-0" aria-labelledby="titulo-simulacao">
          <h2 id="titulo-simulacao" class="mb-1 font-semibold">Simular compras simultâneas</h2>
          <p class="mb-4 text-sm text-texto-2">
            Dispara vários pedidos do mesmo produto ao mesmo tempo. Técnica em uso: <strong class="text-texto">{{ nomeTecnica }}</strong>.
          </p>
          <form class="grid gap-3 sm:grid-cols-[1fr_7rem]" @submit.prevent="simular">
            <div>
              <label class="rotulo" for="sim-produto">Produto</label>
              <select id="sim-produto" v-model.number="produtoSimulado" class="campo">
                <option v-for="p in resumo.produtos" :key="p.id" :value="p.id">{{ p.nome }} ({{ p.quantidade }})</option>
              </select>
            </div>
            <div>
              <label class="rotulo" for="sim-clientes">Clientes</label>
              <input id="sim-clientes" v-model.number="clientes" class="campo numeros" type="number" min="2" max="100" required>
            </div>
            <button class="botao botao-primario sm:col-span-2" type="submit" :disabled="simulando">
              {{ simulando ? 'Disparando…' : `Disparar ${clientes} pedidos ao mesmo tempo` }}
            </button>
          </form>
          <p v-if="erroSimulacao" class="aviso-erro mt-3" role="alert">{{ erroSimulacao }}</p>
          <div v-if="resultado" class="mt-4 rounded-lg bg-suave p-4 text-sm" role="status">
            <p class="numeros">
              <strong class="text-ok-texto">{{ resultado.comprados }}</strong> {{ resultado.comprados === 1 ? 'comprou' : 'compraram' }},
              <strong>{{ resultado.esgotados }}</strong> {{ resultado.esgotados === 1 ? 'recebeu' : 'receberam' }} "esgotado".
              Saldo final: <strong>{{ resultado.saldo }}</strong>.
            </p>
            <p class="mt-1 text-texto-2">Nenhum pedido levou unidade que não existia: o saldo nunca fica negativo.</p>
          </div>
        </section>
      </div>

      <!-- Últimos pedidos -->
      <section class="cartao mt-6 min-w-0" aria-labelledby="titulo-pedidos">
        <h2 id="titulo-pedidos" class="mb-4 font-semibold">Últimos pedidos</h2>
        <p v-if="!resumo.pedidos.length" class="text-sm text-texto-2">Nenhum pedido ainda. Use a simulação ou a API pública.</p>
        <div v-else class="overflow-x-auto">
          <table class="w-full min-w-[28rem] text-sm">
            <thead>
              <tr class="border-b border-borda text-left text-xs uppercase tracking-wide text-texto-2">
                <th class="py-2 pr-3 font-medium">Pedido</th>
                <th class="py-2 pr-3 font-medium">Produto</th>
                <th class="py-2 pr-3 font-medium">Cliente</th>
                <th class="py-2 font-medium">Quando</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="p in resumo.pedidos" :key="p.id" class="border-b border-borda last:border-0">
                <td class="numeros py-2 pr-3">#{{ p.id }}</td>
                <td class="py-2 pr-3">{{ p.produto }}</td>
                <td class="py-2 pr-3 font-mono text-xs">{{ p.clienteRef }}</td>
                <td class="numeros py-2 text-texto-2">{{ formatarHora(p.criadoEm) }}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>
    </template>
  </NuxtLayout>
</template>
