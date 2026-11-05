// Shared measured clips: a config's measuredClips (about 51 MB, the same in every calibration config) is stored once, named by
// its SHA-256, and the config keeps only "sha256:<hex>" in its place, so a config shrinks to its players and policies.
// The string stays where the clips were, so the key order (and with it the game) is unchanged once resolved.
// Store: $KBM_CLIPS_DIR, else K:/kbm-work/clips.
// usage: node tools/calibration/clips-ref.mjs <config.json>...   (rewrites each config in place; a config already shared is left)
import {createHash} from 'node:crypto';
import {existsSync, mkdirSync, readFileSync, renameSync, writeFileSync} from 'node:fs';

export const CLIPS_DIR = process.env.KBM_CLIPS_DIR || 'K:/kbm-work/clips';
const PREFIX = 'sha256:';

// Puts the shared clips back into a config read from disk; a config with its own clips is returned as it is.
export function resolveMeasuredClips(config) {
  if (typeof config.measuredClips !== 'string') return config;
  if (!config.measuredClips.startsWith(PREFIX)) throw Error('measuredClips: unknown reference ' + config.measuredClips);
  const hex = config.measuredClips.slice(PREFIX.length), text = readFileSync(`${CLIPS_DIR}/${hex}.json`, 'utf8');
  if (createHash('sha256').update(text).digest('hex') !== hex) throw Error('measuredClips: store file does not match ' + hex);
  config.measuredClips = JSON.parse(text);
  return config;
}

// Stores the config's clips (once per content) and returns the config with the reference in their place.
export function shareMeasuredClips(config) {
  if (typeof config.measuredClips === 'string' || config.measuredClips === undefined) return config;
  const text = JSON.stringify(config.measuredClips), hex = createHash('sha256').update(text).digest('hex'), file = `${CLIPS_DIR}/${hex}.json`;
  if (!existsSync(file)) {mkdirSync(CLIPS_DIR, {recursive: true}); writeFileSync(file + '.tmp', text); renameSync(file + '.tmp', file);}
  config.measuredClips = PREFIX + hex;
  return config;
}

if (process.argv[1]?.replace(/\\/g, '/').endsWith('tools/calibration/clips-ref.mjs')) {
  for (const path of process.argv.slice(2)) {
    const config = JSON.parse(readFileSync(path, 'utf8'));
    if (typeof config.measuredClips === 'string') {console.log('already shared', path); continue;}
    // The round trip must give back the same clips before the config loses them.
    const before = JSON.stringify(config.measuredClips), shared = shareMeasuredClips(config);
    if (JSON.stringify(resolveMeasuredClips(JSON.parse(JSON.stringify(shared))).measuredClips) !== before) throw Error('round trip differs: ' + path);
    writeFileSync(path + '.tmp', JSON.stringify(shared)); renameSync(path + '.tmp', path);
    console.log('shared', path, shared.measuredClips.slice(0, 19));
  }
}
