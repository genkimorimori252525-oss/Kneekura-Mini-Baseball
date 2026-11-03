// Aggregates core-playthrough --records files into league-style batting rates.
// usage: node core-stats.mjs <records.jsonl>... [--by=batter|pitcher|pitch|technique]
import {readFileSync} from 'node:fs';

const args = process.argv.slice(2), by = args.find(a => a.startsWith('--by='))?.slice(5), files = args.filter(a => !a.startsWith('--'));
const rows = files.flatMap(f => readFileSync(f, 'utf8').split(/\r?\n/).filter(Boolean).map(l => JSON.parse(l)));
const BALL_RADIUS = .0366;
const inZone = r => r.zone && r.x !== null && Math.abs(r.x) <= r.zone.half + BALL_RADIUS && r.y >= r.zone.low - BALL_RADIUS && r.y <= r.zone.high + BALL_RADIUS;
const share = (a, b) => b ? +(a / b).toFixed(3) : null;
const mean = xs => xs.length ? +(xs.reduce((s, x) => s + x, 0) / xs.length).toFixed(1) : null;
function summarize(list) {
  const z = list.filter(r => r.zone && r.x !== null && inZone(r)), o = list.filter(r => r.zone && r.x !== null && !inZone(r));
  const swings = list.filter(r => r.swing), contact = swings.filter(r => r.foulOrContact);
  const zs = z.filter(r => r.swing), os = o.filter(r => r.swing);
  const ended = list.filter(r => r.scoring && !['plate_appearance_continues', 'unresolved'].includes(r.scoring));
  const count = k => ended.filter(r => r.scoring === k).length;
  const strikeouts = count('strikeout'), walks = count('walk'), hbp = count('hit_by_pitch');
  const hits = ended.filter(r => r.hitBases > 0), homers = hits.filter(r => r.hitBases === 4 || r.homeRuns > 0);
  const atBats = ended.length - walks - hbp - count('sacrifice_fly') - count('sacrifice_bunt');
  const bases = hits.reduce((s, r) => s + r.hitBases, 0);
  const inPlay = list.filter(r => r.foulOrContact && r.play !== 'foul'), angles = inPlay.map(r => r.exit.launch);
  const games = new Set(list.map(r => r.seed)).size;
  return {pitches: list.length, pa: ended.length, games, pitchesPerPA: share(list.length, ended.length),
    zonePct: share(z.length, z.length + o.length), swingPct: share(swings.length, list.length), zSwing: share(zs.length, z.length), oSwing: share(os.length, o.length),
    contactPct: share(contact.length, swings.length), zContact: share(zs.filter(r => r.foulOrContact).length, zs.length), oContact: share(os.filter(r => r.foulOrContact).length, os.length),
    whiffPerPitch: share(swings.length - contact.length, list.length), foulPerSwing: share(list.filter(r => r.play === 'foul').length, swings.length),
    kPct: share(strikeouts, ended.length), bbPct: share(walks, ended.length), hrPct: share(homers.length, ended.length),
    avg: share(hits.length, atBats), obp: share(hits.length + walks + hbp, atBats + walks + hbp), slg: share(bases, atBats),
    babip: share(hits.length - homers.length, atBats - strikeouts - homers.length),
    runsPerGame: games ? +(list.reduce((s, r) => s + r.runs, 0) / games / 2).toFixed(2) : null,
    exitKmh: mean(inPlay.map(r => r.exit.kmh)), launch: mean(angles), groundPct: share(angles.filter(a => a < 10).length, angles.length),
    linePct: share(angles.filter(a => a >= 10 && a < 25).length, angles.length), flyPct: share(angles.filter(a => a >= 25).length, angles.length),
    hard: share(inPlay.filter(r => r.exit.kmh >= 153).length, inPlay.length), timingStd: mean(swings.filter(r => r.timing !== null).map(r => Math.abs(r.timing) * 1000)),
    other: Object.fromEntries(Object.entries(Object.groupBy(ended, r => r.scoring)).map(([k, v]) => [k, v.length]))};
}
// Measured exit spin, from real contacts only. slice is hand-normalised: + bends to the opposite field, - is hook.
function spinRow(list) {
  const seen = list.filter(r => r.exitSpin), middle = xs => {const s = [...xs].sort((a, b) => a - b); return s.length ? +s[s.length >> 1].toFixed(1) : null;};
  const part = k => ({mean: mean(seen.map(r => r.exitSpin[k])), median: middle(seen.map(r => r.exitSpin[k]))});
  return {swings: list.length, contacts: seen.length, backspin: part('backspin'), slice: part('slice'), ev: mean(seen.filter(r => r.exit).map(r => r.exit.kmh)), la: mean(seen.filter(r => r.exit).map(r => r.exit.launch))};
}
if (by === 'technique') {
  const swings = rows.filter(r => r.swing), reasons = list => Object.fromEntries(Object.entries(Object.groupBy(list, r => r.techniqueReason ?? 'unknown')).map(([k, v]) => [k, v.length]));
  console.log('none'.padEnd(10), JSON.stringify(spinRow(swings.filter(r => !r.technique))));
  for (const [k, v] of Object.entries(Object.groupBy(swings.filter(r => r.technique), r => r.technique)).sort()) {
    const planned = v.filter(r => r.techniquePlan === 'PLANNED'), fell = v.filter(r => r.techniquePlan !== 'PLANNED');
    console.log(k.padEnd(10), JSON.stringify({tried: v.length, planned: planned.length, fellBack: fell.length, why: reasons(fell)}));
    console.log('  planned '.padEnd(10), JSON.stringify(spinRow(planned)));
    console.log('  fellback'.padEnd(10), JSON.stringify(spinRow(fell)));
  }
} else if (!by) console.log(JSON.stringify(summarize(rows), null, 1));
else for (const [k, v] of Object.entries(Object.groupBy(rows, r => r[by])).sort((a, b) => b[1].length - a[1].length)) {
  const s = summarize(v);
  console.log(k.padEnd(10), JSON.stringify({n: s.pitches, pa: s.pa, swing: s.swingPct, oSwing: s.oSwing, contact: s.contactPct, k: s.kPct, bb: s.bbPct, avg: s.avg, slg: s.slg, hr: s.hrPct, babip: s.babip, ev: s.exitKmh, la: s.launch, gb: s.groundPct, fb: s.flyPct}));
}
