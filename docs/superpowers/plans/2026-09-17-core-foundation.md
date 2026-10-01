# Shared Core Foundation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the first headless, deterministic Mini/Natural shared Core boundary: TypeScript test harness, hierarchical seeded RNG, canonical match/world state, integer-tick simulation clock, and guards that prevent rendering or wall-clock state from influencing baseball calculations.

**Architecture:** `src/core` is the authoritative simulation package and must be usable with no browser, renderer, Three.js, or UI. Time is represented as integer simulation ticks rather than accumulated floating-point seconds. Randomness is derived from a match seed into named phase streams so adding draws in one subsystem cannot perturb another subsystem. Future Mini and Natural renderers consume read-only snapshots/events outside this boundary.

**Tech Stack:** TypeScript `~5.5.0`, Vitest `^2.0.0`, Node type definitions; ESM modules; no runtime rendering dependency in P0.

**Spec:** `docs/game-design/00-decisions.md`, `docs/game-design/02-rules-ratings-defense.md`, `docs/game-design/03-roadmap.md`, `docs/game-design/04-defense-ratings.md`

## Global Constraints

- Mini Baseball and Natural Baseball must eventually consume the same authoritative Core rather than maintaining separate baseball logic.
- `src/core` must not use `Math.random`, `Date.now`, `new Date(`, `performance.now`, DOM globals, Three.js, or renderer/presentation imports.
- Identical input plus identical seed must produce identical Core-visible state and event ordering.
- Simulation time must be independent of render FPS, playback speed, and whether rendering is enabled.
- Do not introduce NPB competition-specific rule values that are still listed as undecided in the design documents.
- Do not add fielding outcome formulas in P0. P0 establishes contracts that later P1-P9 features consume.
- The Natural repository currently has reusable architectural references for TypeScript/Vitest, deterministic RNG and determinism guards, but no root `LICENSE` or `LICENSE.md` was found during this planning pass. Record provenance before copying source verbatim; prefer an independent implementation of the documented contracts until reuse terms are made explicit.

---

## File Structure

Create the following focused files.

```text
package.json                         project scripts and dev dependencies only
tsconfig.json                        strict headless TypeScript configuration
docs/porting/00-source-inventory.md provenance/reuse boundary for Natural candidates
src/core/index.ts                    public Core exports
src/core/rng/DeterministicRng.ts     deterministic integer RNG
src/core/rng/SeedRoot.ts             match/play/phase seed derivation
src/core/rng/SeedRoot.test.ts        RNG determinism and phase-isolation tests
src/core/model/geometry.ts           Vec2 / Vec3 value types
src/core/model/CanonicalMatchState.ts rules-facing match state contract
src/core/model/CanonicalWorldSnapshot.ts time-indexed world state contract
src/core/model/TimedMatchEvent.ts    ordered event envelope used by rules/presentation later
src/core/model/model.test.ts         model invariants
src/core/sim/SimulationClock.ts      integer-tick authoritative clock
src/core/sim/SimulationClock.test.ts fixed-tick tests
src/core/determinism-guard.test.ts   forbidden-token/import boundary guard
src/core/p0-acceptance.test.ts       P0 end-to-end deterministic-contract test
```

No `src/render`, `src/ui`, or Three.js dependency is created in this plan.

---

### Task 1: Headless TypeScript Harness and Porting Boundary

**Files:**
- Create: `package.json`
- Create: `tsconfig.json`
- Create: `src/core/index.test.ts`
- Create: `src/core/index.ts`
- Create: `docs/porting/00-source-inventory.md`

**Interfaces:**
- Consumes: none
- Produces: `CORE_PROTOCOL_VERSION: 1`; `npm test`; `npm run typecheck`; documented reuse boundary for Natural source candidates

- [ ] **Step 1: Create the test/tooling files and a failing Core smoke test**

Create `package.json`:

```json
{
  "name": "kneekura-mini-baseball",
  "private": true,
  "version": "0.0.1",
  "type": "module",
  "scripts": {
    "test": "vitest run",
    "test:watch": "vitest",
    "typecheck": "tsc --noEmit",
    "verify": "npm run typecheck && npm test"
  },
  "devDependencies": {
    "@types/node": "^26.1.1",
    "typescript": "~5.5.0",
    "vitest": "^2.0.0"
  }
}
```

