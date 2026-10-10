import { fileURLToPath } from 'node:url';
export default {
  ...(process.env.BASEBALL_GATE_CACHE ? { cacheDir: process.env.BASEBALL_GATE_CACHE } : {}),
  // Structural author tests only. The combined source uses the real endpoint
  // module; these tests explicitly mock its proofs in either configuration.
  resolve: { alias: [{ find: /^\.\/SamePlateAppearanceTerminalEndpointFromSqlite$/,
    replacement: fileURLToPath(new URL('./src/host/world/SamePlateAppearanceTerminalEndpoint.structural-mock.test-support.ts', import.meta.url)) }] },
  test: { cache: false, include: ['src/host/world/SamePlateAppearanceTerminalSettlement.test.ts'] },
};
