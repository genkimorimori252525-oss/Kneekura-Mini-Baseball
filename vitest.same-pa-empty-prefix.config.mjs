import { isAbsolute } from 'node:path';
const cacheDir=process.env.BASEBALL_GATE_CACHE;
if(!cacheDir||!isAbsolute(cacheDir))throw new Error('absolute private empty-prefix gate cache required');
export default {cacheDir,test:{cache:false,include:['src/host/world/SamePlateAppearanceEmptyPrefix.acceptance.ts']}};
