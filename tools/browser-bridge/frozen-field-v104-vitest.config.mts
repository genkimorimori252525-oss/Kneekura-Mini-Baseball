import { defineConfig } from 'vitest/config';
export default defineConfig({ test: {
  include: ['src/core/sim/fielding/LiveFieldPlayV1.test.ts'],
  setupFiles: ['tools/browser-bridge/frozen-field-v104-vitest-setup.ts'],
  maxWorkers: 1, minWorkers: 1,
} });
