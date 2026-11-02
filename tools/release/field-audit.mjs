// Defense audit on real game plays. Plays are captured once and replayed on any build, so a fielding
// change is judged on identical batted balls. Run from the repo root.
//   capture <native.js> <cfg.json> <out.jsonl> --seed=N [--pitches=N] [--inject=key:CORE_EXPORT,...]
//   replay  <native.js> <out.jsonl> --in=a.jsonl,b.jsonl [--shard=i/n] [--only=ground|air] [--inject=key:CORE_EXPORT,...] [--grass=CORE_EXPORT]
//   report  <replay.jsonl...> [--base=<replay.jsonl,...>] [--list=force|tag|throw|tagup|ofdrop]
//   scene   <native.js> <capture.jsonl> <pitchIndex> [--inject=...] [--grass=CORE_EXPORT] [--nine] [--frames=POS] [--every=N]
// --nine prints each of the nine fielders' role changes with the observation it used, the alternatives
// it scored and why it chose. --frames prints the ball and one position frame by frame.
import {appendFileSync, readFileSync, writeFileSync} from 'node:fs';
import {detectFieldSymptoms} from './field-audit-detect.mjs';

const [mode, ...rest] = process.argv.slice(2), NL = String.fromCharCode(10);
const flags = Object.fromEntries(rest.filter(a => a.startsWith('--')).map(a => {const [k, ...v] = a.slice(2).split('='); return [k, v.length ? v.join('=') : true];}));
const args = rest.filter(a => !a.startsWith('--'));
const lines = file => readFileSync(file, 'utf8').split(/\r?\n/).filter(Boolean).map(l => JSON.parse(l));

function load(nativePath, needle) {
  globalThis.self = globalThis;
  let src = readFileSync(nativePath, 'utf8');
  const hook = 'field = simulateLiveFieldPlayV1(fieldWithLeads);', tail = src.lastIndexOf('return __toCommonJS(');
  if (!src.includes(hook) || tail < 0) throw new Error('bundle shape changed: update field-audit hooks');
  src = src.slice(0, tail) + 'globalThis.__audit={sim:simulateLiveFieldPlayV1,reduce:reducePlayableMatchV1,score:scoreLivePlayV100};' + src.slice(tail);
  if (needle) src = src.replace(hook, 'globalThis.__capture?.({input:fieldWithLeads,before:beforeMatch,batterRunnerId:c.batterPlayerId,innings,bunt:batting==="bunt"});' + hook);
  (0, eval)(src + ';globalThis.__core=KneekuraNativeMatchCore;');
  return {core: globalThis.__core, ...globalThis.__audit};
}
const injected = core => Object.fromEntries((flags.inject ? String(flags.inject).split(',') : []).map(k => {
  const [key, name] = k.split(':'); if (core[name] === undefined) throw new Error('no core export ' + name); return [key, core[name]];}));
/** Field-level overrides for what a game policy changes outside the field call. */
const fieldInput = (raw, core) => {
  const extra = injected(core), {fieldRangeV1, fieldThrowV1, ...plain} = extra, grass = flags.grass ? core[flags.grass] : null;
  const input = grass ? {...raw, physics: {...raw.physics, ground: {...raw.physics.ground, material: grass}}, field: {...raw.field, groundMaterialV101: grass}} : raw;
  if (!fieldRangeV1) return {...input, ...plain};
  const placed = input.fielders.map(f => {const p = core.liveFieldPlacementV1?.(f.defensivePosition, f.position); return p ? {...f, position: {...f.position, x: p.x, z: p.z}} : f;});
  return {...input, ...plain, fielders: placed, fieldRangePolicyV1: fieldRangeV1};
};

