// Plays whole games on the bundled Core without the UI and reports every stop.
// usage: node core-playthrough.mjs <native.js> <config.json> [--seed=N] [--pitches=N] [--resume=file] [--save=file]
// --checkpoint=file [--every=N]: every N pitches (25) the game so far is saved there: the continuation, the pitch count,
// the length of the records file and the tally. --from=file goes on from such a checkpoint, cutting the records file back
// to the length it had then, so a game the guard stopped part way ends with the same records as one played straight through.
// The checkpoint is rewritten as finished when the game ends. Omitting both keeps the old run exactly.
import {createHash} from 'node:crypto';
import {appendFileSync, existsSync, readFileSync, renameSync, statSync, truncateSync, writeFileSync} from 'node:fs';
import {resolveMeasuredClips} from '../calibration/clips-ref.mjs';

const [nativePath, configPath, ...rest] = process.argv.slice(2);
const opt = Object.fromEntries(rest.map(a => a.replace(/^--/, '').split('=')));
globalThis.self = globalThis;
const nativeSource = readFileSync(nativePath, 'utf8');
(0, eval)(nativeSource + ';globalThis.__core=KneekuraNativeMatchCore;');
const core = globalThis.__core;
// A config may hold its measured clips as a shared reference (tools/calibration/clips-ref.mjs).
const config = resolveMeasuredClips(JSON.parse(readFileSync(configPath, 'utf8')));
if (opt.seed !== undefined) config.seed = Number(opt.seed) >>> 0;
// --batters=key:value,key:value sets those values on every position player, for ability response curves.
if (opt.batters) for (const player of config.players) if (/-b\d$/.test(player.playerId))
  for (const pair of opt.batters.split(',')) {const [key, value] = pair.split(':'); player.physical[key] = Number(value);}
// --pitchers=key:value,key:value sets those values on every pitcher (player ids ending -p<n>), e.g. pitchTunnelV1:1.
// --pitchersScale=key:factor multiplies that physical value of every pitcher (e.g. commandStdMeters of individually fitted pitchers).
if (opt.pitchersScale) for (const player of config.players) if (/-p\d+$/.test(player.playerId))
  for (const pair of opt.pitchersScale.split(',')) {const [key, value] = pair.split(':'); if (typeof player.physical[key] === 'number') player.physical[key] *= Number(value);}
// --pitchersSet=key:value sets that physical value of every pitcher (e.g. pitchSpinScatterV1).
if (opt.pitchersSet) for (const player of config.players) if (/-p\d+$/.test(player.playerId))
  for (const pair of opt.pitchersSet.split(',')) {const [key, value] = pair.split(':'); player.physical[key] = Number(value);}
// --battersScale=key:factor does the same for every other player (e.g. zoneJudgmentStdMeters; a.b for a nested value, e.g.
// swingDecision.threshold).
if (opt.battersScale) for (const player of config.players) if (!/-p\d+$/.test(player.playerId))
  for (const pair of opt.battersScale.split(',')) {
    const [key, value] = pair.split(':'), path = key.split('.'), last = path.pop(), at = path.reduce((o, k) => o?.[k], player.physical);
    if (typeof at?.[last] === 'number') at[last] *= Number(value);
  }
if (opt.pitchers) for (const player of config.players) if (/-p\d+$/.test(player.playerId))
  for (const pair of opt.pitchers.split(',')) {const [key, value] = pair.split(':'); player.physical[key] = Number(value);}
