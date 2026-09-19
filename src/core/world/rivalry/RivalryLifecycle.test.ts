import { describe, expect, it } from 'vitest';
import {
  DORMANT_INTENSITY,
  appendRivalryMemory,
  createCalibratedRivalryMemory,
  createDirectedCompetitiveThreatSignal,
  createEmergentDirectedRivalry,
  createHistoricalRivalryFromInitialSeed,
  createMajorIncidentRivalryMemory,
  createRivalrySparseGraph,
  deriveRivalryView,
  getDirectedRivalry,
  historicalFloorForReason,
  pruneExpiredEmergentRivalries,
  recordEliminationAgainstOpponent,
  recordRivalryMemory,
  rivalryMemoryContribution,
  shouldDeleteEmergentRivalry,
} from './RivalryLifecycle';

const emergent = () => createEmergentDirectedRivalry({
  fromClubId: 'club-a',
  toClubId: 'club-b',
  createdSeason: 0,
});

describe('RivalryLifecycle v1', () => {
  it('reconstructs current historical heat from floor plus six-season context', () => {
    const state = createHistoricalRivalryFromInitialSeed({
      fromClubId: 'hanshin',
      toClubId: 'giants',
      currentSeason: 0,
      effectiveIntensity: 94,
      reason: 'HISTORICAL_RIVAL',
    });
    expect(state.historicalFloor).toBe(55);
    expect(state.memories[0]?.kind).toBe('INITIAL_CONTEXT');
    expect(state.memories[0]?.halfLifeSeasons).toBe(6);
    expect(deriveRivalryView(state, 0).effectiveIntensity).toBeCloseTo(94, 10);
    expect(deriveRivalryView(state, 6).effectiveIntensity).toBeCloseTo(74.5, 10);
    expect(deriveRivalryView(state, 300).effectiveIntensity).toBeCloseTo(55, 8);
    expect(shouldDeleteEmergentRivalry(state, 300)).toBe(false);
  });

  it('treats legacy TITLE_RIVAL as competitive history and rejects dominant-target permanence', () => {
    expect(historicalFloorForReason('TITLE_RIVAL')).toBe(30);
    expect(() => createHistoricalRivalryFromInitialSeed({
      fromClubId: 'a',
      toClubId: 'b',
      currentSeason: 0,
      effectiveIntensity: 76,
      reason: 'DOMINANT_CLUB_TARGET',
    })).toThrow('competitive threat, not permanent rivalry');
  });

  it('keeps current competitive threat outside persistent rivalry memory', () => {
    const state = emergent();
    const threat = createDirectedCompetitiveThreatSignal({
      fromClubId: 'club-a',
      toClubId: 'club-b',
      currentCompetitiveThreat: 92,
    });
    expect(threat.currentCompetitiveThreat).toBe(92);
    expect(state.memories).toEqual([]);
    expect(deriveRivalryView(state, 0).effectiveIntensity).toBe(0);
  });

  it('uses the approved half-life formula', () => {
    const memory = createCalibratedRivalryMemory({
      sourceEventId: 'title-race',
      kind: 'TITLE_RACE',
      createdSeason: 10,
    });
    expect(rivalryMemoryContribution(memory, 10)).toBe(10);
    expect(rivalryMemoryContribution(memory, 13)).toBeCloseTo(5, 10);
    expect(rivalryMemoryContribution(memory, 16)).toBeCloseTo(2.5, 10);
  });

  it('caps routine competitive memories at 30 per direction and season', () => {
    let state = emergent();
    state = appendRivalryMemory(state, createCalibratedRivalryMemory({
      sourceEventId: 'final',
      kind: 'CHAMPIONSHIP_FINAL_ELIMINATION',
      createdSeason: 1,
    }));
    state = appendRivalryMemory(state, createCalibratedRivalryMemory({
      sourceEventId: 'title',
      kind: 'TITLE_RACE',
      createdSeason: 1,
    }));
    state = appendRivalryMemory(state, createCalibratedRivalryMemory({
      sourceEventId: 'close',
      kind: 'CLOSE_SERIES',
      createdSeason: 1,
    }));
    expect(state.memories.map((memory) => memory.initialWeight)).toEqual([22, 8]);
    expect(deriveRivalryView(state, 1).effectiveIntensity).toBe(30);
  });

  it('adds repeated-elimination memory and activates after repeated losses', () => {
    let state = recordEliminationAgainstOpponent(emergent(), {
      sourceEventId: 'po-1',
      kind: 'POSTSEASON_ELIMINATION',
      createdSeason: 1,
    });
    expect(deriveRivalryView(state, 1).active).toBe(false);
    state = recordEliminationAgainstOpponent(state, {
      sourceEventId: 'po-2',
      kind: 'POSTSEASON_ELIMINATION',
      createdSeason: 3,
    });
    expect(state.memories.some(
      (memory) => memory.kind === 'REPEATED_ELIMINATION',
    )).toBe(true);
    expect(deriveRivalryView(state, 3).lifecycleState).toBe('ACTIVE');
  });

  it('requires both severe-event evidence and the intensity threshold', () => {
    const moderate = appendRivalryMemory(
      emergent(),
      createMajorIncidentRivalryMemory({
        sourceEventId: 'moderate',
        severity: 'MODERATE',
        createdSeason: 0,
      }),
    );
    const extreme = appendRivalryMemory(
      emergent(),
      createMajorIncidentRivalryMemory({
        sourceEventId: 'extreme',
        severity: 'EXTREME',
        createdSeason: 0,
      }),
    );
    expect(deriveRivalryView(moderate, 0).active).toBe(false);
    expect(deriveRivalryView(extreme, 0).active).toBe(true);
  });

  it('decays through dormancy and deletes only after five idle seasons below 15', () => {
    const state = appendRivalryMemory(
      emergent(),
      createMajorIncidentRivalryMemory({
        sourceEventId: 'incident',
        severity: 'MODERATE',
        createdSeason: 0,
      }),
    );
    expect(deriveRivalryView(state, 2).effectiveIntensity)
      .toBeLessThan(DORMANT_INTENSITY);
    expect(shouldDeleteEmergentRivalry(state, 2)).toBe(false);
    expect(shouldDeleteEmergentRivalry(state, 5)).toBe(true);
  });

  it('revives dormant rivalry without making it historical', () => {
    let state = appendRivalryMemory(
      emergent(),
      createMajorIncidentRivalryMemory({
        sourceEventId: 'old',
        severity: 'MODERATE',
        createdSeason: 0,
      }),
    );
    expect(deriveRivalryView(state, 1).lifecycleState).toBe('DORMANT');
    state = appendRivalryMemory(
      state,
      createMajorIncidentRivalryMemory({
        sourceEventId: 'new',
        severity: 'EXTREME',
        createdSeason: 1,
      }),
    );
    expect(deriveRivalryView(state, 1).lifecycleState).toBe('ACTIVE');
    expect(state.permanentHistoricalEdge).toBe(false);
  });

  it('keeps A to B independent from B to A', () => {
    const aToB = appendRivalryMemory(
      emergent(),
      createMajorIncidentRivalryMemory({
        sourceEventId: 'incident',
        severity: 'EXTREME',
        createdSeason: 0,
      }),
    );
    const bToA = createEmergentDirectedRivalry({
      fromClubId: 'club-b',
      toClubId: 'club-a',
      createdSeason: 0,
    });
    expect(deriveRivalryView(aToB, 0).effectiveIntensity).toBe(30);
    expect(deriveRivalryView(bToA, 0).effectiveIntensity).toBe(0);
  });

  it('stores only event-created rivalry edges and prunes old emergent edges', () => {
    let graph = createRivalrySparseGraph([
      createHistoricalRivalryFromInitialSeed({
        fromClubId: 'historic-a',
        toClubId: 'historic-b',
        currentSeason: 0,
        effectiveIntensity: 80,
        reason: 'HISTORICAL_RIVAL',
      }),
    ]);
    graph = recordRivalryMemory(graph, {
      fromClubId: 'recent-a',
      toClubId: 'recent-b',
      memory: createCalibratedRivalryMemory({
        sourceEventId: 'close',
        kind: 'CLOSE_SERIES',
        createdSeason: 0,
      }),
    });
    const pruned = pruneExpiredEmergentRivalries(graph, 5);
    expect(pruned.edges).toHaveLength(1);
    expect(getDirectedRivalry(
      pruned,
      'historic-a',
      'historic-b',
    )).toBeDefined();
  });

  it('remains sparse in a 300-season deterministic soak', () => {
    let graph = createRivalrySparseGraph();
    for (let season = 0; season < 300; season += 1) {
      if (season % 10 === 0) {
        const pair = (season / 10) % 12;
        graph = recordRivalryMemory(graph, {
          fromClubId: 'club-' + pair,
          toClubId: 'club-' + (pair + 100),
          memory: createCalibratedRivalryMemory({
            sourceEventId: 'event-' + season,
            kind: 'POSTSEASON_ELIMINATION',
            createdSeason: season,
          }),
        });
      }
      graph = pruneExpiredEmergentRivalries(graph, season);
    }
    expect(graph.edges.length).toBeLessThan(20);
    expect(graph.edges.length).toBeLessThan(234 * 233);
  });
});