Create `tsconfig.json`:

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "strict": true,
    "noEmit": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "noFallthroughCasesInSwitch": true,
    "skipLibCheck": true,
    "isolatedModules": true,
    "types": ["node", "vitest/globals"],
    "lib": ["ES2022"]
  },
  "include": ["src"]
}
```

Create `src/core/index.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { CORE_PROTOCOL_VERSION } from './index';

describe('core package', () => {
  it('exposes the first shared protocol version', () => {
    expect(CORE_PROTOCOL_VERSION).toBe(1);
  });
});
```

- [ ] **Step 2: Install dependencies and verify the smoke test fails**

Run:

```bash
npm install
npm test -- src/core/index.test.ts
```

Expected: FAIL because `./index` does not exist.

- [ ] **Step 3: Add the minimal Core entry point**

Create `src/core/index.ts`:

```ts
export const CORE_PROTOCOL_VERSION = 1 as const;
```

- [ ] **Step 4: Record source/provenance boundaries**

Create `docs/porting/00-source-inventory.md` with this content:

```markdown
# P0 Source Inventory

Updated: 2026-09-17

## Prior engine

Repository: `genkimorimori252525-oss/Kneekura-natural-Baseball`

Architectural references inspected during planning:

- `package.json`: TypeScript + Vitest + Vite/Three renderer stack
- `src/core/rng/DeterministicRng.ts`: deterministic integer RNG design reference
- `src/core/rng/SeedRoot.ts`: match/play/phase seed separation reference
- `src/core/determinism-guard.test.ts`: Core/browser/render boundary guard reference
- `src/core/model/MatchState.ts`: legacy mutable match-state reference
- `src/core/model/events.ts`: legacy event-union reference

No root `LICENSE` or `LICENSE.md` was found during the 2026-09-17 planning pass.
Until reuse terms are explicitly recorded, do not copy implementation source verbatim. Reimplement contracts independently and use the prior engine only as behavioral/architectural evidence.

## P0 reuse decision

- Reuse concepts: yes
- Copy renderer: no
- Copy mutable legacy `MatchState` as the new canonical model: no
- Preserve deterministic phase-stream idea: yes, independently implemented
- Preserve Core-to-render dependency prohibition: yes
```

- [ ] **Step 5: Verify the harness**

Run:

```bash
npm run verify
```

Expected: typecheck PASS and one smoke test PASS.

- [ ] **Step 6: Commit**

```bash
git add package.json package-lock.json tsconfig.json src/core/index.ts src/core/index.test.ts docs/porting/00-source-inventory.md
git commit -m "chore: establish headless core harness"
```

---

### Task 2: Hierarchical Deterministic RNG

**Files:**
- Create: `src/core/rng/DeterministicRng.ts`
- Create: `src/core/rng/SeedRoot.ts`
- Create: `src/core/rng/SeedRoot.test.ts`
- Modify: `src/core/index.ts`

**Interfaces:**
- Consumes: numeric `matchSeed`, integer `playId`, named `CorePhase`
- Produces: `DeterministicRng`, `SeedRoot`, `CorePhase`; phase-local repeatable random streams

- [ ] **Step 1: Write failing RNG determinism tests**

Create `src/core/rng/SeedRoot.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { DeterministicRng } from './DeterministicRng';
import { SeedRoot } from './SeedRoot';

