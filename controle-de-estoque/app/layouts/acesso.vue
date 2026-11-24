<script setup lang="ts">
import { Boxes } from '@lucide/vue'
</script>

<template>
  <div class="flex min-h-screen items-center justify-center px-4 py-10">
    <div class="w-full max-w-md">
      <div class="mb-6 flex items-center justify-center gap-3 text-lg font-semibold">
        <Boxes :size="24" class="text-acento" aria-hidden="true" />
        Controle de estoque
      </div>
      <main class="cartao p-6">
        <slot />
      </main>
      <p class="mt-4 text-center text-sm text-texto-2">Painel administrativo. Dados de demonstração, todos fictícios.</p>
    </div>
  </div>
</template>
