// Ball bank replay: plays the banked field plays (core-playthrough.mjs --bank) again on a replay bundle (tools/release/build-bank-replay.mjs), arm A as recorded (or with
// --A overrides) and arm B with --B overrides, and compares the two on the same balls. Neither pitching nor batting is run.
// usage: node tools/calibration/bank-replay.mjs <replay.js> <bank.jsonl>... [--A=path=json;path=json] [--B=path=json;...] [--Bjs=<js on i>] [--where=<js on b,i,p>]
//        [--jobs=K] [--max=N] [--minN=200] [--stopZ=3] [--check=1] [--out=file.jsonl] [--top=15]
// --A/--B paths take '*' for every element (fielders.*.gloveRadiusMeters=0.14). RE24 is the MLB 2010-15 table, rounded.
// --where: b is the match before the play, i the field input, p the banked record; e.g. --where='b.bases.first&&!b.bases.second'.
// --check=1 replays arm A too and counts the plays whose rules or scoring result differ from the record (0 = the bank is exact).
// --jobs=K replays in K child processes (the bank files dealt round-robin); the parent adds up every play as it comes.
// The verdict is the paired mean of B-A over its standard error, for run value (runs scored + RE24 after - RE24 before), hits and
// outs. With --stopZ the run stops once |z| of the run value or of hits reaches it after --minN compared plays.
import {readFileSync, appendFileSync, writeFileSync} from 'node:fs';
import {fork} from 'node:child_process'; import {fileURLToPath} from 'node:url';
const argv = process.argv.slice(2), opt = {}, files = [], flags = [];
for (const a of argv) if (a.startsWith('--')) {const k = a.slice(2, a.indexOf('=')), v = a.slice(a.indexOf('=') + 1); opt[k] = v; flags.push(a);} else files.push(a);
const bundle = files.shift(), isChild = process.env.KBM_REPLAY_CHILD === '1', jobs = Number(opt.jobs ?? 1);
const METRICS = ['value', 'hits', 'outs'];
const T = {seen: 0, n: 0, changed: 0, fails: 0, checked: 0, mismatched: 0, sum: {}, sum2: {}, trans: new Map()}, t0 = Date.now();
for (const m of METRICS) {T.sum[m] = 0; T.sum2[m] = 0;}
const stat = m => {const n = T.n, mean = n ? T.sum[m] / n : 0, se = n > 1 ? Math.sqrt(Math.max(0, T.sum2[m] / n - mean * mean) / (n - 1)) : 0;
  return {mean, se, z: se > 0 ? mean / se : 0};};
let stopped = false;
const add = r => {
  if (r.seen) T.seen += r.seen;
  if (r.checked) {T.checked++; if (r.mismatch) T.mismatched++;}
  if (r.fail) {T.fails++; return;}
  if (!r.d) return;
  T.n++; for (const m of METRICS) {T.sum[m] += r.d[m]; T.sum2[m] += r.d[m] ** 2;}
  if (r.ka !== r.kb) {T.changed++; const k = r.ka + '  ->  ' + r.kb; T.trans.set(k, (T.trans.get(k) ?? 0) + 1);}
  if (opt.max && T.n >= Number(opt.max)) stopped = 'max';
  if (opt.stopZ && T.n >= Number(opt.minN ?? 200) && ['value', 'hits'].some(m => Math.abs(stat(m).z) >= Number(opt.stopZ))) stopped = 'z';
};
const report = () => {
  console.log(`plays banked ${T.seen} compared ${T.n} changed ${T.changed} failed ${T.fails}${T.checked ? ` | check A: ${T.checked} replayed, ${T.mismatched} differ from the record` : ''}${stopped ? ` | stopped early (${stopped})` : ''} | ${((Date.now() - t0) / 1000).toFixed(0)} s`);
  for (const m of METRICS) {const s = stat(m); console.log(`  ${m.padEnd(5)} B-A per 100 plays ${(100 * s.mean).toFixed(2).padStart(7)}  se ${(100 * s.se).toFixed(2)}  z ${s.z.toFixed(2)}`);}
  for (const [k, c] of [...T.trans].sort((x, y) => y[1] - x[1]).slice(0, Number(opt.top ?? 15))) console.log(String(c).padStart(5), k);
};

