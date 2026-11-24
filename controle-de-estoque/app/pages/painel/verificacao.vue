<script setup lang="ts">
definePageMeta({ layout: 'acesso' })
useHead({ title: 'Verificação · Controle de estoque' })

const usarRecuperacao = ref(false)
const codigo = ref('')
const erro = ref('')
const enviando = ref(false)

async function verificar() {
  erro.value = ''
  enviando.value = true
  try {
    await $fetch('/api/auth/mfa/verificar', { method: 'POST', body: { codigo: codigo.value } })
    await navigateTo('/painel', { replace: true })
  } catch (e) {
    erro.value = mensagemDeErro(e)
    codigo.value = ''
    // Sessão parcial vencida (10 minutos): volta para a senha.
    if (sessaoPerdida(e)) await navigateTo('/painel/entrar', { replace: true })
  } finally {
    enviando.value = false
  }
}

function alternar() {
  usarRecuperacao.value = !usarRecuperacao.value
  codigo.value = ''
  erro.value = ''
}
</script>

<template>
  <h1 class="mb-1 text-xl font-semibold">Verificação em duas etapas</h1>
  <p class="mb-5 text-sm text-texto-2">
    {{ usarRecuperacao
      ? 'Digite um dos códigos de recuperação que você guardou. Cada código vale uma vez só.'
      : 'Digite o código de 6 dígitos que aparece no aplicativo autenticador.' }}
  </p>

  <form class="grid gap-4" @submit.prevent="verificar">
    <div>
      <label class="rotulo" for="codigo">{{ usarRecuperacao ? 'Código de recuperação' : 'Código' }}</label>
      <input
        v-if="!usarRecuperacao"
        id="codigo"
        v-model="codigo"
        class="campo numeros text-center text-lg tracking-[0.4em]"
        inputmode="numeric"
        autocomplete="one-time-code"
        pattern="\d{6}"
        maxlength="6"
        required
        autofocus
      >
      <input
        v-else
        id="codigo"
        v-model="codigo"
        class="campo font-mono"
        autocomplete="off"
        placeholder="xxxxx-xxxxx"
        maxlength="20"
        required
        autofocus
      >
    </div>
    <p v-if="erro" class="aviso-erro" role="alert">{{ erro }}</p>
    <button class="botao botao-primario" type="submit" :disabled="enviando">
      {{ enviando ? 'Conferindo…' : 'Entrar' }}
    </button>
    <button type="button" class="text-sm font-medium text-acento-texto hover:underline" @click="alternar">
      {{ usarRecuperacao ? 'Usar o aplicativo autenticador' : 'Perdeu o celular? Usar um código de recuperação' }}
    </button>
  </form>
</template>
