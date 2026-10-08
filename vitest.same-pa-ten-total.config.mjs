import { isAbsolute } from 'node:path';
const cacheDir=process.env.BASEBALL_GATE_CACHE;
if(!cacheDir||!isAbsolute(cacheDir))throw new Error('absolute private ten-TOTAL gate cache required');
export default {cacheDir,test:{cache:false,include:['src/host/world/SamePlateAppearanceTotalSet.acceptance.ts']}};
