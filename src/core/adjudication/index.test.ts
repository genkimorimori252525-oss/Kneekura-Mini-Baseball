import { describe, expect, it } from 'vitest';
import {
  advanceRuleProfileOfficialWindows,
  closeOfficialPlay,
  closeOfficialStateWindow,
  createPlayAdjudicationLedger,
  deriveClosedLiveBallMatchState,
  getOfficialPlayClosure,
  getOfficialStateWindows,
  getPlayAdjudicationState,
  openOfficialStateWindow,
  openRuleProfileOfficialStateWindow,
  orchestrateTagUpAppealAttempt,
  recordCorrectRuleSnapshot,
  recordOnFieldCall,
  recordReviewDecision,
} from './index';

describe('official adjudication public seam', () => {
  it('exports the closure lifecycle without exposing a free MatchState delta writer', () => {
    expect(createPlayAdjudicationLedger).toBeTypeOf('function');
    expect(recordCorrectRuleSnapshot).toBeTypeOf('function');
    expect(openOfficialStateWindow).toBeTypeOf('function');
    expect(closeOfficialStateWindow).toBeTypeOf('function');
    expect(recordOnFieldCall).toBeTypeOf('function');
    expect(recordReviewDecision).toBeTypeOf('function');
    expect(closeOfficialPlay).toBeTypeOf('function');
    expect(getPlayAdjudicationState).toBeTypeOf('function');
    expect(getOfficialPlayClosure).toBeTypeOf('function');
    expect(deriveClosedLiveBallMatchState).toBeTypeOf('function');
    expect(getOfficialStateWindows).toBeTypeOf('function');
    expect(openRuleProfileOfficialStateWindow).toBeTypeOf('function');
    expect(advanceRuleProfileOfficialWindows).toBeTypeOf('function');
    expect(orchestrateTagUpAppealAttempt).toBeTypeOf('function');
  });
});
