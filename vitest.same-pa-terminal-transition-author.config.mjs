import { fileURLToPath } from 'node:url';
export default {
  ...(process.env.BASEBALL_GATE_CACHE ? { cacheDir: process.env.BASEBALL_GATE_CACHE } : {}),
  resolve: { alias: [{ find: /^\.\/SamePlateAppearanceTerminalEndpointFromSqlite$/,
    replacement: fileURLToPath(new URL('./src/host/world/SamePlateAppearanceTerminalEndpoint.structural-mock.test-support.ts', import.meta.url)) }] },
  test: { cache: false, include: ['src/host/world/SamePlateAppearanceTerminalTransition.test.ts', 'src/host/world/SamePlateAppearanceTerminalSettlement.test.ts'] },
};
