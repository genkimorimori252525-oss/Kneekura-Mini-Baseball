import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { expect, it } from 'vitest';

it('shares the exact original field declarations without reaccepting the retained model or calibration', () => {
  const source = readFileSync(new URL('./SamePlateAppearancePhysicalFieldFixture.test-support.ts', import.meta.url), 'utf8');
  const seam = source.slice(source.indexOf('export const continuePhysicalFieldFixtureFromCalibration='));
  const appendBody = seam.slice(seam.indexOf('  const appendField='), seam.indexOf('\n  return{source,calibration,calibrationReference,model,appendField};'));
  const stepSeam = source.slice(source.indexOf('export const appendPhysicalFieldFixtureStep='));
  const stepBody = stepSeam.slice(stepSeam.indexOf('    if(!root.field.motion.cursor)'), stepSeam.indexOf('\n};'));
  const body = appendBody.replace('    return appendPhysicalFieldFixtureStep(h,resolution,root,rootReference,label);', stepBody);
  // Original appendField declarations before extraction, at src 58f6c35f.
  expect(createHash('sha256').update(body).digest('hex')).toBe('03cf42611cbf8e2b37394e84ffdb04c40c22733a3f80e05fd9ff9e542f1508fb');
  expect(source).toContain('return continuePhysicalFieldFixtureFromCalibration(h,calibration,label,options);');
  expect(seam).toContain('model=calibration.calibration.model');
  expect(seam).toContain('postureReference=source.postureReference,parameters=source.parameters');
  expect(seam).not.toMatch(/acceptModel\(|acceptFieldCalibration\(|prepareAction\(|acceptPosture\(|new DatabaseSync\(/);
});