if (!isChild && jobs > 1) {
  const kids = [];
  const share = Array.from({length: Math.min(jobs, files.length)}, (_, k) => files.filter((_, i) => i % jobs === k));
  let open = share.length;
  for (const part of share) {
    const kid = fork(fileURLToPath(import.meta.url), [bundle, ...part, ...flags.filter(f => !f.startsWith('--jobs=') && !f.startsWith('--out='))],
      {env: {...process.env, KBM_REPLAY_CHILD: '1'}});
    kids.push(kid);
    kid.on('message', r => {
      if (stopped) return;
      if (opt.out && r.row) appendFileSync(opt.out, JSON.stringify(r.row) + '\n');
      add(r); if (stopped) for (const k of kids) k.kill();
    });
    kid.on('exit', () => {if (--open === 0) report();});
  }
  if (opt.out) writeFileSync(opt.out, '');
} else {
  globalThis.self = globalThis; (0, eval)(readFileSync(bundle, 'utf8') + ';globalThis.__kbmBank=KbmBank;');
  const {simulateLiveFieldPlayV1: sim, reducePlayableMatchV1: reduce, scoreLivePlayV100: score} = globalThis.__kbmBank;
  const dec = (k, v) => v && typeof v === 'object' && !Array.isArray(v) && Object.keys(v).length === 1 && typeof v.$num === 'string' ? Number(v.$num) : v;
  const enc = (k, v) => typeof v === 'number' && !Number.isFinite(v) ? {$num: String(v)} : v;
  const parseSets = s => (s ?? '').split(';').filter(Boolean).map(x => {const at = x.indexOf('='); return [x.slice(0, at).split('.'), JSON.parse(x.slice(at + 1))];});
  const setsA = parseSets(opt.A), setsB = parseSets(opt.B);
  // --Bjs=<js>: a function body run on a copy of arm B's input (i) after --B, e.g. to move a fielder's start.
  const bjs = opt.Bjs ? new Function('i', opt.Bjs) : null;
  const applyB = input => {if (!bjs) return apply(input, setsB); const out = setsB.length ? apply(input, setsB) : structuredClone(input); bjs(out); return out;};
  const apply = (input, sets) => {
    if (!sets.length) return input;
    const out = structuredClone(input);
    // A '*' in the path stands for every element (e.g. fielders.*.gloveRadiusMeters).
    const put = (o, path, value) => {
      const [k, ...rest] = path;
      if (k === '*') {for (const x of Object.values(o)) put(x, rest, value); return;}
      if (!rest.length) {o[k] = value; return;}
      put(o[k] ??= {}, rest, value);
    };
    for (const [path, value] of sets) put(out, path, value);
    return out;
  };
  const where = opt.where ? new Function('b', 'i', 'p', 'return (' + opt.where + ');') : () => true;
  const RE = {'000': [.481, .254, .098], '100': [.859, .509, .224], '010': [1.100, .664, .319], '110': [1.437, .884, .429],
    '001': [1.350, .950, .353], '101': [1.784, 1.130, .478], '011': [1.964, 1.376, .580], '111': [2.292, 1.541, .752]};
  const key = bases => (bases.first ? '1' : '0') + (bases.second ? '1' : '0') + (bases.third ? '1' : '0');
  const play = (p, input) => {
    try {
      const field = sim(input);
      if (!field.end.complete) return {fail: 'FIELD_INCOMPLETE ' + field.end.reason};
      const rules = reduce({match: p.before, batterRunnerId: p.batter, regulationInnings: p.innings, event: {kind: 'field_play', facts: {...field.ruleFacts, buntAttempt: p.bunt}}});
      if (rules.kind === 'unresolved') return {fail: 'RULE ' + rules.reason};
      return {rules, scoring: score({before: p.before, batterRunnerId: p.batter, bunt: p.bunt, input, field, rules, regulationInnings: p.innings})};
    } catch (e) {return {fail: 'ERROR ' + String(e.message).slice(0, 80)};}
  };
  const baseOf = (r, id, half) => r.rules.scoredRunnerIds.includes(id) ? 4 : half ? -1 : ['first', 'second', 'third'].findIndex(n => r.rules.match.bases[n] === id) + 1;
  const summary = (p, r) => {
    if (r.fail) return {fail: r.fail};
    const b = p.before, m = r.rules.match, runs = r.rules.scoredRunnerIds.length, half = r.rules.halfChanged || r.rules.gameOver;
    const outs = half ? 3 - b.outs : m.outs - b.outs, after = half ? 0 : RE[key(m.bases)][m.outs];
    return {value: runs + after - RE[key(b.bases)][b.outs], hits: r.scoring.hits ?? 0, runs, outs, batter: baseOf(r, p.batter, half),
      r1: b.bases.first ? baseOf(r, b.bases.first, half) : null, cls: r.scoring.classification, hb: r.scoring.hitBases, err: r.scoring.errors.length};
  };
  const emit = r => isChild ? process.send(r) : add(r);
  if (!isChild && opt.out) writeFileSync(opt.out, '');
  outer: for (const f of files) {
    // A game the guard stopped and resumed from a checkpoint wrote some plays twice: the last line for a pitch is kept.
    const byPitch = new Map();
    for (const line of readFileSync(f, 'utf8').split('\n')) if (line) {const at = line.indexOf('"pitch":'); byPitch.set(line.slice(at, line.indexOf(',', at)), line);}
    for (const line of byPitch.values()) {
      let p; try {p = JSON.parse(line, dec);} catch {continue;} // a game still being recorded may end in a half-written line
      if (p.kind !== 'play') continue;
      if (!where(p.before, p.input, p)) {emit({seen: 1}); continue;}
      // Arm A with no overrides is the recorded play itself (--check=1 replays it to prove that).
      const check = opt.check === '1' && !setsA.length;
      const ra = !setsA.length && !check ? {rules: p.rules, scoring: p.scoring} : play(p, apply(p.input, setsA)), rb = play(p, applyB(p.input));
      const r = {seen: 1};
      if (check && !ra.fail) {r.checked = 1; r.mismatch = JSON.stringify(ra.rules, enc) !== JSON.stringify(p.rules, enc) || JSON.stringify(ra.scoring, enc) !== JSON.stringify(p.scoring, enc);}
      const a = summary(p, ra), b = summary(p, rb);
      if (a.fail || b.fail) r.fail = a.fail ?? b.fail;
      else if (!(a.cls === 'plate_appearance_continues' && b.cls === 'plate_appearance_continues')) {
        r.d = Object.fromEntries(METRICS.map(m => [m, b[m] - a[m]]));
        r.ka = `bat${a.batter} r1${a.r1} o${a.outs} R${a.runs} ${a.cls}/${a.hb}`; r.kb = `bat${b.batter} r1${b.r1} o${b.outs} R${b.runs} ${b.cls}/${b.hb}`;
        r.row = {f, pitch: p.pitch, a, b};
      }
      emit(r);
      if (!isChild) {if (opt.out && r.row) appendFileSync(opt.out, JSON.stringify(r.row) + '\n'); if (stopped) break outer;}
    }
  }
  if (!isChild) report();
}
