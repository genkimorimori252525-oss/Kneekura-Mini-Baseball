import { expect, it } from 'vitest';
import { deriveBallWorldFieldTerritory, type BallWorldFieldTerritoryInput } from './BallWorldFieldTerritory';
import { battedWorldBaseSurfaceId } from '../sim/ball/BattedWorldFieldMotion';
import { quantizeEventTick } from '../sim/ExactEventTime';
import type { BallWorldBaseBoundaryContact } from '../sim/ball/BallWorldBaseBoundary';

const v = (x: number, y: number, z: number) => ({ x, y, z });
const moment = (elapsedSeconds: number, x = 2, z = 0, ticksPerSecond = 1_000_000) => ({ originTick: 0, elapsedSeconds,
  ball: { tick: quantizeEventTick(0, elapsedSeconds, ticksPerSecond), position: v(x, 1, z), velocity: v(1, 0, 0), spin: v(0, 0, 0) } });
const base = (at = moment(1), baseId: 'first' | 'third' | 'home' = 'first'): BallWorldBaseBoundaryContact => ({ kind: 'base', baseId,
  moment: at, point: v(at.ball.position.x + 0.1, 1, at.ball.position.z), normal: v(-1, 0, 0) });
const input = (contact = base()): BallWorldFieldTerritoryInput => ({ evidence: { batterRunnerId: 'batter', defenderIds: ['defender'],
  field: { homePlate: { x: 0, z: 0 }, firstBaseLineUnit: { x: 1, z: 0 }, thirdBaseLineUnit: { x: 0, z: 1 } },
  bases: { homePlate: { x: 0, z: 0 }, firstBase: { x: 2, z: 0 }, secondBase: { x: 2, z: 2 }, thirdBase: { x: 0, z: 2 } },
  ballRadiusMeters: 0.1, originTick: 0, ticksPerSecond: 1_000_000, horizon: moment(3), acquisitions: [],
  contacts: [{ moment: contact.moment, contacts: [{ kind: 'surface', surfaceId: battedWorldBaseSurfaceId(contact.baseId) }] }] }, baseContacts: [contact] });
it('interprets an adopted first/third bag touch as fair before any ground contact without closing a play', () => {
  const result = deriveBallWorldFieldTerritory(input());
  expect(result).toMatchObject({ kind: 'resolved', territory: 'fair', basis: 'base_contact', baseId: 'first', moment: { elapsedSeconds: 1 } });
  expect(result).not.toHaveProperty('playEnd');
  expect(result).not.toHaveProperty('officialClosure');
});
it('keeps an earlier actual fielder territory decision when a later ball touches a bag', () => {
  const query = input();
  const evidence = { ...query.evidence, contacts: [{ moment: moment(0.5, -1, -1),
    contacts: [{ kind: 'actor' as const, playerId: 'defender', role: 'glove' as const }] }, ...query.evidence.contacts] };
  expect(deriveBallWorldFieldTerritory({ ...query, evidence })).toMatchObject({ kind: 'resolved', territory: 'foul', basis: 'fielder_touch', moment: { elapsedSeconds: 0.5 } });
});
it('uses true elapsed order for two legal events sharing a recorded tick', () => {
  const query = input(base(moment(1.1, 2, 0, 1)));
  const evidence = { ...query.evidence, ticksPerSecond: 1, horizon: moment(3, 2, 0, 1), contacts: [...query.evidence.contacts,
    { moment: moment(1.2, -1, -1, 1), contacts: [{ kind: 'actor' as const, playerId: 'defender', role: 'glove' as const }] }] };
  expect(deriveBallWorldFieldTerritory({ ...query, evidence })).toMatchObject({ territory: 'fair', moment: { elapsedSeconds: 1.1 } });
});
it('retains earlier unknown surface or non-defender policy instead of manufacturing fair', () => {
  const query = input();
  const contacts = [{ moment: moment(0.5), contacts: [{ kind: 'surface' as const, surfaceId: 'unknown-wall' }] }, ...query.evidence.contacts];
  expect(deriveBallWorldFieldTerritory({ ...query, evidence: { ...query.evidence, contacts } })).toMatchObject({ kind: 'unresolved', reason: 'surface_policy_pending' });
  expect(deriveBallWorldFieldTerritory({ ...query, evidence: { ...query.evidence, contacts: [{ moment: moment(0.5),
    contacts: [{ kind: 'actor', playerId: 'batter', role: 'body' }] }, ...query.evidence.contacts] } })).toMatchObject({ kind: 'unresolved', reason: 'non_defender_contact' });
});
it('preserves simultaneous or degenerate base contact as unresolved', () => {
  const query = input(), frame = query.evidence.contacts[0];
  expect(deriveBallWorldFieldTerritory({ ...query, evidence: { ...query.evidence, contacts: [{ ...frame,
    contacts: [...frame.contacts, { kind: 'actor', playerId: 'defender', role: 'body' }] }] } })).toMatchObject({ kind: 'unresolved', reason: 'simultaneous_contact' });
  expect(deriveBallWorldFieldTerritory({ ...query, baseContacts: [{ ...query.baseContacts[0], normal: null }] })).toMatchObject({ kind: 'unresolved', reason: 'physical_contact_pending' });
});
it('does not retroactively erase an earlier fair base touch because of a later unresolved wall', () => {
  const query = input();
  expect(deriveBallWorldFieldTerritory({ ...query, evidence: { ...query.evidence, contacts: [...query.evidence.contacts,
    { moment: moment(2), contacts: [{ kind: 'surface', surfaceId: 'unknown-wall' }] }] } })).toMatchObject({ kind: 'resolved', territory: 'fair' });
});
it('does not treat home-plate contact as a first/third-base fair decision', () => {
  expect(deriveBallWorldFieldTerritory(input(base(moment(1), 'home')))).toMatchObject({ kind: 'unresolved', reason: 'fair_foul_pending' });
});
it('requires matching own physical contact identity, complete base metadata and no result injection', () => {
  const query = input();
  expect(() => deriveBallWorldFieldTerritory({ ...query, baseContacts: [] })).toThrow();
  expect(() => deriveBallWorldFieldTerritory({ ...query, baseContacts: [{ ...query.baseContacts[0], baseId: 'third' }] })).toThrow();
  expect(() => deriveBallWorldFieldTerritory({ ...query, baseContacts: [query.baseContacts[0], query.baseContacts[0]] })).toThrow();
  expect(() => deriveBallWorldFieldTerritory({ ...query, territory: 'fair' } as BallWorldFieldTerritoryInput)).toThrow();
});

