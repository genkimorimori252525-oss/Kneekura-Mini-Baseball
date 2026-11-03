// Batted-ball shape against Statcast: exit speed and launch angle, type shares, hard hits, barrels, and home runs
// by exit speed and angle. Balls in play include home runs; fouls are left out.
// usage: node batted-profile.mjs <records.jsonl>...
import {readFileSync} from 'node:fs';
const rows = process.argv.slice(2).flatMap(f => readFileSync(f, 'utf8').split(/\r?\n/).filter(Boolean).map(l => JSON.parse(l)));
const bbe = rows.filter(r => r.exit && r.play !== 'foul' && r.scoring && !['plate_appearance_continues', 'unresolved'].includes(r.scoring));
const mph = r => r.exit.kmh / 1.609344, la = r => r.exit.launch, hr = r => r.hitBases === 4 || r.homeRuns > 0;
const share = f => (bbe.filter(f).length / bbe.length).toFixed(3), mean = xs => (xs.reduce((s, x) => s + x, 0) / xs.length).toFixed(1);
const sorted = bbe.map(mph).sort((a, b) => a - b), pct = p => sorted[Math.floor(p * (sorted.length - 1))].toFixed(1);
// Statcast barrel: 98 mph at 26-30 degrees, the angle window widening as exit speed rises, up to 8-50 at 116 mph.
const barrel = r => {const v = mph(r), a = la(r); if (v < 98) return false; const grow = Math.min(116, v) - 98, lo = Math.max(8, 26 - grow * (18 / 18)), hi = Math.min(50, 30 + grow * (20 / 18)); return a >= lo && a <= hi;};
console.log('balls in play', bbe.length, 'EV mph mean', mean(bbe.map(mph)), 'p10/50/90', pct(.1), pct(.5), pct(.9), 'LA mean', mean(bbe.map(la)));
console.log('GB<10', share(r => la(r) < 10), 'LD10-25', share(r => la(r) >= 10 && la(r) < 25), 'FB25-50', share(r => la(r) >= 25 && la(r) < 50), 'PU50+', share(r => la(r) >= 50));
console.log('hard 95+', share(r => mph(r) >= 95), 'barrel', share(barrel), 'HR per barrel', (bbe.filter(r => barrel(r) && hr(r)).length / Math.max(1, bbe.filter(barrel).length)).toFixed(3));
const fly = bbe.filter(r => la(r) >= 25 && la(r) < 50);
console.log('HR per fly ball (25-50)', (fly.filter(hr).length / Math.max(1, fly.length)).toFixed(3));
const evBins = [[0, 90], [90, 95], [95, 100], [100, 105], [105, 200]], laBins = [[15, 25], [25, 30], [30, 35], [35, 45]];
console.log('HR rate by LA (rows) x EV mph (cols)', evBins.map(b => b.join('-')).join(' '));
for (const [a, b] of laBins) console.log(`${a}-${b}`.padEnd(7), evBins.map(([lo, hi]) => {const l = bbe.filter(r => la(r) >= a && la(r) < b && mph(r) >= lo && mph(r) < hi); return l.length ? `${(l.filter(hr).length / l.length).toFixed(2)}(${l.length})`.padEnd(10) : '-'.padEnd(10);}).join(''));
// Backspin by launch angle (rpm, median), when the records carry spin. Fly balls hit hard carry about 2000-2500 rpm.
const spun = bbe.filter(r => r.spin);
if (spun.length) {
  const med = xs => {const s = [...xs].sort((a, b) => a - b); return s.length ? s[s.length >> 1] : '-';};
  console.log('backspin rpm median by LA', [[-90, 10], [10, 25], [25, 50], [50, 91]].map(([a, b]) => `${a}..${b}: ${med(spun.filter(r => la(r) >= a && la(r) < b).map(r => r.spin.back))}`).join('  '),
    ' | 25-50 and 95+ mph:', med(spun.filter(r => la(r) >= 25 && la(r) < 50 && mph(r) >= 95).map(r => r.spin.back)));
}
