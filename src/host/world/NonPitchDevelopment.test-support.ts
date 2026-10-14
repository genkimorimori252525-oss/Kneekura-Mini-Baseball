import { CATALYST_FAMILIES } from '../../core/world/development/DevelopmentCatalyst';
import type { DevelopmentReceptivityPolicy } from '../../core/world/development/DevelopmentReceptivity';
import { CURVE_SHAPES, DEVELOPMENT_DOMAINS, MATURITY_TIMINGS } from '../../core/world/development/DevelopmentTrajectory';
import { applyRosterChange } from '../../core/world/roster/RosterCommands';
import { createRosterState } from '../../core/world/roster/RosterState';
import { rosterFixture } from '../../core/world/roster/RosterTestFixtures';
import type { DevelopmentAppraisalSources } from './DevelopmentEpisodeFromAcceptedAppraisal';

// Small accepted policy/Person/roster sources from the existing development
// fixture. These values are test calibration, never production defaults.
export const nonPitchDevelopmentFixtureSources = () => {
  const before = createRosterState(rosterFixture());
  const promoted = applyRosterChange(before, {
    commandId: 'promotion-1', causeEventId: 'execution-1',
    expectedRevision: 0, effectiveDay: 10,
    changes: [{ playerId: 'p2',
      assignment: { clubId: 'a', unitId: 'a-first' } }],
  });
  if (!promoted.ok) throw new Error('fixture promotion failed');
  const curves = Object.fromEntries(MATURITY_TIMINGS.map(timing =>
    [timing, Object.fromEntries(CURVE_SHAPES.map(shape =>
      [shape, [{ ageYears: 0, receptivity: 1,
        declinePressure: 0 }, { ageYears: 40,
        receptivity: 1, declinePressure: 0 }]]))])) as unknown as
      DevelopmentReceptivityPolicy['templateCurves'];
  const sources: Omit<DevelopmentAppraisalSources, 'history'> = {
    roster: { readDevelopmentRosterChange: executionId =>
      executionId === 'execution-1' ? { before,
        after: promoted.state, event: promoted.event } : null },
    person: { read: sourceId => sourceId === 'person-1' ? {
      careerId: before.careerId, playerId: 'p2',
      personId: 'person-p2', priors: {
        createdAtDay: 1,
        catalyst: { careerId: before.careerId,
          playerId: 'p2', createdAtDay: 1,
          profileVersion: 'catalyst-v1',
          sensitivityByFamily: Object.fromEntries(
            CATALYST_FAMILIES.map(family => [family, 1])) as
              Record<typeof CATALYST_FAMILIES[number], number> },
        trajectory: { careerId: before.careerId,
          playerId: 'p2', createdAtDay: 1,
          profileVersion: 'trajectory-v1',
          maturityTiming: 'NORMAL', curveShape: 'BROAD_PLATEAU',
          domainOffsets: Object.fromEntries(
            DEVELOPMENT_DOMAINS.map(domain => [domain, 0])) as
              Record<typeof DEVELOPMENT_DOMAINS[number], number>,
          generation: { rngVersion: 'development-xorshift32-v1',
            seed: 1729, drawCount: 8, policyId: 'trajectory-v1' } },
      },
    } : null,
    readDevelopmentSeed: careerId =>
      careerId === before.careerId ? 1729 : null },
    appraisal: { readAcceptedAppraisal: sourceId =>
      sourceId === 'appraisal-1' ? { sourceId,
        episodeId: 'episode-1', careerId: before.careerId,
        playerId: 'p2', domain: 'TECHNICAL',
        ageYears: 20, competingLearningLoad: 0,
        appraisal: { sourceEventId: sourceId,
          atDay: 10, salience: 1,
          learningDisposition: 1, novelty: 1,
          consolidationCapacity: 1 } } : null },
    policies: { readAcceptedPolicies: sourceId =>
      sourceId === 'policy-1' ? { sourceId,
        careerId: before.careerId,
        learning: { policyId: 'learning-v1', version: 'v1',
          availableAtDay: 1, minimumPracticeEvents: 1,
          minimumFeedbackEvents: 1, minimumElapsedDays: 2 },
        receptivity: { policyId: 'receptivity-v1', version: 'v1',
          profileVersion: 'trajectory-v1',
          availableAtDay: 1, templateCurves: curves },
        initiation: { policyId: 'initiation-v1', version: 'v1',
          availableAtDay: 1, baseChance: 1, maximumChance: 1,
          sameMotifSaturation: 0.5, cooldownDays: 30,
          maximumOpenHypotheses: 2 } } : null },
  };
  return sources;
};
