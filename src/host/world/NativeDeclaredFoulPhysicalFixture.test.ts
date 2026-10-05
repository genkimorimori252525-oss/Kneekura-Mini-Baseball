import { mkdtempSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { expect, it } from 'vitest';
import { deriveBallWorldFieldTerritory } from '../../core/rules/BallWorldFieldTerritory';
import { deriveOriginalBattingIntentEvidence } from './OriginalBattingIntent';
import { nativeSettledFoulPhysicalFixture } from './NativeSettledFoulPhysicalFixtures.test-support';

it.each(['ordinary_swing', 'bunt'] as const)('executes an original two-strike %s foul stop with unchanged accepted geometry/calibration', attempt => {
  const directory = mkdtempSync(join(tmpdir(), 'declared-original-foul-'));
  let x: ReturnType<typeof nativeSettledFoulPhysicalFixture> | undefined;
  try {
    x = nativeSettledFoulPhysicalFixture(join(directory, 'world.sqlite'), {
      pitchPhysics: { velocity: { x: 3, y: 0, z: -30 } }, originalContact: { attempt, precedingTakenPitches: 2 },
    });
    const pitch = x.last.response.touch.worldContact.flight.physicalPitch, timeline = pitch.result.pitch.resolution.timeline;
    const territory = deriveBallWorldFieldTerritory(x.physical.field);
    console.info('DECLARED_FOUL_PHYSICAL_DIAGNOSTIC ' + JSON.stringify({ attempt, originalPitchSourceId: pitch.source.sourceId,
      progressRevision: pitch.progressRevision, requestedVelocity: pitch.source.request.delivery.physics.velocity,
      deliveredPitchStart: pitch.result.pitch.trajectory.start, originalMatchCount: { balls: pitch.frame.match.balls, strikes: pitch.frame.match.strikes },
      beforeStatus: pitch.beforeTimeline.status, resultStatus: timeline.status,
      contact: timeline.events.filter(event => event.kind === 'BatBallContact'),
      stop: x.physical.field.evidence.horizon, territory,
      contacts: x.physical.field.evidence.contacts.map(frame => ({ at: frame.moment.elapsedSeconds, kinds: frame.contacts.map(contact => contact.kind) })) }));
    expect(pitch.source.sourceId).toBe('pitch-2'); expect(pitch.progressRevision).toBe(3);
    expect(pitch.frame.match.strikes).toBe(0);
    expect(pitch.beforeTimeline.status).toEqual({ kind: 'active', count: { balls: 0, strikes: 2 } });
    expect(timeline.status).toMatchObject({ kind: 'batted_ball_pending', count: { balls: 0, strikes: 2 } });
    const original = x.pitches.readAcceptedPitch(pitch.source.sourceId)!;
    expect(deriveOriginalBattingIntentEvidence(original).intent).toEqual({ kind: 'declared', version: 'original_batting_intent_v1', attempt });
    expect(territory).toMatchObject({ kind: 'resolved', territory: 'foul', basis: 'settling', moment: x.physical.field.evidence.horizon });
    expect(x.physical.field.evidence.contacts.every(frame => frame.contacts.length === 1
      && ['ground', 'rolling_stop'].includes(frame.contacts[0].kind))).toBe(true);
    expect(x.physical.field.evidence.contacts.at(-1)!.contacts[0].kind).toBe('rolling_stop');
    expect(x.inputArchiveBytes()).toBe(x.originalInputArchiveBytes);
    expect(JSON.stringify(x.f.official.getMatch('game-1'))).toBe(x.originalMatchBytes);
  } finally { x?.f.close(); rmSync(directory, { recursive: true, force: true }); }
}, 90_000);
