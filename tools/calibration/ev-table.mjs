// Hit rate on balls in play by exit speed and launch angle (home runs excluded). usage: node ev-table.mjs <records>...
import {readFileSync} from 'node:fs';
const rows = process.argv.slice(2).flatMap(f => readFileSync(f, 'utf8').split(/\r?\n/).filter(Boolean).map(l => JSON.parse(l)));
const bip = rows.filter(r => r.exit && r.play !== 'foul' && r.scoring && !['plate_appearance_continues', 'unresolved'].includes(r.scoring) && !(r.hitBases === 4 || r.homeRuns > 0));
const ev = [['<113', 0, 113], ['113-129', 113, 129], ['129-145', 129, 145], ['145-161', 145, 161], ['>=161', 161, 999]];
const la = [['GB<10', -90, 10], ['LD10-25', 10, 25], ['FB25-50', 25, 50], ['PU50+', 50, 91]];
console.log('LA/EV'.padEnd(9), ev.map(e => e[0].padEnd(13)).join(''), 'all');
for (const [n, a, b] of la) {
  const row = bip.filter(r => r.exit.launch >= a && r.exit.launch < b);
  const cell = l => l.length ? `${(l.filter(r => r.hitBases > 0).length / l.length).toFixed(3)} (${l.length})`.padEnd(13) : '-'.padEnd(13);
  console.log(n.padEnd(9), ev.map(([, lo, hi]) => cell(row.filter(r => r.exit.kmh >= lo && r.exit.kmh < hi))).join(''), cell(row));
}
const share = ev.map(([n, lo, hi]) => n + ' ' + (bip.filter(r => r.exit.kmh >= lo && r.exit.kmh < hi).length / bip.length).toFixed(2));
console.log('EV share', share.join('  '));