it('derives gate territory from adopted rolling segments, with an earlier gate taking priority over later touch', () => {
  const query = input(), start = { ...moment(0, 1, 1), ball: { ...moment(0, 1, 1).ball,
    position: v(1, 0.1, 1), velocity: v(4, 0, 0) } };
  const end = { ...moment(1, 4, 1), ball: { ...moment(1, 4, 1).ball, position: v(4, 0.1, 1), velocity: v(2, 0, 0) } };
  const evidence = { ...query.evidence, horizon: end, contacts: [{ moment: start, contacts: [{ kind: 'ground' as const }] },
    { moment: end, contacts: [{ kind: 'actor' as const, playerId: 'defender', role: 'glove' as const }] }] };
  const result = deriveBallWorldFieldTerritory({ evidence, baseContacts: [],
    groundSegments: [{ moment: start, throughElapsedSeconds: 1, rollingDecelerationMps2: 2 }] } as BallWorldFieldTerritoryInput);
  expect(result).toMatchObject({ kind: 'resolved', territory: 'fair', basis: 'base_gate' });
  if (result.kind !== 'resolved') throw new Error('actual gate');
  expect(result.moment.elapsedSeconds).toBeCloseTo(2 - Math.sqrt(3), 14);
});
it('uses actual rolling stop before both gates for territory and never treats the horizon as a stop', () => {
  const query = input(), ground = { ...moment(0, 1, 1), ball: { ...moment(0, 1, 1).ball, position: v(1, 0.1, 1) } };
  const stop = { ...moment(0.5, 1.5, 1), ball: { ...moment(0.5, 1.5, 1).ball, position: v(1.5, 0.1, 1), velocity: v(0, 0, 0) } };
  const evidence = { ...query.evidence, horizon: stop, contacts: [{ moment: ground, contacts: [{ kind: 'ground' as const }] },
    { moment: stop, contacts: [{ kind: 'rolling_stop' as const }] }] };
  expect(deriveBallWorldFieldTerritory({ evidence, baseContacts: [] })).toMatchObject({ kind: 'resolved', territory: 'fair', basis: 'settling', moment: stop });
  expect(deriveBallWorldFieldTerritory({ evidence: { ...evidence, contacts: evidence.contacts.slice(0, 1) }, baseContacts: [] })).toMatchObject({ kind: 'unresolved', reason: 'fair_foul_pending' });
  expect(() => deriveBallWorldFieldTerritory({ evidence: { ...evidence, contacts: [evidence.contacts[0],
    { moment: ground, contacts: [{ kind: 'rolling_stop' }] }] }, baseContacts: [] })).toThrow();
});
it('rejects ground gate intervals past the observed horizon and unsupported rolling-stop velocity', () => {
  const query = input();
  expect(() => deriveBallWorldFieldTerritory({ ...query, groundSegments: [{ moment: moment(0),
    throughElapsedSeconds: 4, rollingDecelerationMps2: 0 }] } as BallWorldFieldTerritoryInput)).toThrow();
  expect(() => deriveBallWorldFieldTerritory({ evidence: { ...query.evidence, contacts: [{ moment: moment(1),
    contacts: [{ kind: 'rolling_stop' }] }] }, baseContacts: [] })).toThrow();
});
