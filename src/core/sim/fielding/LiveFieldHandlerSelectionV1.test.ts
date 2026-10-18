import { expect, it } from 'vitest';
import { selectLiveFieldHandlerV1, type LiveFieldHandlerCandidateV1 } from './LiveFieldHandlerSelectionV1';

const candidate = (playerId: string, interceptSeconds: number, arrivalSeconds: number, travelDistanceMeters: number): LiveFieldHandlerCandidateV1 =>
  ({ playerId, intercepted: true, interceptSeconds, arrivalSeconds, travelDistanceMeters });

it('chooses the lower arrival burden when multiple players can reach the same descending fly', () => {
  const candidates = [candidate('inner', 5.5, 4.8, 33), candidate('outer', 5.5, 3.7, 23)];
  expect(selectLiveFieldHandlerV1({ candidates }).playerId).toBe('outer');
  expect(selectLiveFieldHandlerV1({ candidates: [...candidates].reverse() }).playerId).toBe('outer');
  expect(selectLiveFieldHandlerV1({ candidates, previousPlayerId: 'inner' }).playerId).toBe('outer');
});

it('preserves the physically earlier interception including a legitimate infielder blooper', () => {
  const candidates = [candidate('inner', 2.9, 2.8, 17), candidate('outer', 3.2, 1.5, 8)];
  expect(selectLiveFieldHandlerV1({ candidates, previousPlayerId: 'outer' }).playerId).toBe('inner');
  expect(selectLiveFieldHandlerV1({ candidates: [candidate('grounder', 1.1, 1, 5), candidate('late', 1.12, .3, 1)] }).playerId).toBe('grounder');
});

it('accounts for a harder chase approach only inside the same physical catch window', () => {
  const candidates = [{ ...candidate('going-back', 5.5, 4.2, 28), approachPenaltySeconds: 1.2 }, candidate('coming-in', 5.5, 4.4, 29)];
  expect(selectLiveFieldHandlerV1({ candidates }).playerId).toBe('coming-in');
  expect(selectLiveFieldHandlerV1({ candidates: [{ ...candidates[0], interceptSeconds: 5.4 }, candidates[1]] }).playerId).toBe('going-back');
  expect(() => selectLiveFieldHandlerV1({ candidates: [{ ...candidates[0], approachPenaltySeconds: -1 }] })).toThrow();
});

it('retains a competitive incumbent and switches when the arrival burden changes materially', () => {
  const candidates = [candidate('a', 4, 1.5, 8), candidate('b', 4, 1.6, 8.5)];
  const selected = selectLiveFieldHandlerV1({ candidates, previousPlayerId: 'b' });
  expect(selected.playerId).toBe('b'); expect(selected.retained).toBe(true);
});

it('lets individual pursuit policy change a shared catch window without creating physical eligibility', () => {
  const ordinary = [candidate('a', 4, 1.5, 8), candidate('b', 4, 2, 12)];
  expect(selectLiveFieldHandlerV1({ candidates: ordinary }).playerId).toBe('a');
  expect(selectLiveFieldHandlerV1({ candidates: [ordinary[0], { ...ordinary[1], pursuitCostWeight: .5 }] }).playerId).toBe('b');
  expect(selectLiveFieldHandlerV1({ candidates: [{ ...ordinary[0], intercepted: false, pursuitCostWeight: .25 }, ordinary[1]] }).playerId).toBe('b');
  expect(selectLiveFieldHandlerV1({ candidates: [ordinary[0], { ...ordinary[1], interceptSeconds: 4.1, pursuitCostWeight: .25 }] }).playerId).toBe('a');
});

it('uses a bounded explicitly selected comparison window and rejects invalid candidates', () => {
  const candidates = [candidate('a', 4, 2, 12), candidate('b', 4.04, 1, 6)];
  expect(selectLiveFieldHandlerV1({ candidates, interceptionWindowSeconds: .05 }).playerId).toBe('b');
  expect(() => selectLiveFieldHandlerV1({ candidates, interceptionWindowSeconds: .11 })).toThrow();
  expect(() => selectLiveFieldHandlerV1({ candidates: [candidates[0], candidates[0]] })).toThrow();
  for (const pursuitCostWeight of [0, .24, 4.1, Infinity, NaN])
    expect(() => selectLiveFieldHandlerV1({ candidates: [{ ...candidates[0], pursuitCostWeight }] })).toThrow();
});

it('returns no handler when no delayed forecast is available and ranks fallback without an interception claim', () => {
  expect(selectLiveFieldHandlerV1({ candidates: [] }).playerId).toBeNull();
  const selected = selectLiveFieldHandlerV1({ candidates: [
    { ...candidate('a', 5, 5, 30), intercepted: false }, { ...candidate('b', 4, 4, 20), intercepted: false },
  ] });
  expect(selected.playerId).toBe('b'); expect(selected.intercepted).toBe(false);
});