describe('deterministic RNG', () => {
  it('repeats the same uint32 sequence for the same seed', () => {
    const a = new DeterministicRng(123456789);
    const b = new DeterministicRng(123456789);
    expect([a.nextUint32(), a.nextUint32(), a.nextUint32()]).toEqual([
      b.nextUint32(), b.nextUint32(), b.nextUint32(),
    ]);
  });

  it('keeps one phase independent from draw counts in another phase', () => {
    const root = new SeedRoot(77);
    const fieldingA = root.phaseRng(12, 'fielding');
    const batting = root.phaseRng(12, 'batting');
    batting.nextUint32();
    batting.nextUint32();
    batting.nextUint32();
    const fieldingB = root.phaseRng(12, 'fielding');
    expect(fieldingA.nextUint32()).toBe(fieldingB.nextUint32());
  });

  it('separates play ids', () => {
    const root = new SeedRoot(77);
    expect(root.phaseSeed(1, 'fielding')).not.toBe(root.phaseSeed(2, 'fielding'));
  });
});
```

- [ ] **Step 2: Run the tests and verify they fail**

Run:

```bash
npm test -- src/core/rng/SeedRoot.test.ts
```

Expected: FAIL because RNG modules do not exist.

- [ ] **Step 3: Implement the deterministic integer RNG**

Create `src/core/rng/DeterministicRng.ts`:

```ts
export function fnv1a32(value: string): number {
  let hash = 0x811c9dc5;
  for (let i = 0; i < value.length; i += 1) {
    hash ^= value.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return hash >>> 0;
}

export function fmix32(value: number): number {
  let hash = value >>> 0;
  hash ^= hash >>> 16;
  hash = Math.imul(hash, 0x85ebca6b);
  hash ^= hash >>> 13;
  hash = Math.imul(hash, 0xc2b2ae35);
  hash ^= hash >>> 16;
  return hash >>> 0;
}

function rotateLeft(value: number, bits: number): number {
  return ((value << bits) | (value >>> (32 - bits))) >>> 0;
}

export class DeterministicRng {
  private s0: number;
  private s1: number;
  private s2: number;
  private s3: number;

  constructor(seed: number) {
    let state = seed >>> 0;
    const split = (): number => {
      state = (state + 0x9e3779b9) >>> 0;
      let z = state;
      z = Math.imul(z ^ (z >>> 16), 0x21f0aaad);
      z = Math.imul(z ^ (z >>> 15), 0x735a2d97);
      return (z ^ (z >>> 15)) >>> 0;
    };
    this.s0 = split();
    this.s1 = split();
    this.s2 = split();
    this.s3 = split();
    if ((this.s0 | this.s1 | this.s2 | this.s3) === 0) this.s3 = 1;
  }

  nextUint32(): number {
    const result = Math.imul(rotateLeft(Math.imul(this.s1, 5) >>> 0, 7), 9) >>> 0;
    const t = (this.s1 << 9) >>> 0;
    this.s2 = (this.s2 ^ this.s0) >>> 0;
    this.s3 = (this.s3 ^ this.s1) >>> 0;
    this.s1 = (this.s1 ^ this.s2) >>> 0;
    this.s0 = (this.s0 ^ this.s3) >>> 0;
    this.s2 = (this.s2 ^ t) >>> 0;
    this.s3 = rotateLeft(this.s3, 11);
    return result;
  }

  nextFloat(): number {
    return this.nextUint32() / 4294967296;
  }
}
```

Do not add Gaussian helpers in P0; transcendental math reproducibility is a separate decision.

- [ ] **Step 4: Implement stateless phase seed derivation**

Create `src/core/rng/SeedRoot.ts`:

```ts
import { DeterministicRng, fmix32, fnv1a32 } from './DeterministicRng';

export type CorePhase =
  | 'pitch'
  | 'recognition'
  | 'batting'
  | 'contact'
  | 'batted_ball'
  | 'fielding'
  | 'baserunning'
  | 'rules';

export class SeedRoot {
  constructor(readonly matchSeed: number) {}

  playSeed(playId: number): number {
    return fmix32((this.matchSeed ^ Math.imul(playId + 1, 0x9e3779b9)) >>> 0);
  }

  phaseSeed(playId: number, phase: CorePhase): number {
    return fmix32((this.playSeed(playId) ^ fnv1a32(phase)) >>> 0);
  }

  phaseRng(playId: number, phase: CorePhase): DeterministicRng {
    return new DeterministicRng(this.phaseSeed(playId, phase));
  }
}
```

- [ ] **Step 5: Export and verify**

Add to `src/core/index.ts`:

```ts
export * from './rng/DeterministicRng';
export * from './rng/SeedRoot';
```

Run:

```bash
npm run verify
```

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/core/rng src/core/index.ts
git commit -m "feat: add deterministic phase RNG"
```

---

### Task 3: Canonical Match and World Contracts

**Files:**
- Create: `src/core/model/geometry.ts`
- Create: `src/core/model/CanonicalMatchState.ts`
- Create: `src/core/model/CanonicalWorldSnapshot.ts`
- Create: `src/core/model/TimedMatchEvent.ts`
- Create: `src/core/model/model.test.ts`
- Modify: `src/core/index.ts`

**Interfaces:**
- Consumes: no renderer types
- Produces: `Vec2`, `Vec3`, `CanonicalMatchState`, `DefenderWorldState`, `BaserunnerWorldState`, `BallWorldState`, `CanonicalWorldSnapshot`, `TimedMatchEvent`

- [ ] **Step 1: Write failing model-invariant tests**

Create `src/core/model/model.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import type { CanonicalWorldSnapshot, DefenderWorldState } from './CanonicalWorldSnapshot';

const defender = (playerId: string): DefenderWorldState => ({
  playerId,
  registeredPosition: 'CF',
  position: { x: 0, z: 0 },
  velocity: { x: 0, z: 0 },
  assignment: { kind: 'hold' },
});

describe('canonical world contract', () => {
  it('represents all nine defenders independently from registered positions', () => {
    const defenders = Array.from({ length: 9 }, (_, index) => defender(`p${index}`));
    const snapshot: CanonicalWorldSnapshot = {
      tick: 0,
      defenders,
      runners: [],
      ball: null,
    };
    expect(snapshot.defenders).toHaveLength(9);
  });

  it('allows a CF to occupy an arbitrary world coordinate', () => {
    const shifted = { ...defender('cf'), position: { x: 2.5, z: 33.0 } };
    expect(shifted.registeredPosition).toBe('CF');
    expect(shifted.position).toEqual({ x: 2.5, z: 33.0 });
  });
});
```

- [ ] **Step 2: Verify the tests fail**

Run:

```bash
npm test -- src/core/model/model.test.ts
```

Expected: FAIL because model modules do not exist.

- [ ] **Step 3: Add geometry and canonical match state types**

Create `src/core/model/geometry.ts`:

```ts
export type Vec2 = Readonly<{ x: number; z: number }>;
export type Vec3 = Readonly<{ x: number; y: number; z: number }>;
```

Create `src/core/model/CanonicalMatchState.ts`:

```ts
export type HalfInning = 'top' | 'bottom';

export type BaseOccupancy = Readonly<{
  first: string | null;
  second: string | null;
  third: string | null;
}>;

export type CanonicalMatchState = Readonly<{
  inning: number;
  half: HalfInning;
  outs: number;
  balls: number;
  strikes: number;
  bases: BaseOccupancy;
  score: Readonly<{ away: number; home: number }>;
  playId: number;
}>;
```

Do not add rule transitions yet; P0 defines the contract only.

- [ ] **Step 4: Add world snapshot and event contracts**

Create `src/core/model/CanonicalWorldSnapshot.ts`:

```ts
import type { Vec2, Vec3 } from './geometry';

export type DefensivePosition = 'P' | 'C' | '1B' | '2B' | '3B' | 'SS' | 'LF' | 'CF' | 'RF';

export type DefensiveAssignment =
  | Readonly<{ kind: 'ball_handler' }>
  | Readonly<{ kind: 'base_cover'; base: 1 | 2 | 3 | 4 }>
  | Readonly<{ kind: 'relay'; target: Vec2 }>
  | Readonly<{ kind: 'backup'; target: Vec2 }>
  | Readonly<{ kind: 'deep_coverage'; target: Vec2 }>
  | Readonly<{ kind: 'hold' }>;

export type DefenderWorldState = Readonly<{
  playerId: string;
  registeredPosition: DefensivePosition;
  position: Vec2;
  velocity: Vec2;
  assignment: DefensiveAssignment;
}>;

export type BaserunnerWorldState = Readonly<{
  playerId: string;
  position: Vec2;
  velocity: Vec2;
}>;

export type BallWorldState = Readonly<{
  position: Vec3;
  velocity: Vec3;
  spin: Vec3;
}>;

export type CanonicalWorldSnapshot = Readonly<{
  tick: number;
  defenders: readonly DefenderWorldState[];
  runners: readonly BaserunnerWorldState[];
  ball: BallWorldState | null;
}>;
```

Create `src/core/model/TimedMatchEvent.ts`:

```ts
export type TimedMatchEvent<TKind extends string = string, TPayload = unknown> = Readonly<{
  tick: number;
  sequence: number;
  kind: TKind;
  payload: TPayload;
}>;
```

- [ ] **Step 5: Export and verify**

Add to `src/core/index.ts`:

```ts
export * from './model/geometry';
export * from './model/CanonicalMatchState';
export * from './model/CanonicalWorldSnapshot';
export * from './model/TimedMatchEvent';
```

Run:

```bash
npm run verify
```

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/core/model src/core/index.ts
git commit -m "feat: define canonical core state contracts"
```

---

### Task 4: Integer-Tick Simulation Clock

**Files:**
- Create: `src/core/sim/SimulationClock.ts`
- Create: `src/core/sim/SimulationClock.test.ts`
- Modify: `src/core/index.ts`

**Interfaces:**
- Consumes: fixed positive integer `ticksPerSecond`
- Produces: monotonically increasing integer `tick`; derived display seconds; no wall-clock dependency

- [ ] **Step 1: Write failing fixed-clock tests**

Create `src/core/sim/SimulationClock.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { SimulationClock } from './SimulationClock';

describe('SimulationClock', () => {
  it('advances only in integer simulation ticks', () => {
    const clock = new SimulationClock(120);
    clock.advanceTicks(3);
    expect(clock.tick).toBe(3);
    expect(clock.timeSeconds).toBe(3 / 120);
  });

  it('rejects invalid tick rates and negative advances', () => {
    expect(() => new SimulationClock(0)).toThrow();
    const clock = new SimulationClock(120);
    expect(() => clock.advanceTicks(-1)).toThrow();
  });

  it('does not accumulate floating-point time as authoritative state', () => {
    const clock = new SimulationClock(120);
    clock.advanceTicks(120 * 60 * 9);
    expect(clock.tick).toBe(64800);
    expect(clock.timeSeconds).toBe(540);
  });
});
```

- [ ] **Step 2: Verify the tests fail**

Run:

```bash
npm test -- src/core/sim/SimulationClock.test.ts
```

Expected: FAIL because `SimulationClock` does not exist.

- [ ] **Step 3: Implement the minimal fixed clock**

Create `src/core/sim/SimulationClock.ts`:

```ts
export class SimulationClock {
  private currentTick = 0;

  constructor(readonly ticksPerSecond: number) {
    if (!Number.isInteger(ticksPerSecond) || ticksPerSecond <= 0) {
      throw new Error('ticksPerSecond must be a positive integer');
    }
  }

  get tick(): number {
    return this.currentTick;
  }

  get timeSeconds(): number {
    return this.currentTick / this.ticksPerSecond;
  }

  advanceTicks(count = 1): void {
    if (!Number.isInteger(count) || count < 0) {
      throw new Error('count must be a non-negative integer');
    }
    this.currentTick += count;
  }
}
```

- [ ] **Step 4: Export and verify**

Add to `src/core/index.ts`:

```ts
export * from './sim/SimulationClock';
```

Run:

```bash
npm run verify
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/core/sim src/core/index.ts
git commit -m "feat: add fixed simulation clock"
```

---

### Task 5: Determinism and Presentation-Boundary Guard

**Files:**
- Create: `src/core/determinism-guard.test.ts`

**Interfaces:**
- Consumes: all non-test TypeScript files under `src/core`
- Produces: a test failure if browser time, global randomness, Three.js, or renderer/presentation dependencies enter Core

- [ ] **Step 1: Add the guard test with a self-test probe**

Create `src/core/determinism-guard.test.ts`:

```ts
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const FORBIDDEN = [
  'Math.random',
  'Date.now',
  'new Date(',
  'performance.now',
  "from 'three'",
  'from "three"',
  'document.',
  'window.',
];

function listSourceFiles(dir: string): string[] {
  const output: string[] = [];
  for (const name of readdirSync(dir)) {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) output.push(...listSourceFiles(path));
    else if (path.endsWith('.ts') && !path.endsWith('.test.ts')) output.push(path);
  }
  return output;
}

