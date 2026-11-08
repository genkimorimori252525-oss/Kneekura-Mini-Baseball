import {cloneInert} from '../../core/adjudication/OfficialWindowPolicy';
import type {ReferenceBatKinematicsMotionV1} from '../../core/sim/contact/ReferenceBatKinematicsV1';

/** Explicit author calibration. These SI limits are independent of public
 * grades and of the certificate computed for an interpolated reference. */
export type SwingExecutionV122=Readonly<{version:'swing_execution_v122';sourceId:string;interpolation:'cubic-c1';
 maximumGripAccelerationMps2:number;maximumAngularAccelerationRadPerSecond2:number;maximumSweetSpotAccelerationMps2:number;
 maximumCorrectionMeters:number}>;
export function validateSwingExecutionV122(raw:unknown):SwingExecutionV122{
 const p=cloneInert(raw) as SwingExecutionV122;
 if(!p||typeof p!=='object'||Object.keys(p).sort().join('|')!==['version','sourceId','interpolation','maximumGripAccelerationMps2',
  'maximumAngularAccelerationRadPerSecond2','maximumSweetSpotAccelerationMps2','maximumCorrectionMeters'].sort().join('|')
  ||p.version!=='swing_execution_v122'||p.interpolation!=='cubic-c1'||typeof p.sourceId!=='string'||!p.sourceId.trim()||p.sourceId.length>200
  ||![p.maximumGripAccelerationMps2,p.maximumAngularAccelerationRadPerSecond2,p.maximumSweetSpotAccelerationMps2].every(n=>Number.isFinite(n)&&n>0&&n<=1e7)
  ||!Number.isFinite(p.maximumCorrectionMeters)||p.maximumCorrectionMeters<0||p.maximumCorrectionMeters>3)throw Error('スイング実行条件が不正です。加速度は0より大きく、修正距離は0〜3mで設定してください。');
 return Object.freeze(p);
}
export function referenceAccelerationBoundsV122(r:ReferenceBatKinematicsMotionV1){
 const {maximumGripAccelerationMps2:g,maximumAngularAccelerationRadPerSecond2:a,maximumSweetSpotAccelerationMps2:s}=r;
 if(![g,a,s].every(n=>n!==undefined&&Number.isFinite(n)&&n>=0))throw Error('C1 reference acceleration certificate is unavailable');
 return Object.freeze({maximumGripAccelerationMps2:g!,maximumAngularAccelerationRadPerSecond2:a!,maximumSweetSpotAccelerationMps2:s!});
}
/** Holding ramp duration fixed, every uncorrected derivative bound is a sum
 * of nonnegative linear/quadratic terms in playback rate. Scaling by the
 * bound ratio is conservative for both. No minimum speed is introduced. */
export function referenceRateScaleV122(r:ReferenceBatKinematicsMotionV1,p:SwingExecutionV122){
 const b=referenceAccelerationBoundsV122(r);
 return Math.min(1,p.maximumGripAccelerationMps2/Math.max(b.maximumGripAccelerationMps2,Number.MIN_VALUE),
  p.maximumAngularAccelerationRadPerSecond2/Math.max(b.maximumAngularAccelerationRadPerSecond2,Number.MIN_VALUE),
  p.maximumSweetSpotAccelerationMps2/Math.max(b.maximumSweetSpotAccelerationMps2,Number.MIN_VALUE));
}
