<script setup lang="ts">
import { Boxes, LayoutDashboard, LogOut, Menu, X } from '@lucide/vue'

const props = defineProps<{ email?: string }>()

const menuAberto = ref(false)
const saindo = ref(false)

async function sair() {
  saindo.value = true
  try {
    await $fetch('/api/auth/sair', { method: 'POST' })
  } finally {
    await navigateTo('/painel/entrar', { replace: true })
  }
}
</script>

<template>
  <div class="flex min-h-screen">
    <div v-if="menuAberto" class="fixed inset-0 z-20 bg-slate-900/50 lg:hidden" @click="menuAberto = false" />

    <aside
      class="fixed inset-y-0 left-0 z-30 flex w-64 flex-col bg-lateral text-lateral-texto transition-transform lg:translate-x-0"
      :class="menuAberto ? 'translate-x-0' : '-translate-x-full'"
    >
      <div class="flex h-16 items-center gap-3 px-5 text-lg font-semibold text-white">
        <Boxes :size="24" class="text-acento" aria-hidden="true" />
        <span>Estoque</span>
        <button type="button" class="ml-auto grid size-10 place-items-center rounded-lg lg:hidden" aria-label="Fechar menu" @click="menuAberto = false">
          <X :size="20" aria-hidden="true" />
        </button>
      </div>

      <nav class="grid flex-1 content-start gap-1 px-3 py-2" aria-label="Principal">
        <NuxtLink to="/painel" class="flex h-10 items-center gap-3 rounded-lg bg-lateral-ativo px-3 text-sm font-medium text-white">
          <LayoutDashboard :size="20" class="text-acento" aria-hidden="true" />
          Visão geral
        </NuxtLink>
      </nav>

      <div class="flex items-center gap-3 border-t border-white/10 px-4 py-4">
        <span class="grid size-9 shrink-0 place-items-center rounded-full bg-lateral-ativo font-semibold text-white" aria-hidden="true">
          {{ (props.email ?? 'a').charAt(0).toUpperCase() }}
        </span>
        <span class="min-w-0 flex-1 truncate text-sm text-lateral-texto-forte">{{ props.email }}</span>
        <button
          type="button"
          class="grid size-9 place-items-center rounded-lg hover:bg-lateral-ativo hover:text-white disabled:opacity-50"
          aria-label="Sair"
          title="Sair"
          :disabled="saindo"
          @click="sair"
        >
          <LogOut :size="18" aria-hidden="true" />
        </button>
      </div>
    </aside>

    <div class="flex min-w-0 flex-1 flex-col lg:pl-64">
      <header class="sticky top-0 z-10 flex h-16 items-center gap-3 border-b border-borda bg-fundo/90 px-4 backdrop-blur sm:px-6">
        <button type="button" class="grid size-10 place-items-center rounded-lg hover:bg-suave lg:hidden" aria-label="Abrir menu" @click="menuAberto = true">
          <Menu :size="20" aria-hidden="true" />
        </button>
        <p class="font-semibold">Visão geral</p>
      </header>
      <main class="mx-auto w-full max-w-6xl flex-1 px-4 py-6 sm:px-6">
        <slot />
      </main>
    </div>
  </div>
</template>
