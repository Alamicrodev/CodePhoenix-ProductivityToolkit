// Kept separate from vite.config.ts on purpose: the docker dev container
// only installs production-ish deps, so vite.config.ts must never import
// from test-only packages (vitest is host/CI-only).
import { configDefaults, defineConfig, mergeConfig } from 'vitest/config'

import viteConfig from './vite.config'

export default mergeConfig(
  viteConfig,
  defineConfig({
    test: {
      environment: 'jsdom',
      setupFiles: './src/test/setup.ts',
      css: false,
      // Playwright owns e2e/ — keep vitest away from those specs
      exclude: [...configDefaults.exclude, 'e2e/**'],
    },
  }),
)
