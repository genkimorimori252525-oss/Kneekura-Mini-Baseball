import { describe, expect, it } from 'vitest';
import {
  adoptFieldingActionAtTick,
  adoptRunnerControlAtTick,
  projectFieldingActionFrontier,
  projectRunnerActionFrontier,
} from './index';

describe('connected action scheduling public seam', () => {
  it('exports the four headless frontier/adoption operations', () => {
    expect(projectRunnerActionFrontier).toBeTypeOf('function');
    expect(adoptRunnerControlAtTick).toBeTypeOf('function');
    expect(projectFieldingActionFrontier).toBeTypeOf('function');
    expect(adoptFieldingActionAtTick).toBeTypeOf('function');
  });
});
