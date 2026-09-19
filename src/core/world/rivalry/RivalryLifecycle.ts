export type ClubId = string;
export type RivalryEventId = string;
export type SeasonId = number;

export type HistoricalRivalryReason =
  | 'ICONIC_HISTORICAL'
  | 'HISTORICAL_RIVAL'
  | 'LOCAL_DERBY'
  | 'NATIONAL_RIVAL'
  | 'CONTINENTAL_RIVAL'
  | 'COMPETITIVE_RIVAL';

export type InitialRivalryReason =
  | HistoricalRivalryReason
  | 'TITLE_RIVAL'
  | 'DOMINANT_CLUB_TARGET';

export type RivalryMemoryKind =
  | 'INITIAL_CONTEXT'
  | 'TITLE_RACE'
  | 'HEAD_TO_HEAD_DECIDER'
  | 'POSTSEASON_ELIMINATION'
  | 'CHAMPIONSHIP_FINAL_ELIMINATION'
  | 'WINNER_AFTER_ELIMINATION'
  | 'REPEATED_ELIMINATION'
  | 'CONTINENTAL_WORLD_ELIMINATION'
  | 'MAJOR_INCIDENT'
  | 'STAR_TRANSFER_GRIEVANCE'
  | 'STAFF_POACHING_GRIEVANCE'
  | 'CLOSE_SERIES'
  | 'HUMILIATING_RESULT';

export type RivalryMemory = Readonly<{
  sourceEventId: RivalryEventId;
  kind: RivalryMemoryKind;
  initialWeight: number;
  createdSeason: SeasonId;
  halfLifeSeasons: number;
}>;

export type DirectedRivalryState = Readonly<{
  fromClubId: ClubId;
  toClubId: ClubId;
  permanentHistoricalEdge: boolean;
  historicalReason: HistoricalRivalryReason | null;
  historicalFloor: number;
  memories: readonly RivalryMemory[];
  currentCompetitiveThreat: number;
  createdSeason: SeasonId;
}>;

export type RivalryLifecycleState =
  | 'HISTORICAL'
  | 'ACTIVE'
  | 'DORMANT'
  | 'INACTIVE';

export type RivalryView = Readonly<{
  dynamicScore: number;
  effectiveIntensity: number;
  lifecycleState: RivalryLifecycleState;
  active: boolean;
}>;

export type RivalrySparseGraph = Readonly<{
  edges: readonly DirectedRivalryState[];
}>;

export type DirectedCompetitiveThreatSignal = Readonly<{
  fromClubId: ClubId;
  toClubId: ClubId;
  currentCompetitiveThreat: number;
}>;

type MemorySpec = Readonly<{
  weight: number;
  halfLifeSeasons: number;
  routine: boolean;
  singletonPerSeason: boolean;
}>;

export const HISTORICAL_RIVALRY_FLOORS: Readonly<
  Record<HistoricalRivalryReason, number>
> = Object.freeze({
  ICONIC_HISTORICAL: 70,
  HISTORICAL_RIVAL: 55,
  LOCAL_DERBY: 50,
  NATIONAL_RIVAL: 45,
  CONTINENTAL_RIVAL: 40,
  COMPETITIVE_RIVAL: 30,
});

export const INITIAL_CONTEXT_HALF_LIFE_SEASONS = 6;
export const ROUTINE_MEMORY_CAP_PER_SEASON = 30;
export const ACTIVE_INTENSITY = 30;
export const DORMANT_INTENSITY = 15;
export const DELETE_IDLE_SEASONS = 5;
export const MULTI_EVENT_WINDOW_SEASONS = 4;
export const SEVERE_EVENT_MIN_WEIGHT = 24;

