// Carry of the game's own batted balls (exit speed, angle, spray and spin from records) under the batted-ball physics,
// against Statcast median distances in the same exit speed and angle bins.
// usage: npx vite-node tools/calibration/carry-check.ts <records glob dir> <savant bip json> [dragScale=1.2]
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { LIVE_MATCH_PHYSICS_V1 } from '../../src/integration/browser/LiveBaseballMatchV1';
import { createVersionedFreeBallTrajectory } from '../../src/core/sim/ball/VersionedBattedBallPhysics';

const [dir, prefix, savantPath, scaleText] = process.argv.slice(2);
const k = Number(scaleText ?? 1.2), base = LIVE_MATCH_PHYSICS_V1 as any, aero = base.air.aerodynamics, prof = aero.coefficientProfile;
const physics = { ...base, air: { ...base.air, aerodynamics: { ...aero, dragCoefficient: aero.dragCoefficient * k,
  coefficientProfile: { ...prof, profileId: prof.profileId + '-check', spinKnots: prof.spinKnots.map((x: any) => ({ ...x, dragCoefficientAtReferenceRe: x.dragCoefficientAtReferenceRe * k })) } } } };
const MPH = 0.44704, FEET = 3.28084, TPS = base.air.ticksPerSecond, RAD = Math.PI / 180;
const carry = (mph: number, la: number, spray: number, back: number, side: number) => {
  const v = mph * MPH, h = v * Math.cos(la * RAD), vel = { x: h * Math.sin(spray * RAD), y: v * Math.sin(la * RAD), z: h * Math.cos(spray * RAD) };
  // Backspin about the horizontal axis across the flight (-up x horizontal velocity), side spin about the vertical.
  const hx = Math.sin(spray * RAD), hz = Math.cos(spray * RAD), w = (rpm: number) => rpm * Math.PI / 30;
  const spin = { x: -w(back) * hz, y: w(side), z: w(back) * hx };
  const f = createVersionedFreeBallTrajectory({ tick: 0, position: { x: 0, y: 0.9, z: 0.3 }, velocity: vel, spin }, 10 * TPS, physics);
  const l = f.groundContacts[0]?.incoming; return l ? Math.hypot(l.position.x, l.position.z) * FEET : NaN;
};
const rows: any[] = [];
for (const f of readdirSync(dir).filter(n => n.startsWith(prefix) && n.endsWith('.jsonl')))
  for (const line of readFileSync(join(dir, f), 'utf8').split(/\r?\n/)) {
    if (!line) continue; const r = JSON.parse(line);
    if (r.exit && r.spin && r.play !== 'foul' && Math.abs(r.exit.spray) < 40) rows.push(r);
  }
const savant = JSON.parse(readFileSync(savantPath, 'utf8')).rows as any[];
const med = (xs: number[]) => { const s = xs.filter(Number.isFinite).sort((a, b) => a - b); return s.length ? s[s.length >> 1] : NaN; };
console.log(`dragScale ${k}  bins: game carry median / Statcast median (n game, n Statcast)`);
for (const ev of [87.5, 92.5, 97.5, 102.5, 107.5]) {
  const cells: string[] = [];
  for (const la of [12.5, 17.5, 22.5, 27.5, 32.5]) {
    const g = rows.filter(r => Math.abs(r.exit.kmh / 1.609344 - ev) <= 2.5 && Math.abs(r.exit.launch - la) <= 2.5);
    const s = savant.filter(r => Math.abs(r[0] - ev) <= 2.5 && Math.abs(r[1] - la) <= 2.5 && r[2] !== null && r[2] >= 150).map(r => r[2]);
    if (g.length < 5 || s.length < 15) { cells.push(`${la}:-`); continue; }
    const gm = med(g.map(r => carry(r.exit.kmh / 1.609344, r.exit.launch, r.exit.spray, r.spin.back, r.spin.side)));
    cells.push(`${la}:${gm.toFixed(0)}/${med(s).toFixed(0)}(${g.length},${s.length}) ${(gm / med(s) * 100 - 100).toFixed(0)}%`);
  }
  console.log(`EV ${ev}  ` + cells.join('  '));
}
