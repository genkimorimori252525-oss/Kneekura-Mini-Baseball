import { expect, it } from 'vitest';
import { createLiveBaseballMatchWorkerV116 } from './LiveBaseballMatchV1';
import { projectLiveSpinMasteryV123 } from './LiveSpinControlV123';
import { observeBattedBallSpinV123 } from '../../core/sim/contact/BattedBallSpinObservationV123';
import { spinNeutralGoldLiveInputsV193, spinNeutralGoldPhysicalRecordV193 } from './SpinNeutralGoldV193.test-support';
import type { simulateLivePitchV1 } from './LivePitchV1';

it.each(['LEGACY', 'INDEPENDENT'] as const)('L01 %s local Gold with no spin target preserves actual contact, official result and continuation', mode => {
  const fixture = spinNeutralGoldLiveInputsV193(mode), normal = createLiveBaseballMatchWorkerV116(fixture.normal), gold = createLiveBaseballMatchWorkerV116(fixture.gold);
  expect(projectLiveSpinMasteryV123(fixture.profile)).toMatchObject({ effectiveStateId: 'GOLD', nativeAdmission: false, masteredTechniqueSet: ['SLICE', 'HOOK', 'BACKSPIN', 'TOPSPIN'] });
  const a = normal.issuePitch(fixture.command), b = gold.issuePitch(fixture.command);
  expect(a.play.contact).not.toBeNull(); expect(a.play.outgoingBallMoment).not.toBeNull();
  expect(a.play.rules).toMatchObject({ kind: 'applied', batterAdvanced: true }); expect(a.events.at(-1)).toMatchObject({ kind: 'pitch_adjudicated' });
  const diagnostics = b.play.diagnostics as ReturnType<typeof simulateLivePitchV1>['diagnostics'], contact = b.play.contact as NonNullable<ReturnType<typeof simulateLivePitchV1>['contact']>;
  expect(diagnostics.spinIntentV123).toMatchObject({ selectedIntent: 'NO_SPIN_TARGET', reason: 'NONE_REQUESTED', effectiveStateId: 'GOLD', nativeAdmission: false });
  expect(diagnostics.battedSpinV123).toStrictEqual(observeBattedBallSpinV123({ velocityMps: contact.exitVelocity, spinRadPerSecond: contact.exitSpin, bats: 'R' }));
  expect(spinNeutralGoldPhysicalRecordV193(b)).toStrictEqual(spinNeutralGoldPhysicalRecordV193(a));
  expect(gold.captureContinuationV116()).toStrictEqual(normal.captureContinuationV116());
  if (mode === 'INDEPENDENT') expect((a.play.diagnostics as ReturnType<typeof simulateLivePitchV1>['diagnostics']).randomnessV152).toBeDefined();
});
