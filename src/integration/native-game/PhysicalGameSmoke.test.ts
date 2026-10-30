import { createRequire } from 'node:module';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { expect, it } from 'vitest';
import { runPhysicalGameSmoke } from './PhysicalGameSmoke';
import { continuousPitchAction, continuousPitchFixture } from '../../host/world/ContinuousPitchFixtures.test-support';
import { worldSetup } from '../../host/world/OfficialParticipationPlayFixtures.test-support';
import { openSqlitePhysicalPitchProgressStore, type AcceptedPhysicalPitchActionSource } from '../../host/world/SqlitePhysicalPitchProgressStore';
import { openSqlitePhysicalPlayClosureStore, type AcceptedPhysicalPlayClosure } from '../../host/world/SqlitePhysicalPlayClosureStore';

const { DatabaseSync } = createRequire(import.meta.url)('node:sqlite') as typeof import('node:sqlite');

it('completes an actual nine-inning physical K/BB game, scores the forced walk and reopens the exact Native SQLite receipts', () => {
  const directory = mkdtempSync(join(tmpdir(), 'kneekura-physical-game-smoke-'));
  const databasePath = join(directory, 'physical-nine-innings.sqlite');
  let completed: ReturnType<typeof runPhysicalGameSmoke> | null = null;
  try {
    const f = continuousPitchFixture(databasePath, true);
    try {
      const actions = new Map<string, AcceptedPhysicalPitchActionSource>();
      const closures = new Map<string, AcceptedPhysicalPlayClosure>();
      const pitches = f.track(openSqlitePhysicalPitchProgressStore(f.path,
        { matches: f.official, initialWorlds: f.initialWorlds, participation: f.participation, runtime: f.stores },
        { readAcceptedAction: sourceId => actions.get(sourceId) ?? null }));
      const driver = f.track(openSqlitePhysicalPlayClosureStore(f.path,
        { physicalPitches: pitches, initialWorlds: f.initialWorlds, participation: f.participation, personLinks: f.links },
        { readAcceptedClosure: sourceId => closures.get(sourceId) ?? null }));
      const homeSetup = worldSetup('p2');
      const awaySetup = { ...homeSetup, defenders: homeSetup.defenders.map((defender, index) => ({
        ...defender, playerId: index === 0 ? 'p-away' : `away-${index}`,
      })) };

      completed = runPhysicalGameSmoke({
        gameId: 'game-1', initialStartedAtTick: f.initial.world.tick,
        matches: f.official, pitches, closures: driver,
        maxPlateAppearances: 58, maxPitchesPerPlateAppearance: 4,
        publishPitchSource: ({ before, plateAppearanceIndex, pitchIndex, readyAtTick,
          priorActivationApplicationId }) => {
          const { initialWorldSourceId: _fixtureInitial, ...template } = continuousPitchAction(f,
            pitchIndex, readyAtTick) as AcceptedPhysicalPitchActionSource & { initialWorldSourceId: string };
          const pitcherId = before.matchState.half === 'top' ? 'p2' : 'p-away';
          const revision = f.workload.readHead('career-a', pitcherId)?.revision;
          if (revision === undefined) throw new Error('actual pitcher workload head is missing');
          // A wide physical release for four real takes produces legal balls;
          // later takes physically cross the existing strike zone. Core judges each one.
          const walkIntent = plateAppearanceIndex < 4;
          const source: AcceptedPhysicalPitchActionSource = {
            ...template, sourceId: `smoke-pitch-${plateAppearanceIndex}-${pitchIndex}`,
            ...(priorActivationApplicationId === null
              ? { initialWorldSourceId: 'initial-world' }
              : { activationApplicationId: priorActivationApplicationId }),
            request: { ...template.request, workloadRevision: revision,
              delivery: { ...template.request.delivery, playerId: pitcherId,
                outingId: `outing-${pitcherId}`,
                ...(walkIntent ? { moundReference: { ...template.request.delivery.moundReference, x: 1 } } : {}) } },
          };
          actions.set(source.sourceId, source);
          return source.sourceId;
        },
        publishClosureSource: ({ before, plateAppearanceIndex, terminal, lastPhysicalPitch }) => {
          const timeline = lastPhysicalPitch.result.pitch.resolution.timeline;
          const nextHalf = terminal === 'strikeout' && before.matchState.outs === 2
            ? (before.matchState.half === 'top' ? 'bottom' : 'top')
            : before.matchState.half;
          const source: AcceptedPhysicalPlayClosure = {
            sourceId: `smoke-close-${plateAppearanceIndex}`, sourceVersion: 'physical-smoke-fixture-v1',
            physicalPitchSourceId: lastPhysicalPitch.source.sourceId,
            applicationId: `smoke-official-${plateAppearanceIndex}`,
            scoringApplicationId: `smoke-scoring-${plateAppearanceIndex}`,
            snapshotId: `smoke-rule-${plateAppearanceIndex}`,
            ruleTick: timeline.lastEventTick + 1,
            closureTick: timeline.lastEventTick + 2,
            nextStartedAtTick: timeline.lastEventTick + 3,
            // Every walk is by a distinct existing, pregame-bound away player.
            batterRunnerId: terminal === 'walk' ? `away-${plateAppearanceIndex + 1}` : null,
            worldSetup: nextHalf === 'top' ? homeSetup : awaySetup,
            game: { seasonId: 'league-season-1', homeClubId: 'club-a', awayClubId: 'club-b',
              policy: { version: 'physical-smoke-nine-innings-v1', minimumInnings: 9,
                maximumInnings: 9, tiesAllowed: true } },
          };
          closures.set(source.sourceId, source);
          return source.sourceId;
        },
      });

      expect(completed).toMatchObject({ gameId: 'game-1', physicalPitchCount: 178,
        plateAppearanceCount: 58, walks: 4, strikeouts: 54,
        finalResult: { awayRuns: 1, homeRuns: 0, winnerClubId: 'club-b',
          completionReason: 'BOTTOM_COMPLETE', durableRevision: 58 } });
      expect(completed.plays.slice(0, 4).every(play => play.terminal === 'walk')).toBe(true);
      expect(completed.plays.slice(4).every(play => play.terminal === 'strikeout')).toBe(true);
      expect(completed.plays.map(play => play.receipt.durableRevision))
        .toEqual(Array.from({ length: 58 }, (_value, index) => index + 1));
      expect(completed.plays.map(play => play.scoring.record.runsScored).filter(Boolean)).toEqual([1]);
      expect(completed.finalResult.lineScore.innings).toEqual(Array.from({ length: 9 }, (_v, index) => ({
        inning: index + 1, awayRuns: index === 0 ? 1 : 0, homeRuns: 0,
      })));
      expect(completed.finalResult.lineScore.totals).toEqual({
        away: { runs: 1, hits: 0, errors: 0 }, home: { runs: 0, hits: 0, errors: 0 },
      });
      expect(f.official.getMatch('game-1')!.finalResult).toEqual(completed.finalResult);
      expect(f.workload.readHead('career-a', 'p2')!.revision).toBe(31);
      expect(f.workload.readHead('career-a', 'p-away')!.revision).toBe(27);
      // The original Native closure owner must accept a completed retry unchanged.
      expect(driver.resume(completed.plays[0].closureSourceId).official.receipt)
        .toEqual(completed.plays[0].receipt);
    } finally {
      f.close();
    }

    // All owners are closed before independent disk reopen. No replay result is
    // injected by the test; read the exact persisted Native application history.
    const db = new DatabaseSync(databasePath, { readOnly: true });
    try {
      expect(db.prepare('PRAGMA integrity_check').get()).toEqual({ integrity_check: 'ok' });
      expect(db.prepare('PRAGMA foreign_key_check').all()).toEqual([]);
      const count = (table: string) => (db.prepare(`SELECT count(*) AS n FROM ${table}`).get() as { n: number }).n;
      expect(count('physical_pitch_progress_actions')).toBe(178);
      expect(count('physical_play_closures')).toBe(58);
      expect(count('applications')).toBe(58);
      expect(count('official_scoring_applications')).toBe(58);
      const rows = db.prepare('SELECT application_id, closure_id, result_json FROM applications ORDER BY rowid')
        .all() as { application_id: string; closure_id: string; result_json: string }[];
      for (const [index, row] of rows.entries()) {
        expect(row.application_id).toBe(completed!.plays[index].receipt.applicationId);
        expect(row.closure_id).toBe(completed!.plays[index].receipt.closureId);
        expect((JSON.parse(row.result_json) as { receipt: unknown }).receipt).toEqual(completed!.plays[index].receipt);
      }
      expect(db.prepare("SELECT count(*) AS n FROM physical_play_closures WHERE status='COMPLETED'").get())
        .toEqual({ n: 58 });
      const finalRow = db.prepare('SELECT activation_json FROM matches WHERE match_id=?')
        .get('game-1') as { activation_json: string };
      expect((JSON.parse(finalRow.activation_json) as { finalResult: unknown }).finalResult)
        .toEqual(completed!.finalResult);
    } finally {
      db.close();
    }
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
// Native history reauthentication may be expensive on a contended machine.
// Keep this nine-inning integration gate finite, including under slower CI.
}, 600_000);
