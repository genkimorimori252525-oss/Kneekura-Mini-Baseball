import { describe, expect, it } from 'vitest';
import {
  aggregateOfficialPlayerOutcomes,
  type AttributedOfficialPlayerOutcome,
  type OfficialPlayerOutcomeStatisticsScope,
} from './OfficialPlayerOutcomeStatistics';

const scope = (): OfficialPlayerOutcomeStatisticsScope => ({
  careerId: 'career-1', competitionEditionId: 'edition-1',
  playerId: 'player-1', asOfDay: 10,
});
const outcome = (patch: Partial<AttributedOfficialPlayerOutcome> = {}):
AttributedOfficialPlayerOutcome => ({
  attributionId: 'attribution-1', careerId: 'career-1',
  competitionEditionId: 'edition-1', gameId: 'game-1',
  playId: 1, gameDay: 5, batterPlayerId: 'player-1',
  pitcherPlayerId: 'player-2', classification: 'strikeout', ...patch,
});
const emptyOutcomes = () => ({
  base_on_balls: 0, strikeout: 0, foul_out: 0, fly_out: 0, ground_out: 0,
  base_hit: 0, reached_on_error: 0, fielders_choice: 0,
});

describe('aggregateOfficialPlayerOutcomes', () => {
  it('keeps every supported classification and separates batting from pitching', () => {
    const classifications: AttributedOfficialPlayerOutcome['classification'][] = [
      'base_on_balls', 'strikeout', 'foul_out', 'fly_out', 'ground_out',
      'base_hit', 'reached_on_error', 'fielders_choice',
    ];
    const batting = classifications.map((classification, index) => outcome({
      attributionId: `batting-${index}`, playId: index, classification,
    }));
    const pitching = [outcome({
      attributionId: 'pitching-1', gameId: 'game-2',
      batterPlayerId: 'player-3', pitcherPlayerId: 'player-1',
      classification: 'base_on_balls',
    }), outcome({
      attributionId: 'pitching-2', gameId: 'game-2', playId: 2,
      batterPlayerId: 'player-4', pitcherPlayerId: 'player-1',
      classification: 'strikeout',
    })];

    const result = aggregateOfficialPlayerOutcomes([...batting, ...pitching], scope());
    expect(result).toEqual({
      scope: scope(), coverage: 'attributed_supported_plays_only',
      batting: { classifiedPlays: 8, outcomes: {
        base_on_balls: 1, strikeout: 1, foul_out: 1, fly_out: 1, ground_out: 1,
        base_hit: 1, reached_on_error: 1, fielders_choice: 1,
      } },
      pitching: { classifiedPlays: 2, outcomes: {
        ...emptyOutcomes(), base_on_balls: 1, strikeout: 1,
      } },
      attributionIds: [...batting, ...pitching].map(item => item.attributionId).sort(),
      gameIds: ['game-1', 'game-2'],
    });
  });

  it('includes the cutoff day and excludes other careers, editions, players and future plays', () => {
    const selected = outcome({ gameDay: 10 });
    const excluded = [
      { careerId: 'other-career' },
      { competitionEditionId: 'other-edition' },
      { batterPlayerId: 'player-3', pitcherPlayerId: 'player-4' },
      { gameDay: 11 },
    ].map((patch, index) => outcome({
      ...patch, attributionId: `excluded-${index}`, gameId: `excluded-game-${index}`,
    }));
    const result = aggregateOfficialPlayerOutcomes([selected, ...excluded], scope());
    expect(result.batting).toEqual({
      classifiedPlays: 1, outcomes: { ...emptyOutcomes(), strikeout: 1 },
    });
    expect(result.pitching).toEqual({ classifiedPlays: 0, outcomes: emptyOutcomes() });
    expect(result.attributionIds).toEqual(['attribution-1']);
    expect(result.gameIds).toEqual(['game-1']);
  });

  it('returns an explicit empty partial-coverage snapshot without mutating input', () => {
    const requestedScope = scope();
    const input = Object.freeze([Object.freeze(outcome())]);
    const original = JSON.stringify({ input, requestedScope });
    const first = aggregateOfficialPlayerOutcomes(input, requestedScope);
    expect(JSON.stringify({ input, requestedScope })).toBe(original);
    expect(first.scope).not.toBe(requestedScope);
    expect(Object.isFrozen(first)).toBe(true);
    expect(Object.isFrozen(first.batting.outcomes)).toBe(true);
    expect(Object.isFrozen(first.attributionIds)).toBe(true);
    expect(aggregateOfficialPlayerOutcomes([], scope())).toEqual({
      scope: scope(), coverage: 'attributed_supported_plays_only',
      batting: { classifiedPlays: 0, outcomes: emptyOutcomes() },
      pitching: { classifiedPlays: 0, outcomes: emptyOutcomes() },
      attributionIds: [], gameIds: [],
    });
  });

  it('counts multiple plays in one game once each with order-independent provenance', () => {
    const input = [outcome({ attributionId: 'z', playId: 3 }),
      outcome({ attributionId: 'a', playId: 2 }), outcome()];
    const result = aggregateOfficialPlayerOutcomes(input, scope());
    expect(result).toEqual(aggregateOfficialPlayerOutcomes([...input].reverse(), scope()));
    expect(result.batting.classifiedPlays).toBe(3);
    expect(result.batting.outcomes.strikeout).toBe(3);
    expect(result.attributionIds).toEqual(['a', 'attribution-1', 'z']);
    expect(result.gameIds).toEqual(['game-1']);
  });

  it('rejects duplicate attribution IDs even when they name different plays', () => {
    expect(() => aggregateOfficialPlayerOutcomes([
      outcome(), outcome({ playId: 2 }),
    ], scope())).toThrow('duplicate official outcome attribution');
  });

  it('rejects duplicate canonical plays despite different attributions or editions', () => {
    expect(() => aggregateOfficialPlayerOutcomes([
      outcome(), outcome({ attributionId: 'other', competitionEditionId: 'other-edition' }),
    ], scope())).toThrow('duplicate official outcome play');
  });

  it('checks excluded data for duplicate plays and invalid classifications', () => {
    expect(() => aggregateOfficialPlayerOutcomes([
      outcome({ gameDay: 11 }), outcome({ attributionId: 'other', gameDay: 11 }),
    ], scope())).toThrow('duplicate official outcome play');
    expect(() => aggregateOfficialPlayerOutcomes([
      outcome({ gameDay: 11, classification: 'home_run' as AttributedOfficialPlayerOutcome['classification'] }),
    ], scope())).toThrow('invalid attributed official outcome');
  });

  it('keeps identical game/play numbers in different careers distinct', () => {
    const result = aggregateOfficialPlayerOutcomes([
      outcome(), outcome({ attributionId: 'other', careerId: 'other-career' }),
    ], scope());
    expect(result.batting.classifiedPlays).toBe(1);
  });

  it.each([
    { attributionId: '' }, { careerId: ' career-1' },
    { competitionEditionId: 'edition-1 ' }, { gameId: '' },
    { batterPlayerId: '' }, { pitcherPlayerId: ' ' },
    { batterPlayerId: 'player-2' }, { playId: -1 }, { playId: 0.5 },
    { playId: Number.MAX_SAFE_INTEGER + 1 }, { gameDay: -1 },
    { gameDay: Number.NaN }, { gameDay: Number.POSITIVE_INFINITY },
    { gameDay: Number.MAX_SAFE_INTEGER + 1 },
    { classification: '__proto__' }, { classification: 'out' },
  ])('rejects invalid attributed input %j', patch => {
    expect(() => aggregateOfficialPlayerOutcomes([
      outcome(patch as Partial<AttributedOfficialPlayerOutcome>),
    ], scope())).toThrow('invalid attributed official outcome');
  });

  it.each([
    { careerId: '' }, { competitionEditionId: ' ' }, { playerId: 'player-1 ' },
    { asOfDay: -1 }, { asOfDay: 0.5 }, { asOfDay: Number.NaN },
    { asOfDay: Number.POSITIVE_INFINITY }, { asOfDay: Number.MAX_SAFE_INTEGER + 1 },
  ])('rejects invalid aggregation scope %j', patch => {
    expect(() => aggregateOfficialPlayerOutcomes([], { ...scope(), ...patch }))
      .toThrow('invalid official outcome statistics scope');
  });

  it('rejects malformed collections and missing outcome records', () => {
    expect(() => aggregateOfficialPlayerOutcomes(null as unknown as AttributedOfficialPlayerOutcome[], scope()))
      .toThrow('official outcome statistics require an array');
    expect(() => aggregateOfficialPlayerOutcomes([null as unknown as AttributedOfficialPlayerOutcome], scope()))
      .toThrow('invalid attributed official outcome');
  });

  it('accepts safe boundary day and play identifiers without rounding them', () => {
    const result = aggregateOfficialPlayerOutcomes([
      outcome({ gameDay: Number.MAX_SAFE_INTEGER, playId: Number.MAX_SAFE_INTEGER }),
    ], { ...scope(), asOfDay: Number.MAX_SAFE_INTEGER });
    expect(result.batting.classifiedPlays).toBe(1);
  });
});
