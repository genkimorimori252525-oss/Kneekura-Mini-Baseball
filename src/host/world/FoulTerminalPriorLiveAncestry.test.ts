import { expect, it, vi } from 'vitest';
import { fixture, withFixture } from './ActualLivePhysicalActivationReadPairFixtures.test-support';
import { withFoulTerminalOriginalScope, assertFoulTerminalPriorActivation } from './FoulTerminalCompletionAncestryGuard';
import * as adjudication from './ActualLiveAdjudicationFromSqlite';
// Existing Native closure/workload fixture, with its explicitly synthetic
// physical boundary. This checks nested proof scope, not a genuine mixed chain.
it('TA-S03 structural nested prior-live proof uses its own consuming original frame', () => withFixture(fixture(), f => {
  const factory=vi.mocked(adjudication.actualLiveAdjudicationEvidenceFromSqlite),base=factory.getMockImplementation()!;
  expect(base).toBeTypeOf('function');let reached=false;
  factory.mockImplementation((...args)=>{
    const owner=base(...args);
    return {...owner,readWithClosureInputs:(...input)=>{
      reached=true;
      assertFoulTerminalPriorActivation(args[0],f.gameId,f.proposal.playId-1,f.proposal.playId);
      return owner.readWithClosureInputs(...input);
    }};
  });
  f.restore(()=>factory.mockImplementation(base));
  expect(()=>f.transaction(()=>withFoulTerminalOriginalScope(f.db,'later-terminal',f.gameId,f.proposal.playId+1,()=>f.activate())),
    'PRIOR_LIVE_CONSUMING_FRAME_NOT_SCOPED').not.toThrow();
  expect(reached).toBe(true);
}));
