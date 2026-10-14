import { actualLivePlayId as id } from './ActualLivePlayScope';

/** Rejection-only metadata interface. Implementations retain duplicate/escaped
 * object keys and array ancestors; none of these values authenticates a Source. */
export type FoulTerminalCompletionMetadataReader = Readonly<{
  value(column: string, path: readonly string[]): readonly unknown[];
  reference(column: string, path: readonly string[], owner: string): readonly unknown[];
}>;
const strings = (values: readonly unknown[]): string[] => values.filter((value): value is string => typeof value === 'string');
const completionVersion = 'actual_foul_terminal_post_play_completion_v1';
const scoringVersion = 'actual_foul_terminal_scoring_v1';
const terminalOwner = 'actual_foul_terminal_applications';
const embedded = (identity: string, version: string, size: number): string[] => {
  try {
    const value: unknown = JSON.parse(identity);
    return Array.isArray(value) && value.length === size && value[0] === version && value.slice(1).every(id)
      ? value.slice(1) : [];
  } catch { return []; }
};
// Each key is a distinct identity domain. Equal literal bytes in different
// domains must not create an edge (in particular setup Source vs terminal
// Source, and accepted setup Source hash vs completion snapshot hash).
const paths = {
  setupSourceIds: [['source','sourceId'],['controllerRetirement','sourceId'],['setupSourceId']],
  completionIds: [['completionId']],
  completionSourceHashes: [['sourceHash']],
  completionSnapshotHashes: [['snapshotHash']],
  terminalSourceHashes: [['terminalReference','sourceHash'],['source','terminalReference','sourceHash']],
  terminalProposalHashes: [['terminalReference','proposalHash'],['source','terminalReference','proposalHash']],
  receiptHashes: [['officialReference','receiptHash']],
  pendingPostPlayHashes: [['officialReference','pendingPostPlayHash']],
  acknowledgementHashes: [['officialReference','acknowledgementHash']],
  scoringApplicationIds: [['scoringReference','scoringApplicationId']],
  scoringRowHashes: [['scoringReference','rowHash']],
  workloadPlanHashes: [['workloadReference','planHash']],
  workloadActivitySourceIds: [['workloadReference','participantEffects','activitySourceId']],
  workloadActivityHashes: [['workloadReference','participantEffects','activityHash']],
  workloadAfterHashes: [['workloadReference','participantEffects','afterHash']],
  physicalEndSourceIds: [],
  physicalEndSourceHashes: [['controllerRetirement','physicalEndReference','sourceHash']],
  physicalEndSnapshotHashes: [['controllerRetirement','physicalEndReference','snapshotHash']],
} as const;
type Domain = keyof typeof paths;
export type FoulTerminalCompletionIdentities = { [K in Domain]: string[] };
export type FoulTerminalCompletionIdentitySets = { [K in Domain]: Set<string> };
const domains = Object.keys(paths) as Domain[];
export const emptyFoulTerminalCompletionIdentitySets = (): FoulTerminalCompletionIdentitySets =>
  Object.fromEntries(domains.map(key => [key,new Set<string>()])) as FoulTerminalCompletionIdentitySets;
export const matchesFoulTerminalCompletionIdentities = (found: FoulTerminalCompletionIdentities,
  known: FoulTerminalCompletionIdentitySets): boolean => domains.some(key => found[key].some(value => known[key].has(value)));
export const growFoulTerminalCompletionIdentities = (known: FoulTerminalCompletionIdentitySets,
  found: FoulTerminalCompletionIdentities): void => {
  for (const key of domains) for (const value of found[key]) known[key].add(value);
};
export const combineFoulTerminalCompletionIdentities = (found: readonly FoulTerminalCompletionIdentities[]): FoulTerminalCompletionIdentities =>
  Object.fromEntries(domains.map(key => [key,found.flatMap(value => value[key])])) as FoulTerminalCompletionIdentities;

/** Both full terminal completion and compact application references are raw
 * claims. Unsupported/partial envelopes are deliberately discoverable. */
export const foulTerminalCompletionRawIdentities = (m: FoulTerminalCompletionMetadataReader, column: string,
  prefix: readonly string[] = []) => {
  const root = [...prefix,'completion'];
  const value = (path: readonly string[]) => strings(m.value(column,[...root,...path]));
  const found = Object.fromEntries(domains.map(key => [key,paths[key].flatMap(path => value(path))])) as FoulTerminalCompletionIdentities;
  const completions = found.completionIds.flatMap(value => [embedded(value,completionVersion,3),embedded(value,'actual_foul_terminal_post_play_completion_v2',3)]);
  found.setupSourceIds.push(...completions.flatMap(value => value.length ? [value[1]] : []));
  found.physicalEndSourceIds.push(...strings(m.reference(column,[...root,'controllerRetirement','physicalEndReference'],'actual_foul_play_ends')));
  const sourceIds = [
    ...m.reference(column,[...root,'terminalReference'],terminalOwner),
    ...m.reference(column,[...root,'source','terminalReference'],terminalOwner),
    ...value(['terminalSourceId']),...value(['workloadReference','terminalSourceId']),
    ...completions.flatMap(value => value.length ? [value[0]] : []),
    ...found.scoringApplicationIds.flatMap(value => embedded(value,scoringVersion,2)),
  ];
  return { ...found,sourceIds:strings(sourceIds),
    applicationIds:[...value(['officialReference','applicationId']),...value(['activation','applicationId']),...value(['finalResult','applicationId'])],
    closureIds:[...value(['activation','closureId']),...value(['finalResult','closureId'])] };
};

/** Only previousPlayId means the consumed PA. A next play or current Match
 * playId never substitutes for it; the caller supplies the original game. */
export const foulTerminalCompletionPreviousPlayClaim = (m: FoulTerminalCompletionMetadataReader, column: string,
  prefix: readonly string[], playId: number): boolean =>
  m.value(column,[...prefix,'completion','activation','previousPlayId']).includes(playId)
  || m.value(column,[...prefix,'completion','controllerRetirement','previousPlayId']).includes(playId);
export const foulTerminalCompletionPhysicalEndClaim = (m: FoulTerminalCompletionMetadataReader, column: string,
  prefix: readonly string[], physicalEndSourceId: string): boolean =>
  m.reference(column,[...prefix,'completion','controllerRetirement','physicalEndReference'],'actual_foul_play_ends').includes(physicalEndSourceId);
