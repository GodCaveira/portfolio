<script setup lang="ts">
definePageMeta({ layout: 'acesso' })
useHead({ title: 'Entrar · Controle de estoque' })

const email = ref('')
const senha = ref('')
const erro = ref('')
const enviando = ref(false)

async function entrar() {
  erro.value = ''
  enviando.value = true
  try {
    const { etapa } = await $fetch('/api/auth/entrar', { method: 'POST', body: { email: email.value, senha: senha.value } })
    await navigateTo(etapa === 'mfa' ? '/painel/verificacao' : '/painel/cadastro-mfa', { replace: true })
  } catch (e) {
    erro.value = mensagemDeErro(e)
    senha.value = ''
  } finally {
    enviando.value = false
  }
}
</script>

<template>
  <h1 class="mb-1 text-xl font-semibold">Entrar no painel</h1>
  <p class="mb-5 text-sm text-texto-2">Depois da senha, o painel pede o código do aplicativo autenticador.</p>

  <form class="grid gap-4" @submit.prevent="entrar">
    <div>
      <label class="rotulo" for="email">E-mail</label>
      <input id="email" v-model="email" class="campo" type="email" autocomplete="username" required autofocus>
    </div>
    <div>
      <label class="rotulo" for="senha">Senha</label>
      <input id="senha" v-model="senha" class="campo" type="password" autocomplete="current-password" required>
    </div>
    <p v-if="erro" class="aviso-erro" role="alert">{{ erro }}</p>
    <button class="botao botao-primario" type="submit" :disabled="enviando">
      {{ enviando ? 'Conferindo…' : 'Continuar' }}
    </button>
  </form>
</template>
