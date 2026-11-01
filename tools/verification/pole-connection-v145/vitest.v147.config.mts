import {defineConfig} from 'vitest/config';
export default defineConfig({test:{include:['src/host/world/SamePlateAppearancePoleDepartureV147.acceptance.ts'],
  maxWorkers:1,minWorkers:1,pool:'forks',testTimeout:420_000}});