const MEMORY_SPECS: Readonly<Partial<Record<RivalryMemoryKind, MemorySpec>>> =
  Object.freeze({
    TITLE_RACE: { weight: 10, halfLifeSeasons: 3, routine: true, singletonPerSeason: true },
    HEAD_TO_HEAD_DECIDER: { weight: 14, halfLifeSeasons: 4, routine: true, singletonPerSeason: false },
    POSTSEASON_ELIMINATION: { weight: 16, halfLifeSeasons: 5, routine: true, singletonPerSeason: false },
    CHAMPIONSHIP_FINAL_ELIMINATION: { weight: 22, halfLifeSeasons: 6, routine: true, singletonPerSeason: false },
    WINNER_AFTER_ELIMINATION: { weight: 7, halfLifeSeasons: 4, routine: true, singletonPerSeason: false },
    REPEATED_ELIMINATION: { weight: 8, halfLifeSeasons: 6, routine: false, singletonPerSeason: true },
    CONTINENTAL_WORLD_ELIMINATION: { weight: 18, halfLifeSeasons: 6, routine: true, singletonPerSeason: false },
    STAR_TRANSFER_GRIEVANCE: { weight: 12, halfLifeSeasons: 5, routine: false, singletonPerSeason: false },
    STAFF_POACHING_GRIEVANCE: { weight: 8, halfLifeSeasons: 4, routine: false, singletonPerSeason: false },
    CLOSE_SERIES: { weight: 6, halfLifeSeasons: 3, routine: true, singletonPerSeason: true },
    HUMILIATING_RESULT: { weight: 6, halfLifeSeasons: 2, routine: true, singletonPerSeason: true },
  });

const ELIMINATION_KINDS = new Set<RivalryMemoryKind>([
  'POSTSEASON_ELIMINATION',
  'CHAMPIONSHIP_FINAL_ELIMINATION',
  'CONTINENTAL_WORLD_ELIMINATION',
]);

const assertSeason = (value: number, label: string): void => {
  if (!Number.isInteger(value) || value < 0) {
    throw new Error(label + ' must be a non-negative integer season');
  }
};

const assertPercent = (value: number, label: string): number => {
  if (!Number.isFinite(value) || value < 0 || value > 100) {
    throw new Error(label + ' must be finite and within [0, 100]');
  }
  return value;
};

const assertPair = (fromClubId: ClubId, toClubId: ClubId): void => {
  if (fromClubId.length === 0 || toClubId.length === 0) {
    throw new Error('club ids must be non-empty');
  }
  if (fromClubId === toClubId) {
    throw new Error('directed rivalry requires two distinct clubs');
  }
};

const normalizeReason = (
  reason: InitialRivalryReason,
): HistoricalRivalryReason => {
  if (reason === 'DOMINANT_CLUB_TARGET') {
    throw new Error(
      'DOMINANT_CLUB_TARGET is competitive threat, not permanent rivalry',
    );
  }
  if (reason === 'TITLE_RIVAL') return 'COMPETITIVE_RIVAL';
  return reason;
};

export const historicalFloorForReason = (
  reason: InitialRivalryReason,
): number => HISTORICAL_RIVALRY_FLOORS[normalizeReason(reason)];

export const createRivalryMemory = (
  input: RivalryMemory,
): RivalryMemory => {
  if (input.sourceEventId.length === 0) {
    throw new Error('sourceEventId must be non-empty');
  }
  assertSeason(input.createdSeason, 'createdSeason');
  assertPercent(input.initialWeight, 'initialWeight');
  if (!Number.isFinite(input.halfLifeSeasons) || input.halfLifeSeasons <= 0) {
    throw new Error('halfLifeSeasons must be finite and greater than 0');
  }
  return Object.freeze({ ...input });
};

export const createCalibratedRivalryMemory = (
  input: Readonly<{
    sourceEventId: RivalryEventId;
    kind: Exclude<RivalryMemoryKind, 'INITIAL_CONTEXT' | 'MAJOR_INCIDENT'>;
    createdSeason: SeasonId;
  }>,
): RivalryMemory => {
  const spec = MEMORY_SPECS[input.kind];
  if (spec === undefined) throw new Error('missing rivalry memory calibration');
  return createRivalryMemory({
    ...input,
    initialWeight: spec.weight,
    halfLifeSeasons: spec.halfLifeSeasons,
  });
};

