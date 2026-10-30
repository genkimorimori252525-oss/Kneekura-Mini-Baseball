import { AUTHORED_MATCH_RANDOMNESS_V152 } from '../../core/rng/LiveRandomStreamsV152';
import { SPIN_TECHNIQUES_V123 } from '../../core/world/traits/SpinTechniqueV123';
import { LIVE_MATCH_AUTHORED_SI_DEFAULTS_V1, type LiveIssuedPitchV1, type LiveMatchInputV1 } from './LiveBaseballMatchV1';
import { liveMatchFixture } from './LiveBaseballMatchV1.test-support';
import type { LiveSpinControlV123 } from './LiveSpinControlV123';
import type { simulateLivePitchV1 } from './LivePitchV1';

/** Explicit local authoring repertoire, never a Native mastery qualification. */
export function spinNeutralGoldLiveInputsV193(mode: 'LEGACY' | 'INDEPENDENT') {
  const base = liveMatchFixture(3), clip = base.measuredClips.find(c => c.side === 'R')!;
  const profile: LiveSpinControlV123 = { version: 'live_spin_control_v123', boundary: 'LOCAL_AUTHORING_ONLY',
    sourceId: 'v193-local-gold-control', sourceVersion: 'explicit-test-only', preferredIntent: 'NO_SPIN_TARGET',
    techniques: SPIN_TECHNIQUES_V123.map(technique => ({ technique, sourceId: 'v193-local:' + technique,
      sourceEffectIdentity: 'v193-local-effect:' + technique, learnedStatus: 'CONSOLIDATED',
      calibration: { sourceId: 'v193-authored-calibration:' + technique, sourceVersion: 'test-only', status: 'MODEL_VERIFIED' },
      clip: { id: clip.id, sourceSha256: clip.source.sha256, bats: 'R' },
      motion: { attackAngleDegrees: technique === 'TOPSPIN' ? -12 : 12, pullAngleDeltaDegrees: 0,
        contactOffsetMeters: { pull: 0, up: technique === 'TOPSPIN' ? .01 : -.01, depth: 0 } },
      conditions: { minimumInsideNormalized: -3, maximumInsideNormalized: 3, minimumHeightNormalized: -3, maximumHeightNormalized: 3, minimumAvailableSeconds: 0 } })) };
  const physical = { ...LIVE_MATCH_AUTHORED_SI_DEFAULTS_V1, clipId: clip.id, maximumSweetSpotSpeedMps: 50, targetSweetSpotSpeedMps: 30,
    motorLatencySeconds: .04, timingStdSeconds: 0, aimStdMeters: 0, commandStdMeters: 0,
    swingDecision: { approach: 'SWING' as const, threshold: 0, aggressionWeight: .5 } };
  const normal: LiveMatchInputV1 = { ...base, ...(mode === 'INDEPENDENT' ? { randomnessV152: AUTHORED_MATCH_RANDOMNESS_V152 } : {}),
    players: base.players.map(p => ({ ...p, bats: 'R', physical })) };
  const gold: LiveMatchInputV1 = { ...normal, players: normal.players.map(p => ({ ...p, physical: { ...physical, spinControlV123: profile } })) };
  return { normal, gold, profile, command: { managedTeam: 0 as const, batting: 'balanced' as const, pitchType: 'curve', location: 'zone' } };
}

/** Only qualification/request diagnostics and a redundant spin observation differ.
 * The test separately verifies those diagnostics and the observation against actual contact. */
export function spinNeutralGoldPhysicalRecordV193(record: LiveIssuedPitchV1) {
  const original = record.play.diagnostics as ReturnType<typeof simulateLivePitchV1>['diagnostics'];
  const { spinIntentV123: _intent, battedSpinV123: _observation, ...diagnostics } = original;
  return { ...record, play: { ...record.play, diagnostics } };
}
