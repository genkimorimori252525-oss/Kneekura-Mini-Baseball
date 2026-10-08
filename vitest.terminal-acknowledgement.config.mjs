import { isAbsolute } from 'node:path';
const cacheDir = process.env.BASEBALL_GATE_CACHE;
if (cacheDir && !isAbsolute(cacheDir)) throw new Error('terminal acknowledgement cache must be absolute');
export default { ...(cacheDir ? { cacheDir } : {}),test:{ cache:false,include:[
  'src/host/world/ActualFoulTerminalAcknowledgement.acceptance.ts',
  'src/host/world/ActualFoulTerminalAcknowledgementRollback.acceptance.ts',
] } };