export const createMajorIncidentRivalryMemory = (
  input: Readonly<{
    sourceEventId: RivalryEventId;
    severity: 'MODERATE' | 'SEVERE' | 'EXTREME';
    createdSeason: SeasonId;
  }>,
): RivalryMemory => {
  const spec = input.severity === 'MODERATE'
    ? { weight: 18, halfLifeSeasons: 6 }
    : input.severity === 'SEVERE'
      ? { weight: 24, halfLifeSeasons: 8 }
      : { weight: 30, halfLifeSeasons: 10 };
  return createRivalryMemory({
    sourceEventId: input.sourceEventId,
    kind: 'MAJOR_INCIDENT',
    initialWeight: spec.weight,
    createdSeason: input.createdSeason,
    halfLifeSeasons: spec.halfLifeSeasons,
  });
};

export const createEmergentDirectedRivalry = (
  input: Readonly<{
    fromClubId: ClubId;
    toClubId: ClubId;
    createdSeason: SeasonId;
  }>,
): DirectedRivalryState => {
  assertPair(input.fromClubId, input.toClubId);
  assertSeason(input.createdSeason, 'createdSeason');
  return Object.freeze({
    ...input,
    permanentHistoricalEdge: false,
    historicalReason: null,
    historicalFloor: 0,
    memories: Object.freeze([]),
    currentCompetitiveThreat: 0,
  });
};

export const createHistoricalRivalryFromInitialSeed = (
  input: Readonly<{
    fromClubId: ClubId;
    toClubId: ClubId;
    currentSeason: SeasonId;
    effectiveIntensity: number;
    reason: InitialRivalryReason;
    sourceEventId?: RivalryEventId;
    historicalFloorOverride?: number;
  }>,
): DirectedRivalryState => {
  assertPair(input.fromClubId, input.toClubId);
  assertSeason(input.currentSeason, 'currentSeason');
  const intensity = assertPercent(input.effectiveIntensity, 'effectiveIntensity');
  const historicalReason = normalizeReason(input.reason);
  const floor = input.historicalFloorOverride === undefined
    ? HISTORICAL_RIVALRY_FLOORS[historicalReason]
    : assertPercent(input.historicalFloorOverride, 'historicalFloorOverride');
  if (intensity < floor) {
    throw new Error('initial rivalry intensity cannot be below historical floor');
  }
  const initialWeight = floor === 100
    ? 0
    : ((intensity - floor) * 100) / (100 - floor);
  const context = createRivalryMemory({
    sourceEventId: input.sourceEventId
      ?? 'initial-context:' + input.fromClubId + '->' + input.toClubId,
    kind: 'INITIAL_CONTEXT',
    initialWeight,
    createdSeason: input.currentSeason,
    halfLifeSeasons: INITIAL_CONTEXT_HALF_LIFE_SEASONS,
  });
  return Object.freeze({
    fromClubId: input.fromClubId,
    toClubId: input.toClubId,
    permanentHistoricalEdge: true,
    historicalReason,
    historicalFloor: floor,
    memories: Object.freeze([context]),
    currentCompetitiveThreat: 0,
    createdSeason: input.currentSeason,
  });
};

export const rivalryMemoryContribution = (
  memory: RivalryMemory,
  currentSeason: SeasonId,
): number => {
  assertSeason(currentSeason, 'currentSeason');
  if (currentSeason < memory.createdSeason) {
    throw new Error('currentSeason cannot precede rivalry memory creation');
  }
  const age = currentSeason - memory.createdSeason;
  return memory.initialWeight * (2 ** (-age / memory.halfLifeSeasons));
};

export const deriveRivalryDynamicScore = (
  state: DirectedRivalryState,
  currentSeason: SeasonId,
): number => {
  assertSeason(currentSeason, 'currentSeason');
  if (currentSeason < state.createdSeason) {
    throw new Error('currentSeason cannot precede rivalry edge creation');
  }
  return Math.min(
    100,
    state.memories.reduce(
      (sum, memory) => sum + rivalryMemoryContribution(memory, currentSeason),
      0,
    ),
  );
};

export const deriveRivalryEffectiveIntensity = (
  state: DirectedRivalryState,
  currentSeason: SeasonId,
): number => {
  const dynamicScore = deriveRivalryDynamicScore(state, currentSeason);
  if (!state.permanentHistoricalEdge) return dynamicScore;
  return state.historicalFloor
    + (dynamicScore * (100 - state.historicalFloor)) / 100;
};

