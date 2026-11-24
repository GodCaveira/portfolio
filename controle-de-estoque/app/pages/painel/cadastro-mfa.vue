<script setup lang="ts">
import { Check, Copy } from '@lucide/vue'

definePageMeta({ layout: 'acesso' })
useHead({ title: 'Cadastrar autenticador · Controle de estoque' })

const cadastro = ref<{ segredo: string; qrSvg: string } | null>(null)
const codigo = ref('')
const erro = ref('')
const enviando = ref(false)
const codigosRecuperacao = ref<string[]>([])
const guardou = ref(false)
const copiado = ref(false)

// O segredo em blocos de 4 é mais fácil de digitar à mão quando a câmera não lê o QR.
const segredoEmBlocos = computed(() => cadastro.value?.segredo.match(/.{1,4}/g)?.join(' ') ?? '')

onMounted(async () => {
  try {
    // Tipo explícito: a inferência das rotas do Nitro estoura a profundidade do TypeScript nesta atribuição.
    cadastro.value = await $fetch<{ segredo: string; qrSvg: string }>('/api/auth/mfa/cadastro', { method: 'POST' })
  } catch (e) {
    erro.value = mensagemDeErro(e)
  }
})

async function confirmar() {
  erro.value = ''
  enviando.value = true
  try {
    const resposta = await $fetch('/api/auth/mfa/confirmar', { method: 'POST', body: { codigo: codigo.value } })
    codigosRecuperacao.value = resposta.codigosRecuperacao
    cadastro.value = null
  } catch (e) {
    erro.value = mensagemDeErro(e)
    codigo.value = ''
    if (sessaoPerdida(e)) await navigateTo('/painel/entrar', { replace: true })
  } finally {
    enviando.value = false
  }
}

async function copiar() {
  try {
    await navigator.clipboard.writeText(codigosRecuperacao.value.join('\n'))
    copiado.value = true
  } catch {
    // Sem permissão de área de transferência: o usuário seleciona a lista à mão.
  }
}
</script>

<template>
  <template v-if="codigosRecuperacao.length">
    <h1 class="mb-1 text-xl font-semibold">Guarde os códigos de recuperação</h1>
    <p class="mb-4 text-sm text-texto-2">
      Se perder o celular, cada código abaixo entra uma vez no lugar do código do aplicativo.
      Eles aparecem só agora: o painel guarda apenas uma versão embaralhada (hash) e não consegue mostrá-los de novo.
    </p>
    <ol class="numeros mb-4 grid grid-cols-2 gap-2 rounded-lg bg-suave p-4 font-mono text-sm">
      <li v-for="c in codigosRecuperacao" :key="c">{{ c }}</li>
    </ol>
    <button type="button" class="botao mb-4 w-full" @click="copiar">
      <component :is="copiado ? Check : Copy" :size="18" aria-hidden="true" />
      {{ copiado ? 'Copiados' : 'Copiar códigos' }}
    </button>
    <label class="mb-4 flex items-center gap-2 text-sm">
      <input v-model="guardou" type="checkbox" class="size-4 accent-[var(--accent)]">
      Guardei os códigos em lugar seguro
    </label>
    <button type="button" class="botao botao-primario w-full" :disabled="!guardou" @click="navigateTo('/painel', { replace: true })">
      Ir para o painel
    </button>
  </template>

  <template v-else>
    <h1 class="mb-1 text-xl font-semibold">Cadastre o aplicativo autenticador</h1>
    <p class="mb-4 text-sm text-texto-2">
      Primeiro acesso: aponte a câmera do aplicativo (Google Authenticator, Aegis, 1Password ou outro) para o QR code.
    </p>

    <div v-if="cadastro" class="mb-4 grid justify-items-center gap-3">
      <!-- SVG gerado pelo próprio servidor a partir do endereço otpauth, sem conteúdo de terceiros. -->
      <div class="w-48 rounded-lg bg-white p-2 [&_svg]:h-auto [&_svg]:w-full" role="img" aria-label="QR code do autenticador" v-html="cadastro.qrSvg" />
      <p class="text-center text-sm text-texto-2">
        Sem câmera? Digite a chave:<br>
        <code class="numeros font-mono text-texto select-all">{{ segredoEmBlocos }}</code>
      </p>
    </div>
    <div v-else-if="!erro" class="mx-auto mb-4 size-48 animate-pulse rounded-lg bg-suave" />

    <form class="grid gap-4" @submit.prevent="confirmar">
      <div>
        <label class="rotulo" for="codigo">Código de 6 dígitos que o aplicativo mostra</label>
        <input
          id="codigo"
          v-model="codigo"
          class="campo numeros text-center text-lg tracking-[0.4em]"
          inputmode="numeric"
          autocomplete="one-time-code"
          pattern="\d{6}"
          maxlength="6"
          required
        >
      </div>
      <p v-if="erro" class="aviso-erro" role="alert">{{ erro }}</p>
      <button class="botao botao-primario" type="submit" :disabled="enviando || !cadastro">
        {{ enviando ? 'Conferindo…' : 'Confirmar' }}
      </button>
    </form>
  </template>
</template>