function presentationImports(source: string): string[] {
  return [...source.matchAll(/from\s+['"]([^'"]+)['"]/g)]
    .map((match) => match[1])
    .filter((path) => /(^|\/)(render|ui|presentation)\//.test(path));
}

describe('core determinism boundary', () => {
  it('the import probe really detects presentation dependencies', () => {
    expect(presentationImports("import type { X } from '../presentation/X';")).toEqual([
      '../presentation/X',
    ]);
  });

  it('contains no forbidden nondeterministic/browser tokens', () => {
    const files = listSourceFiles(join(process.cwd(), 'src', 'core'));
    expect(files.length).toBeGreaterThan(0);
    for (const file of files) {
      const source = readFileSync(file, 'utf-8');
      for (const token of FORBIDDEN) {
        expect(source.includes(token), `${file} contains ${token}`).toBe(false);
      }
    }
  });

  it('does not import render, ui, or presentation code', () => {
    const violations: string[] = [];
    for (const file of listSourceFiles(join(process.cwd(), 'src', 'core'))) {
      const source = readFileSync(file, 'utf-8');
      for (const dependency of presentationImports(source)) {
        violations.push(`${file} -> ${dependency}`);
      }
    }
    expect(violations).toEqual([]);
  });
});
```

- [ ] **Step 2: Run the guard by itself**

Run:

```bash
npm test -- src/core/determinism-guard.test.ts
```

Expected: PASS. The self-test probe proves the import detector is not vacuously green.

- [ ] **Step 3: Run full verification**

Run:

```bash
npm run verify
```

Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add src/core/determinism-guard.test.ts
git commit -m "test: enforce deterministic core boundary"
```

---

### Task 6: P0 Acceptance Contract

**Files:**
- Create: `src/core/p0-acceptance.test.ts`
- Modify: `docs/game-design/03-roadmap.md`

**Interfaces:**
- Consumes: `SeedRoot`, `SimulationClock`, canonical world types
- Produces: one acceptance fixture proving seed stability, integer time, arbitrary defender coordinates, nine-defender state, and renderer-free execution

- [ ] **Step 1: Write the P0 acceptance test**

Create `src/core/p0-acceptance.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import {
  SeedRoot,
  SimulationClock,
  type CanonicalWorldSnapshot,
  type DefenderWorldState,
} from './index';

function defender(index: number): DefenderWorldState {
  return {
    playerId: `fielder-${index}`,
    registeredPosition: index === 7 ? 'CF' : 'SS',
    position: index === 7 ? { x: 1.5, z: 31 } : { x: index, z: 20 + index },
    velocity: { x: 0, z: 0 },
    assignment: { kind: 'hold' },
  };
}

function fixture(matchSeed: number): { snapshot: CanonicalWorldSnapshot; draw: number } {
  const clock = new SimulationClock(120);
  clock.advanceTicks(48);
  const snapshot: CanonicalWorldSnapshot = {
    tick: clock.tick,
    defenders: Array.from({ length: 9 }, (_, index) => defender(index)),
    runners: [],
    ball: null,
  };
  const draw = new SeedRoot(matchSeed).phaseRng(3, 'fielding').nextUint32();
  return { snapshot, draw };
}

describe('P0 shared Core acceptance', () => {
  it('repeats the same Core-visible result for the same seed and input', () => {
    expect(fixture(20260917)).toEqual(fixture(20260917));
  });

  it('keeps all nine defenders and permits a shifted CF', () => {
    const { snapshot } = fixture(20260917);
    expect(snapshot.defenders).toHaveLength(9);
    expect(snapshot.defenders[7]).toMatchObject({
      registeredPosition: 'CF',
      position: { x: 1.5, z: 31 },
    });
  });
});
```

- [ ] **Step 2: Run the P0 acceptance test**

Run:

```bash
npm test -- src/core/p0-acceptance.test.ts
```

Expected: PASS.

- [ ] **Step 3: Run all verification from a clean install**

Run:

```bash
rm -rf node_modules
npm ci
npm run verify
```

On Windows PowerShell use:

```powershell
Remove-Item -Recurse -Force node_modules
npm ci
npm run verify
```

Expected: dependency install succeeds, typecheck PASS, all tests PASS.

- [ ] **Step 4: Update P0 roadmap evidence**

Under P0 in `docs/game-design/03-roadmap.md`, add an implementation-evidence subsection recording only verified facts:

```markdown
#### P0 implementation evidence

- Headless TypeScript/Vitest Core harness exists.
- Core randomness is derived from match/play/phase seeds.
- Authoritative time is integer simulation ticks.
- Canonical world state represents nine defenders independently from registered defensive positions.
- Determinism guard rejects global randomness, wall-clock/browser state, Three.js, and presentation imports inside `src/core`.
- `npm run verify` is the P0 regression gate.
```

Do not mark P0 complete if any listed assertion is not actually verified.

- [ ] **Step 5: Commit**

```bash
git add src/core/p0-acceptance.test.ts docs/game-design/03-roadmap.md
git commit -m "test: lock p0 shared core contract"
```

---

## Plan Self-Review

### Spec coverage

This plan intentionally implements **P0 only**. It covers:

- headless Core build/test boundary;
- shared Mini/Natural Core direction;
- deterministic seed hierarchy;
- canonical match/world contracts;
- nine independent defender states and arbitrary field coordinates;
- simulation time independent from rendering;
- renderer/browser dependency prohibition;
- reproducibility regression gate.

It intentionally does **not** implement P1 rules, pitching physics, batted-ball physics, defensive ratings, manager scouting, fielding planning, baserunning, or presentation. Those receive separate plans after P0 is verified.

### Type consistency

- `tick` is an integer everywhere in P0 authoritative state/events.
- `registeredPosition` is separate from `position`.
- Core phases use one `CorePhase` union and one `SeedRoot` API.
- World vectors use the same `Vec2` / `Vec3` contracts.

### No placeholders

No implementation step depends on a `TBD` or unspecified function. Competition-specific NPB values are deliberately excluded from P0 rather than guessed.
