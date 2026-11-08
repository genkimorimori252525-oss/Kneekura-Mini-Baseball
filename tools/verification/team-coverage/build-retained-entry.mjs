import { build } from 'esbuild';
import { mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
const outfile = resolve(process.argv[2]);
mkdirSync(dirname(outfile), { recursive: true });
await build({ entryPoints: ['tools/verification/team-coverage/retained-entry.ts'], outfile,
  bundle: true, platform: 'node', format: 'esm', packages: 'external', target: 'node26', sourcemap: false });
