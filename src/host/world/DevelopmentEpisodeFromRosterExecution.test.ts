import { expect, it } from 'vitest';
import { applyRosterChange } from '../../core/world/roster/RosterCommands';
import { createRosterState } from '../../core/world/roster/RosterState';
import { rosterFixture } from '../../core/world/roster/RosterTestFixtures';
import { startDevelopmentEpisodeFromRosterExecution } from
  './DevelopmentEpisodeFromRosterExecution';

const policy = { policyId: 'learning-v1', version: 'v1',
  availableAtDay: 10, minimumPracticeEvents: 2,
  minimumFeedbackEvents: 1, minimumElapsedDays: 5 };
const scenario = () => {
  const before = createRosterState(rosterFixture());
  const promoted = applyRosterChange(before, {
    commandId: 'promote-1', causeEventId: 'execution-1',
    expectedRevision: 0, effectiveDay: 10,
    changes: [{ playerId: 'p2',
      assignment: { clubId: 'a', unitId: 'a-first' } }],
  });
  if (!promoted.ok) throw new Error('fixture promotion failed');
  const sources = {
    roster: { readDevelopmentRosterChange: (executionId: string) =>
      executionId === 'execution-1' ? {
        before, after: promoted.state, event: promoted.event } : null },
    person: { read: (sourceId: string) =>
      sourceId === 'person-source-1' ? {
        careerId: before.careerId, playerId: 'p2',
        personId: 'person-p2', priors: { createdAtDay: 1,
          catalyst: { careerId: before.careerId,
            playerId: 'p2', createdAtDay: 1,
            profileVersion: 'catalyst-v1' } },
      } : null },
  };
  const input = { episodeId: 'episode-1',
    executionId: 'execution-1', playerId: 'p2',
    personSourceId: 'person-source-1', policy };
  return { sources, input, promoted };
};

it('starts one candidate episode from accepted roster execution and Person prior', () => {
  const { sources, input, promoted } = scenario();
  const episode = startDevelopmentEpisodeFromRosterExecution(
    sources, input);
  expect(episode).toMatchObject({ careerId: promoted.state.careerId,
    playerId: 'p2', stage: 'CATALYST',
    catalyst: { sourceEventId: promoted.event.eventId,
      causeEventId: 'execution-1' } });
  expect(episode).not.toHaveProperty('ability');
  expect(() => startDevelopmentEpisodeFromRosterExecution(sources,
    { ...input, playerId: 'other' })).toThrow('sources');
  expect(() => startDevelopmentEpisodeFromRosterExecution(sources,
    { ...input, executionId: 'unknown' })).toThrow('sources');
});