if (mode === 'capture') {
  const [nativePath, configPath, out] = args, {core} = load(nativePath, true), config = JSON.parse(readFileSync(configPath, 'utf8'));
  config.seed = Number(flags.seed) >>> 0; Object.assign(config, injected(core));
  const policies = config.experimentalMatchPoliciesV2, host = policies ? core.createExperimentalMatchHostV2(config, policies) : core.createLiveBaseballMatchWorkerV116(config);
  const command = {batting: 'auto', pitchType: 'auto', location: 'auto', managedTeam: 0, baserunning: 'balanced'};
  let cap = null; globalThis.__capture = x => {cap = x;};
  for (let n = 0; n < Number(flags.pitches ?? 450); n++) {
    cap = null; let r;
    try {r = host.issuePitch(command);} catch (e) {console.log('STOP', n, String(e.message).slice(0, 160)); break;}
    if (cap) {
      const v = r.play.contact.exitVelocity, s = r.play.localScoringV100;
      appendFileSync(out, JSON.stringify({seed: config.seed, n, cap, base: {classification: r.play.classification, scoring: s?.classification ?? null, hitBases: s?.hitBases ?? null, errors: s?.errors?.length ?? 0,
        kmh: Math.hypot(v.x, v.y, v.z) * 3.6, la: Math.atan2(v.y, Math.hypot(v.x, v.z)) * 180 / Math.PI, spray: Math.atan2(v.x, v.z) * 180 / Math.PI}}) + NL);
    }
    if (r.finished) {console.log('finished', n, JSON.stringify(r.match.score)); break;}
  }
} else if (mode === 'replay') {
  const [nativePath, out] = args, {core, sim, reduce, score} = load(nativePath), [si, sn] = String(flags.shard ?? '0/1').split('/').map(Number);
  const rows = String(flags.in).split(',').flatMap(lines).filter(r => r.base.classification !== 'foul' && r.base.scoring !== 'plate_appearance_continues')
    .filter(r => flags.only === 'ground' ? r.base.la < 10 : flags.only === 'air' ? r.base.la >= 10 : true);
  writeFileSync(out, '');
  rows.forEach((row, i) => {
    if (i % sn !== si) return;
    const {cap, base} = row, input = fieldInput(cap.input, core), rec = {seed: row.seed, n: row.n, kmh: base.kmh, la: base.la, spray: base.spray, on: Object.values(cap.before.bases).filter(Boolean).length, outs: cap.before.outs, was: base.scoring};
    try {
      const field = sim(input);
      if (!field.end.complete) rec.fail = 'INCOMPLETE ' + field.end.reason;
      else {
        const result = reduce({match: cap.before, batterRunnerId: cap.batterRunnerId, regulationInnings: cap.innings, event: {kind: 'field_play', facts: {...field.ruleFacts, buntAttempt: cap.bunt}}});
        if (result.kind === 'unresolved') rec.fail = 'RULE ' + result.reason;
        else {const s = score({before: cap.before, batterRunnerId: cap.batterRunnerId, bunt: cap.bunt, input, field, rules: result, regulationInnings: cap.innings}); Object.assign(rec, {scoring: s.classification, hitBases: s.hitBases, errors: s.errors.length, sym: detectFieldSymptoms({field, input, outsBefore: cap.before.outs})});}
      }
    } catch (e) {rec.fail = 'ERROR ' + String(e.message).slice(0, 120);}
    appendFileSync(out, JSON.stringify(rec) + NL);
  });
} else if (mode === 'report') {
  const hit = r => r.hitBases > 0 && r.hitBases < 4, bip = r => !['home_run', 'sacrifice_fly', 'sacrifice_bunt'].includes(r.scoring), med = xs => {const s = xs.filter(x => x !== null && x !== undefined).sort((a, b) => a - b); return s.length ? s[s.length >> 1] : null;};
  const rate = l => {const b = l.filter(bip); return b.length ? (b.filter(hit).length / b.length).toFixed(3).replace(/^0/, '') + ' (' + b.length + ')' : '-';};
  const LA = [['<-10', -999, -10], ['-10..0', -10, 0], ['0..10', 0, 10], ['10..25', 10, 25], ['25..50', 25, 50], ['>=50', 50, 999]], EV = [['<113', 0, 113], ['113-129', 113, 129], ['129-145', 129, 145], ['145-161', 145, 161], ['>=161', 161, 999]];
  const show = (name, rows) => {
    const ok = rows.filter(r => r.scoring && r.sym), out = ok.filter(r => !['base_hit', 'reached_on_error', 'home_run'].includes(r.scoring));
    console.log('== ' + name, 'balls', rows.length, 'failed', rows.length - ok.length, 'BABIP', rate(ok));
    console.log(['LA/EV'.padEnd(8), ...EV.map(e => e[0].padEnd(12)), 'all'].join(' '));
    for (const [n, lo, hi] of LA) console.log([n.padEnd(8), ...EV.map(([, a, b]) => rate(ok.filter(r => r.la >= lo && r.la < hi && r.kmh >= a && r.kmh < b)).padEnd(12)), rate(ok.filter(r => r.la >= lo && r.la < hi))].join(' '));
    console.log(['GB<10'.padEnd(8), ...EV.map(([, a, b]) => rate(ok.filter(r => r.la < 10 && r.kmh >= a && r.kmh < b)).padEnd(12)), rate(ok.filter(r => r.la < 10))].join(' '));
    console.log('LD', rate(ok.filter(r => r.la >= 10 && r.la < 25)), ' FB', rate(ok.filter(r => r.la >= 25 && r.la < 50)), ' PU', rate(ok.filter(r => r.la >= 50)));
    const noOut = r => ['base_hit', 'reached_on_error'].includes(r.scoring);
    const force = ok.filter(r => r.sym.force && noOut(r)), tag = ok.filter(r => r.sym.tag && noOut(r));
    const held = ok.flatMap(r => (r.sym.thr ?? []).filter(x => x.margin >= .3 && x.cover <= 4 && x.threwElse === null).map(x => ({...x, r})));
    console.log('missed force', force.length, ' missed tag', tag.length, ' held ball with an out available', held.length, JSON.stringify(Object.fromEntries(Object.entries(Object.groupBy(held, x => x.by + '>' + x.base)).map(([k, v]) => [k, v.length]).sort((a, b) => b[1] - a[1]).slice(0, 8))));
    const c = ok.map(r => r.sym.cov), n = c.length || 1;
    console.log('covers: men per play', (c.reduce((s, x) => s + x.coverers, 0) / n).toFixed(2), ' two on one bag', c.filter(x => x.dupFrames > 0).length + '/' + n);
    const tu = {}; for (const r of ok) if (r.sym.fly && r.sym.fly.outs < 2 && ['LF', 'CF', 'RF'].includes(r.sym.fly.who)) for (const u of r.sym.fly.tu) {const k = 'from' + u.from + (r.sym.fly.depth >= 75 ? ' deep' : ' short'), a = tu[k] ??= {runners: 0, onBag: 0, advanced: 0, out: 0}; a.runners++; if (u.away <= 1) a.onBag++; if (u.adv > 0) a.advanced++; if (u.out) a.out++;}
    console.log('tag-up', JSON.stringify(tu));
    const of = ok.filter(r => r.sym.of), hang = r => r.sym.fly ? r.sym.fly.t : r.sym.of.hang;
    console.log('OF catch by hang', [[0, 3], [3, 4], [4, 5], [5, 9]].map(([a, b]) => {const s = of.filter(r => r.la >= 10 && hang(r) >= a && hang(r) < b); return a + '-' + b + 's ' + s.filter(r => r.sym.fly).length + '/' + s.length;}).join('  '));
    const g = of.filter(r => !r.sym.fly && r.sym.of.pickT !== null);
    console.log('OF pickup: depth', med(g.map(r => r.sym.of.pickR)), 'm  t', med(g.map(r => r.sym.of.pickT)), 's  to the wall', g.filter(r => r.sym.of.pickR >= 100).length + '/' + g.length, ' extra base', g.filter(r => r.hitBases >= 2 && r.hitBases < 4).length, ' fumbles', of.reduce((s, r) => s + r.sym.of.fumbles, 0));
    if (flags.list) {
      const pick = {force, tag, throw: [...new Set(held.map(x => x.r))], tagup: ok.filter(r => r.sym.fly?.tu.length && r.sym.fly.outs < 2), ofdrop: of.filter(r => r.la >= 10 && !r.sym.fly && r.sym.of.hang >= 3.5)}[flags.list];
      for (const r of pick.slice(0, 20)) console.log(r.seed, r.n, Math.round(r.kmh) + 'km/h', Math.round(r.la) + 'deg', 'spray', Math.round(r.spray), 'on', r.on, 'outs', r.outs, r.scoring, JSON.stringify({force: r.sym.force, tag: r.sym.tag, thr: r.sym.thr, fly: r.sym.fly}));
    }
  };
  if (flags.base) show('base', String(flags.base).split(',').flatMap(lines));
  show('now', args.flatMap(lines));
} else if (mode === 'scene') {
  const [nativePath, file, indexText] = args, {core, sim} = load(nativePath), row = lines(file).find(r => r.n === Number(indexText)), base = row.cap.input;
  const input = {...fieldInput(base, core), recordDecisionTraceV118: true}, pos = id => base.fielders.find(f => f.playerId === id)?.defensivePosition, t0 = base.ball.elapsedSeconds;
  const field = sim(input), rel = t => (t - t0).toFixed(2);
  console.log(JSON.stringify(row.base));
  console.log(field.facts.filter(f => !['runner_base_departure', 'territory_determined'].includes(f.kind)).map(f => f.kind.replace('controlled_', '') + '@' + rel(f.elapsedSeconds) + (f.playerId ? ':' + pos(f.playerId) : f.runnerId ? ':' + f.runnerId : '') + (f.base ? '>' + f.base : '') + (f.receiverPlayerId ? ' to ' + pos(f.receiverPlayerId) : '')).join(' | '));
  const tel = field.diagnostics.aiTelemetry; let last = '';
  for (const d of tel.holderDecisions) {if (d.state === 'waiting_transfer') continue; const k = d.playerId + d.state + d.base; if (k !== last) console.log('holder', rel(d.elapsedSeconds), pos(d.playerId), d.state, 'base', d.base ?? '-', 'margin', d.margin?.toFixed?.(2) ?? '-'); last = k;}
  last = ''; for (const d of tel.runnerDecisions ?? []) {const k = d.runnerId + d.targetBase + d.reason; if (k !== last) console.log('runner', rel(d.elapsedSeconds), d.runnerId, '>' + d.targetBase, d.reason, 'defense', d.defenderControlSeconds?.toFixed?.(2) ?? '-', 'arrival', d.runnerArrivalSeconds?.toFixed?.(2) ?? '-'); last = k;}
  if (flags.nine) {
    const seen = new Map();
    for (const e of field.diagnostics.aiTelemetry?.decisionTraceV118?.entries ?? field.diagnostics.decisionTraceV118?.entries ?? []) {
      const v = e.evidence; if (!v.selected || !v.candidates || v.event) continue;
      const key = v.selected.taskId + v.reason; if (seen.get(v.playerId) === key) continue; seen.set(v.playerId, key);
      const t = (e.availableAtTick - base.ball.originTick) / 1e6;
      console.log(rel(t).padStart(6), (pos(v.playerId) ?? '').padEnd(2), v.selected.intent.padEnd(10), String(v.selected.targetBase ?? '').padEnd(1), 'saw', v.observationSeconds === null ? '-' : rel(v.observationSeconds), v.reason, '| ' +
        v.candidates.slice(0, 4).map(c => c.role.taskId + ' ' + c.cost.toFixed(2)).join('  '));
    }
  }
  if (flags.frames) for (const q of field.frames.filter((_, i) => i % Number(flags.every ?? 2) === 0)) {
    const b = q.ball, a = q.fielders.find(x => pos(x.playerId) === flags.frames);
    console.log(rel(q.elapsedSeconds), 'ball', b.position.x.toFixed(1), b.position.y.toFixed(2), b.position.z.toFixed(1), b.phase, '|', flags.frames, a.position.x.toFixed(1), a.position.z.toFixed(1), 'v' + Math.hypot(a.velocity.x, a.velocity.z).toFixed(1), 'glove' + a.glove.y.toFixed(2), 'crouch' + (a.bodyPoseV105?.crouchMeters ?? 0).toFixed(2), a.athleticV115 ? a.athleticV115.kind + ':' + a.athleticV115.phase : '', a.intent, a.targetBase ?? '');
  }
} else console.log('usage: see the head of this file');
