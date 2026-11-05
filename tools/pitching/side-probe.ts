// Runs the pitch target plan V2 alone for one pitch type over the counts (MLB 2024 count shares) and draws landings around each
// target with the plan's own command spread, to show where the misses go by side (up, down, arm, glove) with and without
// missDirectionV2. Measurement only.
// usage: V2=<temperature> PT=<pitch type> [LEAN=..] [DIR=<share>] [AIM=<arm m>,<up half-heights>] [SHIFT=<arm m>,<up half-heights> added to the chosen spot] npx vite-node tools/pitching/side-probe.ts <config.json> [seeds=200]
import {readFileSync} from 'node:fs';
import {planLivePitchTargetV111} from '../../src/integration/browser/LivePitchTargetPlanV111';
import {resolveLiveBattingSetupV94} from '../../src/core/sim/pitching/BattingSetupV94';
import {SeedRoot} from '../../src/core/rng/SeedRoot';

const [cfgPath, seedsArg] = process.argv.slice(2);
const cfg = JSON.parse(readFileSync(cfgPath, 'utf8'));
const pitcherPlayer = cfg.players.find((x: any) => x.playerId === '1-p0'), pitcher = {...pitcherPlayer.physical, throws: pitcherPlayer.throws};
const seeds = Number(seedsArg ?? 200), R = .0366;
const v2 = {targetPlanV2: Number(process.env.V2 ?? .01), pitchTypeV2: process.env.PT ?? 'slider', ...(process.env.LEAN ? {zoneLeanV2: Number(process.env.LEAN)} : {}),
  ...(process.env.DIR ? {missDirectionV2: Number(process.env.DIR)} : {}),
  ...(process.env.AIM ? {aimCenterV2: {arm: Number(process.env.AIM.split(',')[0]), up: Number(process.env.AIM.split(',')[1])}} : {})};
const share: Record<string, number> = {'0-0': 1125, '0-1': 583, '0-2': 299, '1-0': 432, '1-1': 466, '1-2': 420, '2-0': 139, '2-1': 224, '2-2': 338, '3-0': 53, '3-1': 101, '3-2': 208};
const tally: Record<string, number> = {in: 0, up: 0, down: 0, arm: 0, glove: 0};
let aimDown = 0, total = 0, stdSum = 0;
const rng = new SeedRoot(7).streamRng(0, 'probe', 'landing');
const normal = () => Math.sqrt(-2 * Math.log(1 - rng.nextFloat())) * Math.cos(2 * Math.PI * rng.nextFloat());
for (const id of ['0-b0', '0-b4']) {
  const player = cfg.players.find((x: any) => x.playerId === id), b = {...player.physical, bats: player.bats};
  const zone = resolveLiveBattingSetupV94({heightMeters: b.heightMeters ?? 1.83, bats: b.bats, contactDepthMeters: b.contactDepthMeters}).region;
  const cx = zone.centerX ?? 0, cy = (zone.lowerY + zone.upperY) / 2;
  for (let balls = 0; balls < 4; balls++) for (let strikes = 0; strikes < 3; strikes++) {
    const w = share[balls + '-' + strikes];
    for (let s = 0; s < seeds; s++) {
      const r: any = planLivePitchTargetV111({...v2, zone, ballRadiusMeters: R, seed: 1000 + s, pitcher, batter: b,
        situation: {balls, strikes, outs: 0, occupiedBases: {first: false, second: false, third: false}}});
      const std = r.diagnostics.effectiveCommandStd ?? r.diagnostics.commandStdMeters ?? pitcher.commandStdMeters ?? .15;
      stdSum += w * std; total += w; aimDown += w * +(r.position.y < cy);
      for (let k = 0; k < 4; k++) {
        const sh = (process.env.SHIFT ?? '0,0').split(',').map(Number), hh = (zone.upperY - zone.lowerY) / 2;
        const x = r.position.x + (pitcher.throws === 'L' ? 1 : -1) * sh[0] + std * normal(), y = r.position.y + sh[1] * hh + std * normal();
        const side = Math.abs(x - cx) - (zone.halfWidth + R), up = y - (zone.upperY + R), down = (zone.lowerY - R) - y, out = Math.max(side, up, down);
        const key = out <= 0 ? 'in' : out === up ? 'up' : out === down ? 'down' : ((x - cx < 0) === (pitcher.throws === 'R') ? 'arm' : 'glove');
        tally[key] += w / 4;
      }
    }
  }
}
const out = tally.up + tally.down + tally.arm + tally.glove;
console.log(`${v2.pitchTypeV2} dir ${process.env.DIR ?? '-'} aim ${process.env.AIM ?? '-'} std ${(stdSum / total).toFixed(3)} aim below centre ${(aimDown / total).toFixed(2)} zone ${(tally.in / (out + tally.in)).toFixed(3)} ` +
  ['up', 'down', 'arm', 'glove'].map(k => `${k} ${(tally[k] / out).toFixed(3)}`).join(' '));
