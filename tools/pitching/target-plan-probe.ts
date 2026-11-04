// Runs the pitch target plan alone for every count against two batters of a config, and prints where it aims (pStrike counts the
// zone widened by the ball, as Savant zone 1-9 does). The MLB-count-weighted pStrike uses the 2024-06-01 count shares.
// usage: [V2=<temperature> [PT=<pitch type>]] npx vite-node tools/pitching/target-plan-probe.ts <config.json> [pitcherJSONpatch] [seeds=40]
import {readFileSync} from 'node:fs';
import {planLivePitchTargetV111} from '../../src/integration/browser/LivePitchTargetPlanV111';
import {resolveLiveBattingSetupV94} from '../../src/core/sim/pitching/BattingSetupV94';

const [cfgPath, patch, seedsArg] = process.argv.slice(2);
const cfg = JSON.parse(readFileSync(cfgPath, 'utf8'));
const pitcher = {...cfg.players.find((x: any) => x.playerId === '1-p0').physical, ...(patch ? JSON.parse(patch) : {})};
const seeds = Number(seedsArg ?? 40), v2 = process.env.V2 ? {targetPlanV2: Number(process.env.V2), ...(process.env.PT ? {pitchTypeV2: process.env.PT} : {}), ...(process.env.LEAN ? {zoneLeanV2: Number(process.env.LEAN)} : {})} : {};
const rows: string[] = [];
const all = {n: 0, zone: 0, p: 0, w: 0, wp: 0};
const share: Record<string, number> = {'0-0': 1125, '0-1': 583, '0-2': 299, '1-0': 432, '1-1': 466, '1-2': 420, '2-0': 139, '2-1': 224, '2-2': 338, '3-0': 53, '3-1': 101, '3-2': 208};
for (const id of ['0-b0', '0-b4']) {
  const player = cfg.players.find((x: any) => x.playerId === id), b = {...player.physical, bats: player.bats};
  const zone = resolveLiveBattingSetupV94({heightMeters: b.heightMeters ?? 1.83, bats: b.bats, contactDepthMeters: b.contactDepthMeters}).region;
  for (let balls = 0; balls < 4; balls++) for (let strikes = 0; strikes < 3; strikes++) {
    let zoneAim = 0, pStrike = 0, edge = 0;
    let d: any;
    for (let s = 0; s < seeds; s++) {
      const r = planLivePitchTargetV111({...v2, zone, ballRadiusMeters: .0366, seed: 1000 + s, pitcher, batter: b,
        situation: {balls, strikes, outs: 0, occupiedBases: {first: false, second: false, third: false}}});
      d = r.diagnostics;
      const inZ = Math.abs(r.position.x - (zone.centerX ?? 0)) <= zone.halfWidth && r.position.y >= zone.lowerY && r.position.y <= zone.upperY;
      zoneAim += +inZ; pStrike += d.pStrike;
      edge += Math.max(Math.abs(r.position.x) / zone.halfWidth, Math.abs(r.position.y - (zone.lowerY + zone.upperY) / 2) / ((zone.upperY - zone.lowerY) / 2));
    }
    all.n += seeds; all.zone += zoneAim; all.p += pStrike; all.w += share[balls + '-' + strikes]; all.wp += share[balls + '-' + strikes] * pStrike / seeds;
    rows.push(`${id} ${balls}-${strikes} aimIn ${(zoneAim / seeds).toFixed(2)} pStrike ${(pStrike / seeds).toFixed(3)} edge ${(edge / seeds).toFixed(2)} walkCost ${d.walkCost.toFixed(3)} threat ${d.batterThreat.toFixed(2)} near ${d.nearOptimalCount} eff ${d.targetPlanV2?.effectiveChoices?.toFixed(1) ?? '-'}`);
  }
}
console.log(rows.join('\n'));
console.log('ALL aimIn', (all.zone / all.n).toFixed(3), 'pStrike', (all.p / all.n).toFixed(3), 'MLB-count-weighted pStrike', (all.wp / all.w).toFixed(3));
