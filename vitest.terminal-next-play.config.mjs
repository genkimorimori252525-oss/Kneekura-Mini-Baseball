import { isAbsolute } from 'node:path';
const cacheDir=process.env.BASEBALL_GATE_CACHE;
if(cacheDir&&!isAbsolute(cacheDir))throw new Error('terminal next-play cache must be absolute');
export default {...(cacheDir?{cacheDir}:{}),test:{cache:false,include:['src/host/world/FoulTerminalNextPlay.acceptance.ts']}};
