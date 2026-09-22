import { describe, expect, it } from 'vitest';
import {
  closeOfficialPlay,
  closeOfficialStateWindow,
  createPlayAdjudicationLedger,
  deriveClosedLiveBallMatchState,
  getOfficialPlayClosure,
  getPlayAdjudicationState,
  openOfficialStateWindow,
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
  });
});