export const isEmergentRivalryActive = (
  state: DirectedRivalryState,
  currentSeason: SeasonId,
): boolean => {
  if (state.permanentHistoricalEdge) return true;
  const intensity = deriveRivalryEffectiveIntensity(state, currentSeason);
  if (intensity < ACTIVE_INTENSITY) return false;
  const recent = state.memories.filter((memory) => (
    memory.kind !== 'INITIAL_CONTEXT'
    && memory.createdSeason <= currentSeason
    && currentSeason - memory.createdSeason <= MULTI_EVENT_WINDOW_SEASONS
  ));
  const severe = state.memories.some((memory) => (
    memory.kind !== 'INITIAL_CONTEXT'
    && memory.createdSeason <= currentSeason
    && memory.initialWeight >= SEVERE_EVENT_MIN_WEIGHT
  ));
  return recent.length >= 2 || severe;
};

export const deriveRivalryView = (
  state: DirectedRivalryState,
  currentSeason: SeasonId,
): RivalryView => {
  const dynamicScore = deriveRivalryDynamicScore(state, currentSeason);
  const effectiveIntensity = state.permanentHistoricalEdge
    ? state.historicalFloor
      + (dynamicScore * (100 - state.historicalFloor)) / 100
    : dynamicScore;
  const active = state.permanentHistoricalEdge
    || isEmergentRivalryActive(state, currentSeason);
  const lifecycleState: RivalryLifecycleState = state.permanentHistoricalEdge
    ? 'HISTORICAL'
    : active
      ? 'ACTIVE'
      : effectiveIntensity >= DORMANT_INTENSITY
        ? 'DORMANT'
        : 'INACTIVE';
  return Object.freeze({
    dynamicScore,
    effectiveIntensity,
    lifecycleState,
    active,
  });
};

const memorySpec = (memory: RivalryMemory): MemorySpec | undefined =>
  MEMORY_SPECS[memory.kind];

export const appendRivalryMemory = (
  state: DirectedRivalryState,
  memory: RivalryMemory,
): DirectedRivalryState => {
  if (memory.kind === 'INITIAL_CONTEXT' && !state.permanentHistoricalEdge) {
    throw new Error('INITIAL_CONTEXT is reserved for historical seeds');
  }
  if (memory.createdSeason < state.createdSeason) {
    throw new Error('rivalry memory cannot predate rivalry edge');
  }
  if (state.memories.some((item) => item.sourceEventId === memory.sourceEventId)) {
    return state;
  }
  const spec = memorySpec(memory);
  if (
    spec?.singletonPerSeason === true
    && state.memories.some((item) => (
      item.kind === memory.kind && item.createdSeason === memory.createdSeason
    ))
  ) {
    return state;
  }

  let accepted = memory;
  if (spec?.routine === true) {
    const used = state.memories
      .filter((item) => (
        item.createdSeason === memory.createdSeason
        && memorySpec(item)?.routine === true
      ))
      .reduce((sum, item) => sum + item.initialWeight, 0);
    const remaining = Math.max(0, ROUTINE_MEMORY_CAP_PER_SEASON - used);
    if (remaining === 0) return state;
    if (memory.initialWeight > remaining) {
      accepted = Object.freeze({ ...memory, initialWeight: remaining });
    }
  }
  return Object.freeze({
    ...state,
    memories: Object.freeze([...state.memories, accepted]),
  });
};

export const recordEliminationAgainstOpponent = (
  state: DirectedRivalryState,
  input: Readonly<{
    sourceEventId: RivalryEventId;
    createdSeason: SeasonId;
    kind:
      | 'POSTSEASON_ELIMINATION'
      | 'CHAMPIONSHIP_FINAL_ELIMINATION'
      | 'CONTINENTAL_WORLD_ELIMINATION';
  }>,
): DirectedRivalryState => {
  let next = appendRivalryMemory(
    state,
    createCalibratedRivalryMemory(input),
  );
  const recent = next.memories.filter((memory) => (
    ELIMINATION_KINDS.has(memory.kind)
    && memory.createdSeason <= input.createdSeason
    && input.createdSeason - memory.createdSeason <= MULTI_EVENT_WINDOW_SEASONS
  ));
  if (recent.length < 2) return next;
  next = appendRivalryMemory(next, createCalibratedRivalryMemory({
    sourceEventId: input.sourceEventId + ':repeated-elimination',
    kind: 'REPEATED_ELIMINATION',
    createdSeason: input.createdSeason,
  }));
  return next;
};