if (opt.skipField) config.skipFieldPlayV1 = true;
// The match keeps every pitch's whole play in its history for looking back; a tool run keeps only the last (--history=all keeps them).
// Older builds reject the input, so it is set only for a build that knows it.
if (opt.history !== 'all' && nativeSource.includes('historyLimitV1')) config.historyLimitV1 ??= 1;
// --observe=key:value (a_b for a list) and --decision=key:value set the batter observation policy and every batter's swing decision.
// --observeJson=key:{json} sets one observation value that is an object, e.g. misreadDestinationGroupsV1:{offspeed:[0.1,10]}
// (bare names are quoted, since a shell on the way may drop the quotes).
if (opt.observeJson) {const at = opt.observeJson.indexOf(':');
  config.batterObservationV151[opt.observeJson.slice(0, at)] = JSON.parse(opt.observeJson.slice(at + 1).replace(/([{,]\s*)([A-Za-z_]\w*)\s*:/g, '$1"$2":'));}
if (opt.observe) for (const pair of opt.observe.split(',')) {const [key, value] = pair.split(':'); config.batterObservationV151[key] = value === 'true' ? true : value === 'false' ? false : value.includes('_') ? value.split('_').map(Number) : Number(value);}
// --lift=nathan2017 sets the match's lift curve (liftCurveV1).
if (opt.lift) config.liftCurveV1 = opt.lift;
// --priorWeight=w sets the batter memory's pull toward a remembered pitch (memoryPolicy.unprofiledPriorWeight).
if (opt.priorWeight !== undefined) config.batterObservationV151.memoryPolicy = {...config.batterObservationV151.memoryPolicy, unprofiledPriorWeight: Number(opt.priorWeight)};
if (opt.decision) for (const player of config.players) if (/-b\d$/.test(player.playerId) && player.physical.swingDecision)
  for (const pair of opt.decision.split(',')) {const [key, value] = pair.split(':'); player.physical.swingDecision = {...player.physical.swingDecision, [key]: Number(value)};}
const policies = config.experimentalMatchPoliciesV2;
const from = opt.from ? JSON.parse(readFileSync(opt.from, 'utf8')) : null;
if (from && (from.version !== 'core_playthrough_checkpoint_v1' || from.seed !== config.seed || from.finished)) throw Error('checkpoint is not an unfinished game of this seed: ' + opt.from);
if (from && opt.records) truncateSync(opt.records, from.recordsBytes);
const resume = from ? from.continuation : opt.resume ? JSON.parse(readFileSync(opt.resume, 'utf8')) : undefined;
const host = policies ? core.createExperimentalMatchHostV2(config, policies, resume) : core.createLiveBaseballMatchWorkerV116(config, resume);
const command = {batting: 'auto', pitchType: 'auto', location: opt.location ?? 'auto', managedTeam: 0, baserunning: 'balanced'};
const limit = Number(opt.pitches ?? 600);
const tally = from ? from.tally : {steals: true, pitches: 0, swings: 0, contacts: 0, hits: 0, loose: 0, fallback: {}};
const every = Number(opt.every ?? 25);
const checkpoint = (pitches, finished) => {
  if (!opt.checkpoint) return;
  const next = opt.checkpoint + '.next';
  writeFileSync(next, JSON.stringify({version: 'core_playthrough_checkpoint_v1', seed: config.seed, pitches, finished,
    recordsBytes: opt.records && existsSync(opt.records) ? statSync(opt.records).size : 0, tally, continuation: finished ? null : last}));
  renameSync(next, opt.checkpoint);
};
let last = host.captureContinuationV116();
// Where the ball really passed, not where the batter thought it would.
const crossingAt = (frames, z) => {
  for (let i = 1; i < frames.length; i++) {
    const a = frames[i - 1].ball?.position, c = frames[i].ball?.position;
    if (a && c && a.z !== c.z && (a.z - z) * (c.z - z) <= 0) {const u = (z - a.z) / (c.z - a.z); return {x: a.x + (c.x - a.x) * u, y: a.y + (c.y - a.y) * u};}
  }
  return null;
};
// --records=file appends one line per pitch for core-stats.mjs; --aim=1 adds where the pitcher aimed (requested, selected, location).
// --miss=1 adds, on every pitch the batter judged (takes too; the late look and the bat only on swings), where the batter expected the ball (req, at the commit), the late look's wanted and applied shift, the
// drawn aim and timing errors, the ball at the bat's contact plane (x, y, tick) and the bat's contact tick: miss = ball - (req + late + aim).
// --judge=1 adds, on every pitch, where the swing decision put the ball (obs: the forecast it judged, est: with the zone-judgment error).
const tickAt = (frames, z) => {
  for (let i = 1; i < frames.length; i++) {
    const a = frames[i - 1].ball?.position, c = frames[i].ball?.position;
    if (a && c && a.z !== c.z && (a.z - z) * (c.z - z) <= 0) {const u = (z - a.z) / (c.z - a.z); return {x: a.x + (c.x - a.x) * u, y: a.y + (c.y - a.y) * u, tick: frames[i - 1].tick + (frames[i].tick - frames[i - 1].tick) * u};}
  }
  return null;
};
const missRecord = (r, d) => {
  const late = d.lateEvidenceV121, plane = late?.contactPlaneZ ?? d.zoneJudgment?.observedForecastPosition?.z ?? .15, req = d.courseRecognitionV87?.batter?.requestedPosition;
  return {plane, req: req ? {x: req.x, y: req.y, z: req.z} : null, lateReq: late?.requestedOffset ?? null, late: late?.applied ? late.offset : null,
    aimErr: d.aimErrorMeters ?? null, ball: tickAt(r.frames, plane), batTick: d.referenceContactTick ?? null, desired: d.desiredContactElapsedSeconds ?? null, f0: r.frames[0]?.tick ?? null};
};
const pitchRecord = (r, seed) => {
  const p = r.play, d = p.diagnostics ?? {}, s = p.localScoringV100, b = r.beforeMatch, zone = d.strikeZone, v = p.contact?.exitVelocity;
  const plane = d.zoneJudgment?.observedForecastPosition?.z ?? .15, at = p.contact?.ballCenter ?? crossingAt(r.frames, plane), t = d.batterTechniqueV1;
  return {seed, inning: b.inning, half: b.half, outs: b.outs, balls: b.balls, strikes: b.strikes, batter: r.batterPlayerId, pitcher: r.pitcherPlayerId, pitch: r.pitchType, kmh: r.speedKmh,
    play: p.classification, scoring: s?.classification ?? null, call: p.call, swing: !!d.swingOffered, foulOrContact: !!p.contact,
    x: at?.x ?? null, y: at?.y ?? null, zone: zone ? {half: zone.halfWidth, low: zone.lowerY, high: zone.upperY} : null,
    technique: t?.technique ?? null, techniquePlan: t?.planStatus ?? null, techniqueReason: t?.planReason ?? t?.selectionReason ?? null, exitSpin: t?.battedSpin ?? null,
    timing: d.timingErrorSeconds ?? null, exit: v ? {kmh: Math.hypot(v.x, v.y, v.z) * 3.6, launch: Math.atan2(v.y, Math.hypot(v.x, v.z)) * 180 / Math.PI, spray: Math.atan2(v.x, v.z) * 180 / Math.PI} : null,
    hitBases: s?.hitBases ?? null, homeRuns: s?.homeRuns ?? null, runs: r.match.score.away + r.match.score.home - b.score.away - b.score.home, finished: r.finished,
    basesBefore: occupied(b.bases), basesAfter: occupied(r.match.bases), outsAfter: r.match.outs, halfAfter: r.match.half, spin: battedSpin(p.contact, r.batterPlayerId),
    ...(d.pitchRecognitionV2 ? {recog: {ok: d.pitchRecognitionV2.recognized, read: d.pitchRecognitionV2.readId}} : {}), ...(d.zoneIntentV1 ? {zint: {moved: d.zoneIntentV1.moved, wantIn: d.zoneIntentV1.wantIn}} : {}),
    ...(opt.judge && d.zoneJudgment ? {judge: {obs: {x: d.zoneJudgment.observedForecastPosition.x, y: d.zoneJudgment.observedForecastPosition.y}, est: {x: d.zoneJudgment.estimatedPosition.x, y: d.zoneJudgment.estimatedPosition.y},
      ...(d.zoneJudgment.arrivalSeconds ? {arr: d.zoneJudgment.arrivalSeconds, cross: tickAt(r.frames, d.zoneJudgment.observedForecastPosition.z)?.tick ?? null, f0: r.frames[0]?.tick ?? null} : {})}} : {}),
    ...(opt.miss && d.courseRecognitionV87?.batter ? {miss: missRecord(r, d)} : {}),...(d.courseRecognitionV87?.pitcher && opt.aim ? {aim: {req: d.courseRecognitionV87.pitcher.requestedPosition, sel: d.courseRecognitionV87.pitcher.selectedPosition, loc: d.courseRecognitionV87.pitcher.selectedLocation}} : {})};
};
// Batted-ball spin in rpm: back (+) or top (-), and side, read in the batter's frame.
const bats = new Map(config.players.map(player => [player.playerId, player.bats]));
const battedSpin = (contact, batter) => {
  if (!contact?.exitVelocity || !contact.exitSpin || !core.observeBattedBallSpinV123) return null;
  try {
    const o = core.observeBattedBallSpinV123({velocityMps: contact.exitVelocity, spinRadPerSecond: contact.exitSpin, bats: bats.get(batter) ?? 'R'});
    return o.basisStatus === 'DEFINED' ? {back: Math.round(o.backspinSignedRadPerSecond * 30 / Math.PI), side: Math.round(o.rightCurvingSpinRadPerSecond * 30 / Math.PI)} : null;
  } catch {return null;}
};
// Occupied bases as "13" for first and third, "" when empty.
const occupied = bases => bases ? ['first', 'second', 'third'].map((k, i) => bases[k] ? i + 1 : '').join('') : null;
const t0 = Date.now();
// --hash=1 fingerprints every pitch record, to prove a speed change kept results identical.
const hash = opt.hash ? createHash('sha256') : null;
for (let n = from ? from.pitches : 0; n < limit; n++) {
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
  hash?.update(JSON.stringify(r));
  if (opt.records) appendFileSync(opt.records, JSON.stringify(pitchRecord(r, config.seed)) + String.fromCharCode(10));
  tally.pitches++;
  for (const e of r.events) if (['stolen_base', 'caught_stealing', 'picked_off', 'pickoff_safe'].includes(e.kind)) tally[e.kind] = (tally[e.kind] ?? 0) + 1;
  if (r.play.diagnostics?.pitchFallbackV1) tally.simple = (tally.simple ?? 0) + 1;
  const tried = r.play.diagnostics?.batterTechniqueV1;
  if (tried?.technique) {const row = (tally.technique ??= {})[tried.technique] ??= {tried: 0, planned: 0, fellBack: 0}; row.tried++; row[tried.planStatus === 'PLANNED' ? 'planned' : 'fellBack']++;}
  if (r.play.diagnostics?.swingOffered) tally.swings++;
  if (r.play.contact) tally.contacts++;
  if (r.play.diagnostics?.loosePitchV1) tally.loose++;
  const fb = r.play.diagnostics?.pitchFallbackV1?.reason ?? r.play.contact?.fieldFallbackV1;
  if (fb) tally.fallback[fb] = (tally.fallback[fb] ?? 0) + 1;
  const m = r.match;
  if (opt.loose && r.play.diagnostics?.looseDetailV2) {const l = r.play.diagnostics.looseDetailV2; console.log('LOOSE', r.play.diagnostics?.loosePitchV1?.sourceProvenance?.sourceId ?? r.pitchType, l.live ? 'glove-failed' : 'missed', JSON.stringify(l.plane));} else if (opt.loose) console.log('CAUGHT', r.play.diagnostics?.loosePitchV1?.sourceProvenance?.sourceId ?? r.pitchType);
  if (opt.verbose) console.log(n + 1, r.pitcherPlayerId, r.pitchType, r.play.call, r.play.classification, 'I' + m.inning + m.half, m.outs + 'o', m.balls + '-' + m.strikes, JSON.stringify(m.score), (Date.now() - t1) + 'ms');
  if (r.finished && opt.lastDetail) console.log('LAST', JSON.stringify({before: r.beforeMatch, after: r.match, rules: {...r.play.rules, match: undefined}}));
  if (r.finished) {console.log('FINISHED', JSON.stringify({score: m.score, n: n + 1})); checkpoint(n + 1, true); break;}
  if ((n + 1) % every === 0) checkpoint(n + 1, false);
}
// The state the game ended in, comparable between a straight run and one resumed from a checkpoint.
if (opt.checkpoint || opt.from) console.log('FINAL', createHash('sha256').update(JSON.stringify(last)).digest('hex'));
if (hash) console.log('HASH', hash.update(JSON.stringify(last)).digest('hex'));
console.log('TALLY', JSON.stringify(tally), 'seconds', ((Date.now() - t0) / 1000).toFixed(1));
