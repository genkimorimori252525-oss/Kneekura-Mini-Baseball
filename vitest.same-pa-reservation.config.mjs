import { isAbsolute } from 'node:path';
const cacheDir=process.env.BASEBALL_GATE_CACHE;
if(!cacheDir||!isAbsolute(cacheDir))throw new Error('absolute private reservation gate cache required');
export default {cacheDir,test:{cache:false,include:['src/host/world/SamePlateAppearanceReservation.acceptance.ts']}};
