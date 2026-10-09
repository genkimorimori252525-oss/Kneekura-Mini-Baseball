import { isAbsolute } from 'node:path';
const cacheDir = process.env.BASEBALL_GATE_CACHE;
if (!cacheDir || !isAbsolute(cacheDir)) throw new Error('absolute task cache path required');
export default { cacheDir, test: { cache: false, include: ['src/host/world/SamePlateAppearanceNormalPrerequisites.acceptance.ts'] } };
