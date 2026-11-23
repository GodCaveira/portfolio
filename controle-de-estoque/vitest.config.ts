import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    include: ['tests/**/*.test.ts'],
    // Os testes disputam linhas de verdade no PostgreSQL; várias rodadas levam alguns segundos.
    testTimeout: 60_000,
  },
})