export const shouldDeleteEmergentRivalry = (
  state: DirectedRivalryState,
  currentSeason: SeasonId,
): boolean => {
  if (state.permanentHistoricalEdge) return false;
  if (deriveRivalryEffectiveIntensity(state, currentSeason) >= DORMANT_INTENSITY) {
    return false;
  }
  const lastMeaningfulSeason = state.memories
    .filter((memory) => memory.kind !== 'INITIAL_CONTEXT')
    .reduce(
      (latest, memory) => Math.max(latest, memory.createdSeason),
      state.createdSeason,
    );
  return currentSeason - lastMeaningfulSeason >= DELETE_IDLE_SEASONS;
};

export const withCurrentCompetitiveThreat = (
  state: DirectedRivalryState,
  value: number,
): DirectedRivalryState => Object.freeze({
  ...state,
  currentCompetitiveThreat: assertPercent(value, 'currentCompetitiveThreat'),
});

export const createDirectedCompetitiveThreatSignal = (
  input: DirectedCompetitiveThreatSignal,
): DirectedCompetitiveThreatSignal => {
  assertPair(input.fromClubId, input.toClubId);
  return Object.freeze({
    ...input,
    currentCompetitiveThreat: assertPercent(
      input.currentCompetitiveThreat,
      'currentCompetitiveThreat',
    ),
  });
};

const samePair = (
  edge: DirectedRivalryState,
  fromClubId: ClubId,
  toClubId: ClubId,
): boolean => edge.fromClubId === fromClubId && edge.toClubId === toClubId;

export const createRivalrySparseGraph = (
  edges: readonly DirectedRivalryState[] = [],
): RivalrySparseGraph => {
  const seen = new Set<string>();
  for (const edge of edges) {
    const key = edge.fromClubId + '\u0000' + edge.toClubId;
    if (seen.has(key)) {
      throw new Error('duplicate directed rivalry edge');
    }
    seen.add(key);
  }
  return Object.freeze({ edges: Object.freeze([...edges]) });
};

export const getDirectedRivalry = (
  graph: RivalrySparseGraph,
  fromClubId: ClubId,
  toClubId: ClubId,
): DirectedRivalryState | undefined => graph.edges.find(
  (edge) => samePair(edge, fromClubId, toClubId),
);

export const upsertDirectedRivalry = (
  graph: RivalrySparseGraph,
  state: DirectedRivalryState,
): RivalrySparseGraph => {
  const index = graph.edges.findIndex((edge) => samePair(
    edge,
    state.fromClubId,
    state.toClubId,
  ));
  if (index < 0) return createRivalrySparseGraph([...graph.edges, state]);
  const edges = [...graph.edges];
  edges[index] = state;
  return createRivalrySparseGraph(edges);
};

export const recordRivalryMemory = (
  graph: RivalrySparseGraph,
  input: Readonly<{
    fromClubId: ClubId;
    toClubId: ClubId;
    memory: RivalryMemory;
  }>,
): RivalrySparseGraph => {
  const existing = getDirectedRivalry(
    graph,
    input.fromClubId,
    input.toClubId,
  );
  if (existing === undefined && input.memory.kind === 'INITIAL_CONTEXT') {
    throw new Error('INITIAL_CONTEXT must be seeded as historical rivalry');
  }
  const state = existing ?? createEmergentDirectedRivalry({
    fromClubId: input.fromClubId,
    toClubId: input.toClubId,
    createdSeason: input.memory.createdSeason,
  });
  return upsertDirectedRivalry(
    graph,
    appendRivalryMemory(state, input.memory),
  );
};

export const pruneExpiredEmergentRivalries = (
  graph: RivalrySparseGraph,
  currentSeason: SeasonId,
): RivalrySparseGraph => createRivalrySparseGraph(
  graph.edges.filter(
    (edge) => !shouldDeleteEmergentRivalry(edge, currentSeason),
  ),
);