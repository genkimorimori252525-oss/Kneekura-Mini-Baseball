import { expect, it, vi } from 'vitest';
import { ownedRunnerFieldInputs } from './OwnedRunnerFieldFixtures.test-support';
import { battedFirstFielderTouchEvidenceFromSqlite } from './SqliteBattedFirstFielderTouchStore';
import { battedContactResponseEvidenceFromSqlite } from './SqliteBattedContactResponseStore';
const state = vi.hoisted(() => ({ flight: null as any, world: null as any, touch: null as any }));
vi.mock('./SqliteBattedBallFlightStore', () => ({ battedBallFlightEvidenceFromSqlite: () => ({ read: () => state.flight }) }));
vi.mock('./SqliteBattedWorldContactStore', async load => {
  const actual = await load<typeof import('./SqliteBattedWorldContactStore')>();
  return { ...actual, battedWorldContactEvidenceFromSqlite: (db: Parameters<typeof actual.battedWorldContactEvidenceFromSqlite>[0]) => ({
    ...actual.battedWorldContactEvidenceFromSqlite(db), read: () => state.world }) };
});
vi.mock('./SqliteBattedFirstFielderTouchStore', async load => {
  const actual = await load<typeof import('./SqliteBattedFirstFielderTouchStore')>();
  return { ...actual, battedFirstFielderTouchEvidenceFromSqlite: (db: Parameters<typeof actual.battedFirstFielderTouchEvidenceFromSqlite>[0]) => ({
    ...actual.battedFirstFielderTouchEvidenceFromSqlite(db), read: () => state.touch }) };
});
const fixture = () => {
  const x = ownedRunnerFieldInputs(); state.flight = x.flight; state.world = x.deriveWorld();
  state.touch = x.deriveRoot(state.world).touch; return x;
};

// RED target: the current blanket consumer guard rejects these two real zero-time roots.
it('admits a tagged original runner field touch without inventing a fielder touch or physical time', () => {
  const x = fixture();
  try {
    const value = battedFirstFielderTouchEvidenceFromSqlite(x.db).derive(x.touchSource);
    expect(value.result).toEqual({ kind: 'unresolved', reason: 'airborne', timeline: state.world.timeline });
    expect(value.worldContact.actors).toHaveLength(55);
    expect(value.worldContact.result).toMatchObject({ kind: 'airborne', throughTick: x.flight.flight.contact.tick });
    expect(value.source).toEqual(x.touchSource);
  } finally { x.db.close(); }
});

it('admits complete eleven-actor response calibration while the original ball and timeline stay unchanged', () => {
  const x = fixture();
  try {
    const value = battedContactResponseEvidenceFromSqlite(x.db).derive(x.responseSource, x.responseModel);
    expect(value.result).toMatchObject({ kind: 'airborne', ball: x.flight.flight.initialBall });
    expect(value.model.actors).toHaveLength(11);
    expect(value.model.actors.flatMap(a => a.primitives)).toHaveLength(55);
    expect(value.touch.result.timeline).toEqual(state.world.timeline);
    expect(value).not.toHaveProperty('playEnd'); expect(value).not.toHaveProperty('possession');
  } finally { x.db.close(); }
});

it.each(['untagged', 'wrong_runner', 'advanced', 'predecessor', 'altered_controller', 'missing_part'] as const)
('rejects %s at runner field touch admission', kind => {
  const x = fixture();
  try {
    const source = structuredClone(x.touchSource) as any;
    state.world = structuredClone(state.world);
    if (kind === 'untagged') { delete source.kind; delete source.prePitchRunnerSourceId; }
    if (kind === 'wrong_runner') source.prePitchRunnerSourceId = 'different-runner-source';
    if (kind === 'advanced') state.world.flight.source.searchDurationTicks = 1;
    if (kind === 'predecessor') state.world.source.previousContactSourceId = 'earlier-contact';
    if (kind === 'altered_controller') state.world.flight.physicalPitch.frame.prePitchRunner.controller.trajectory.segments[0].accelerationMps2 += 1;
    if (kind === 'missing_part') state.world.actors.pop();
    expect(() => battedFirstFielderTouchEvidenceFromSqlite(x.db).derive(source)).toThrow();
  } finally { x.db.close(); }
});

it.each(['untagged', 'wrong_runner', 'untagged_touch', 'missing_runner_profile', 'wrong_person'] as const)
('rejects %s at runner response admission', kind => {
  const x = fixture();
  try {
    const source = structuredClone(x.responseSource) as any, model = structuredClone(x.responseModel) as any;
    state.touch = structuredClone(state.touch);
    if (kind === 'untagged') { delete source.kind; delete source.prePitchRunnerSourceId; }
    if (kind === 'wrong_runner') source.prePitchRunnerSourceId = 'different-runner-source';
    if (kind === 'untagged_touch') { delete state.touch.source.kind; delete state.touch.source.prePitchRunnerSourceId; }
    if (kind === 'missing_runner_profile') model.actors = model.actors.filter((a: { playerId: string }) => a.playerId !== 'runner');
    if (kind === 'wrong_person') model.actors.find((a: { playerId: string }) => a.playerId === 'runner').personId = 'different-person';
    expect(() => battedContactResponseEvidenceFromSqlite(x.db).derive(source, model)).toThrow();
  } finally { x.db.close(); }
});
