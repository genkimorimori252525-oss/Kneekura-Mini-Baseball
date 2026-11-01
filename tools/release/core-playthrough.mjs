// Plays whole games on the bundled Core without the UI and reports every stop.
// usage: node core-playthrough.mjs <native.js> <config.json> [--seed=N] [--pitches=N] [--resume=file] [--save=file]
import {readFileSync, writeFileSync} from 'node:fs';

const [nativePath, configPath, ...rest] = process.argv.slice(2);
const opt = Object.fromEntries(rest.map(a => a.replace(/^--/, '').split('=')));
globalThis.self = globalThis;
(0, eval)(readFileSync(nativePath, 'utf8') + ';globalThis.__core=KneekuraNativeMatchCore;');
const core = globalThis.__core;
const config = JSON.parse(readFileSync(configPath, 'utf8'));
if (opt.seed !== undefined) config.seed = Number(opt.seed) >>> 0;
const policies = config.experimentalMatchPoliciesV2;
const resume = opt.resume ? JSON.parse(readFileSync(opt.resume, 'utf8')) : undefined;
const host = policies ? core.createExperimentalMatchHostV2(config, policies, resume) : core.createLiveBaseballMatchWorkerV116(config, resume);
const command = {batting: 'auto', pitchType: 'auto', location: 'auto', managedTeam: 0, baserunning: 'balanced'};
const limit = Number(opt.pitches ?? 600);
const tally = {pitches: 0, swings: 0, contacts: 0, hits: 0, loose: 0, fallback: {}};
let last = host.captureContinuationV116();
const t0 = Date.now();
for (let n = 0; n < limit; n++) {
  const t1 = Date.now();
  let r;
  try {
    r = host.issuePitch(command);
  } catch (e) {
    const state = host.inspect();
    console.log('STOP', JSON.stringify({n, pitcher: state.pitcherPlayerId, batter: state.batterPlayerId, match: state.match && {inning: state.match.inning, half: state.match.half, outs: state.match.outs, balls: state.match.balls, strikes: state.match.strikes, bases: state.match.bases}, message: String(e.message).slice(0, 300), code: e.unresolvedV239?.code}));
    if (opt.trace) console.log(String(e.stack).split(String.fromCharCode(10)).slice(0, Number(opt.trace)).join(' | '));
    if (opt.save) writeFileSync(opt.save, JSON.stringify(last));
    break;
  }
  last = host.captureContinuationV116();
  tally.pitches++;
  if (r.play.diagnostics?.swingOffered) tally.swings++;
  if (r.play.contact) tally.contacts++;
  if (r.play.diagnostics?.loosePitchV1) tally.loose++;
  const fb = r.play.diagnostics?.pitchFallbackV1?.reason;
  if (fb) tally.fallback[fb] = (tally.fallback[fb] ?? 0) + 1;
  const m = r.match;
  if (opt.verbose) console.log(n + 1, r.pitcherPlayerId, r.pitchType, r.play.call, r.play.classification, 'I' + m.inning + m.half, m.outs + 'o', m.balls + '-' + m.strikes, JSON.stringify(m.score), (Date.now() - t1) + 'ms');
  if (r.finished) {console.log('FINISHED', JSON.stringify({score: m.score, n: n + 1})); break;}
}
console.log('TALLY', JSON.stringify(tally), 'seconds', ((Date.now() - t0) / 1000).toFixed(1));
