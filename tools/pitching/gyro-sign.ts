// Which way the gyro spins, decided by Savant's measured active spin: every 2024 pitcher-pitch row (100+ pitches) is fitted
// with the hypothesis's gyro handedness and with it flipped (statcast-to-v78.ts, KBM_GYRO_FLIP), and each fitted active
// share is set against the measured one (Hawk-Eye axis; Alan Nathan's movement-based share alongside).
// usage: npx vite-node tools/pitching/gyro-sign.ts <mlb_pitch_type_player_year.csv> <mlb_pitch_type_spin_player_year.csv> <scratch dir> [year=2024]
const [csvPath, spinPath, scratch, yearArg] = process.argv.slice(2), year = yearArg ?? '2024';
// The converter runs its command line on import; give it an empty check so it only loads.
process.argv = [process.argv[0], 'statcast-to-v78.ts', csvPath, scratch, '--check=1900'];
const v78 = await import('./statcast-to-v78');
const spins = new Map(v78.readCsv(spinPath).filter(r => r.year === year && r.sample !== 'small').map(r => [`${r.mlbam_id}|${r.pitch_type}`, r]));
const rows = v78.readCsv(csvPath).filter(r => r.year === year && r.sample === 'pitches>=100');
const by: Record<string, { n: number; measured: number; alan: number; hyp: number; flip: number; dHyp: number; dFlip: number; flipCloser: number; clamped: number }> = {};
for (const r of rows) {
  const s = spins.get(`${r.mlbam_id}|${r.pitch_type}`), measured = s ? v78.num(s, 'active_spin_pct') / 100 : NaN, alan = s ? v78.num(s, 'active_spin_alan_pct') / 100 : NaN;
  if (!Number.isFinite(measured)) continue;
  const ri = v78.rowInput(r, r.throws as 'R' | 'L'); if (!v78.usable(ri)) continue;
  process.env.KBM_GYRO_FLIP = '0'; const a = v78.fitStatcastPitch(ri);
  process.env.KBM_GYRO_FLIP = '1'; const b = v78.fitStatcastPitch(ri);
  if (a.clamped || b.clamped) { (by[ri.type] ??= { n: 0, measured: 0, alan: 0, hyp: 0, flip: 0, dHyp: 0, dFlip: 0, flipCloser: 0, clamped: 0 }).clamped++; continue; }
  const t = (by[ri.type] ??= { n: 0, measured: 0, alan: 0, hyp: 0, flip: 0, dHyp: 0, dFlip: 0, flipCloser: 0, clamped: 0 });
  t.n++; t.measured += measured; t.alan += Number.isFinite(alan) ? alan : measured; t.hyp += a.active; t.flip += b.active;
  t.dHyp += Math.abs(a.active - measured); t.dFlip += Math.abs(b.active - measured); t.flipCloser += +(Math.abs(b.active - measured) < Math.abs(a.active - measured));
}
console.table(Object.entries(by).sort((x, y) => y[1].n - x[1].n).map(([type, t]) => ({ type, rows: t.n, clamped: t.clamped,
  measured: +(t.measured / t.n).toFixed(3), alan: +(t.alan / t.n).toFixed(3), fitHyp: +(t.hyp / t.n).toFixed(3), fitFlip: +(t.flip / t.n).toFixed(3),
  maeHyp: +(t.dHyp / t.n).toFixed(3), maeFlip: +(t.dFlip / t.n).toFixed(3), flipCloser: +(t.flipCloser / t.n).toFixed(2) })));
