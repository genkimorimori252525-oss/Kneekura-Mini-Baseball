// Why runs stay low: base advancement and double plays from records with basesBefore/basesAfter.
// usage: node bases.mjs <records.jsonl>...
import {readFileSync} from 'node:fs';
const rows = process.argv.slice(2).flatMap(f => readFileSync(f, 'utf8').split(/\r?\n/).filter(Boolean).map(l => JSON.parse(l))).filter(r => r.basesBefore !== undefined);
const ended = rows.filter(r => r.scoring && !['plate_appearance_continues', 'unresolved'].includes(r.scoring));
const outsMade = r => r.halfAfter !== r.half ? 3 - r.outs : r.outsAfter - r.outs;
const rate = (a, b) => b ? `${a}/${b} = ${(a / b).toFixed(3)}` : '-';
const singles = ended.filter(r => r.hitBases === 1), doubles = ended.filter(r => r.hitBases === 2);
// Runner on second, single, fewer than two outs or not: did he score? Approximated by runs >= runners from 2nd and 3rd.
const s2 = singles.filter(r => r.basesBefore.includes('2') && !r.basesBefore.includes('3'));
console.log('single, runner on 2nd (no 3rd): scored', rate(s2.filter(r => r.runs >= 1).length, s2.length), ' (MLB ~.60)');
const s1 = singles.filter(r => r.basesBefore === '1');
console.log('single, runner on 1st only: 1st->3rd', rate(s1.filter(r => r.basesAfter.includes('3')).length, s1.length), ' (MLB ~.28)');
const d1 = doubles.filter(r => r.basesBefore === '1');
console.log('double, runner on 1st only: scored', rate(d1.filter(r => r.runs >= 1).length, d1.length), ' (MLB ~.40)');
const gdp = ended.filter(r => r.basesBefore.includes('1') && r.outs < 2 && r.exit && r.exit.launch < 10 && !r.hitBases);
console.log('ground out chance with runner on 1st, <2 outs: double play', rate(gdp.filter(r => outsMade(r) >= 2).length, gdp.length), ' (MLB ~.11 of PA in DP situations, so roughly .45 of non-hit grounders)');
const fly3 = ended.filter(r => r.basesBefore.includes('3') && r.outs < 2 && r.exit && r.exit.launch >= 25 && !r.hitBases && outsMade(r) === 1);
console.log('fly out, runner on 3rd, <2 outs: scored', rate(fly3.filter(r => r.runs >= 1).length, fly3.length), ' (MLB ~.55)');
const g3 = ended.filter(r => r.basesBefore.includes('3') && r.outs < 2 && r.exit && r.exit.launch < 10 && !r.hitBases);
console.log('ground ball, runner on 3rd, <2 outs: scored', rate(g3.filter(r => r.runs >= 1).length, g3.length));
// Outs not explained by the batter: extra outs on hits.
const hitOuts = ended.filter(r => r.hitBases > 0 && outsMade(r) > 0);
console.log('outs made on base hits', rate(hitOuts.length, ended.filter(r => r.hitBases > 0).length));
const byScore = Object.groupBy(ended, r => r.scoring);
console.log('PA', ended.length, Object.fromEntries(Object.entries(byScore).map(([k, v]) => [k, v.length])));
// Runners left: average runners on base at the third out.
const thirds = ended.filter(r => r.halfAfter !== r.half);
console.log('innings', thirds.length, 'runs/inning', (rows.reduce((s, r) => s + r.runs, 0) / thirds.length).toFixed(3), 'LOB per inning', (thirds.reduce((s, r) => s + r.basesBefore.length, 0) / thirds.length).toFixed(2));
// Base-out state of every PA start, to see how often runners are on.
const onBase = ended.filter(r => r.basesBefore !== '').length;
console.log('PA with runners on', rate(onBase, ended.length), ' (MLB ~.45)');
const non = rows.filter(r => (!r.scoring || r.scoring === 'plate_appearance_continues') &&r.basesBefore !== r.basesAfter && r.halfAfter === r.half);
console.log('base changes between PA (steal/pickoff/wild pitch)', non.length, Object.fromEntries(Object.entries(Object.groupBy(non, r => r.basesBefore + '>' + r.basesAfter + (r.outsAfter > r.outs ? ' out' : ''))).map(([k, v]) => [k, v.length])));
