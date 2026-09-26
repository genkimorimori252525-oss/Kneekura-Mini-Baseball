import type { OfficialGameResult } from '../competition/OfficialGameCompletion';
import type { OfficialStandingsSnapshot } from '../competition/OfficialStandings';
import { analyzeTeamSynchrony } from './TeamSynchrony';

export type TeamTraitAnalyticPolicy = Readonly<{
  policyId: string;
  version: string;
  seasonId: string;
  minimumGames: number;
  residualThresholdWins: Readonly<{
    numerator: number;
    denominator: number;
  }>;
  lowRunsAllowedMaximum: number;
  lowRunSupportMaximum: number;
  highRunSupportMinimum: number;
  highRunsAllowedMinimum: number;
  minimumPatternGames: number;
}>;
export type TeamTraitAnalyticDescriptor = Readonly<{
  kind: 'ANALYTIC_DESCRIPTOR';
  family: 'TEAM_SYNCHRONY' | 'PITCHING_GEMS_UNSUPPORTED'
    | 'RUN_SUPPORT_SQUANDERED';
  polarity: 'POSITIVE' | 'NEGATIVE';
  seasonId: string;
  leagueId: string;
  clubId: string;
  policyId: string;
  policyVersion: string;
  evidenceCount: number;
  sourceApplicationIds: readonly string[];
}>;
const id = (value: unknown): value is string =>
  typeof value === 'string' && value.length > 0
    && value === value.trim();
const count = (value: unknown): value is number =>
  Number.isSafeInteger(value) && (value as number) >= 0;
const fields = (value: unknown, names: readonly string[]): boolean =>
  value !== null && typeof value === 'object' && !Array.isArray(value)
    && Object.keys(value).length === names.length
    && names.every((name) => Object.hasOwn(value, name));

/** Official season evidence only; descriptors carry no causal game effect. */
export const deriveTeamTraitAnalyticDescriptors = (
  clubId: string,
  standings: OfficialStandingsSnapshot,
  results: readonly OfficialGameResult[],
  policy: TeamTraitAnalyticPolicy,
): readonly TeamTraitAnalyticDescriptor[] => {
  if (!fields(policy, ['policyId', 'version', 'seasonId',
    'minimumGames', 'residualThresholdWins',
    'lowRunsAllowedMaximum', 'lowRunSupportMaximum',
    'highRunSupportMinimum', 'highRunsAllowedMinimum',
    'minimumPatternGames'])
    || !id(policy.policyId) || !id(policy.version)
    || policy.seasonId !== standings?.seasonId
    || !count(policy.minimumGames)
    || policy.minimumGames < 1
    || !count(policy.minimumPatternGames)
    || policy.minimumPatternGames < 2
    || policy.minimumPatternGames > policy.minimumGames
    || !fields(policy.residualThresholdWins,
      ['numerator', 'denominator'])
    || !count(policy.residualThresholdWins.numerator)
    || policy.residualThresholdWins.numerator === 0
    || !count(policy.residualThresholdWins.denominator)
    || policy.residualThresholdWins.denominator === 0
    || !count(policy.lowRunsAllowedMaximum)
    || !count(policy.lowRunSupportMaximum)
    || !count(policy.highRunSupportMinimum)
    || !count(policy.highRunsAllowedMinimum)
    || policy.highRunSupportMinimum
      <= policy.lowRunSupportMaximum
    || policy.highRunsAllowedMinimum
      <= policy.lowRunsAllowedMaximum) {
    throw new Error('invalid team trait analytic policy');
  }
  const analysis = analyzeTeamSynchrony(clubId, standings, results);
  if (analysis.games < policy.minimumGames) return Object.freeze([]);
  const descriptors: TeamTraitAnalyticDescriptor[] = [];
  const push = (family: TeamTraitAnalyticDescriptor['family'],
    polarity: TeamTraitAnalyticDescriptor['polarity'],
    sourceApplicationIds: readonly string[]) => {
    descriptors.push(Object.freeze({
      kind: 'ANALYTIC_DESCRIPTOR' as const,
      family, polarity, seasonId: analysis.seasonId,
      leagueId: analysis.leagueId, clubId,
      policyId: policy.policyId, policyVersion: policy.version,
      evidenceCount: sourceApplicationIds.length,
      sourceApplicationIds: Object.freeze(
        [...sourceApplicationIds].sort()),
    }));
  };
  const residual = BigInt(analysis.alignmentResidualWinsNumerator);
  const meetsResidualThreshold = (residual < 0n ? -residual : residual)
    * BigInt(policy.residualThresholdWins.denominator)
    >= BigInt(policy.residualThresholdWins.numerator)
      * BigInt(analysis.alignmentResidualWinsDenominator);
  if (residual !== 0n && meetsResidualThreshold) {
    push('TEAM_SYNCHRONY', residual > 0n ? 'POSITIVE' : 'NEGATIVE',
      analysis.sourceApplicationIds);
  }
  const unsupported: string[] = [];
  const squandered: string[] = [];
  for (const result of results) {
    const forClub = result.homeClubId === clubId
      ? result.homeRuns : result.awayRuns;
    const againstClub = result.homeClubId === clubId
      ? result.awayRuns : result.homeRuns;
    if (result.winnerClubId !== clubId
      && againstClub <= policy.lowRunsAllowedMaximum
      && forClub <= policy.lowRunSupportMaximum) {
      unsupported.push(result.applicationId);
    }
    if (result.winnerClubId !== clubId
      && forClub >= policy.highRunSupportMinimum
      && againstClub >= policy.highRunsAllowedMinimum) {
      squandered.push(result.applicationId);
    }
  }
  if (unsupported.length >= policy.minimumPatternGames) {
    push('PITCHING_GEMS_UNSUPPORTED', 'NEGATIVE', unsupported);
  }
  if (squandered.length >= policy.minimumPatternGames) {
    push('RUN_SUPPORT_SQUANDERED', 'NEGATIVE', squandered);
  }
  return Object.freeze(descriptors);
};
