import { cloneInert } from '../../core/adjudication/OfficialWindowPolicy';
import { multiplyQuaternions, normalizeQuaternion, quaternionFromAxisAngle } from '../../core/sim/pitching/BaseballOrientation';
import { validatePitchSnapshotV78, type PitchSnapshotV78 } from './LivePitchAuthoringV78';

/** Authoring operation on the initial material orientation only. The saved
 * world spin, force law, speed, provenance and V78 data schema are unchanged. */
export function rotatePitchMaterialPhaseV159(raw:Readonly<{pitch:PitchSnapshotV78;phaseDegrees:number}>):PitchSnapshotV78 {
  const input=cloneInert(raw);
  if(!input||typeof input!=='object'||Object.keys(input).sort().join('|')!=='phaseDegrees|pitch'||
    !Number.isFinite(input.phaseDegrees)||input.phaseDegrees< -360||input.phaseDegrees>360)
    throw Error('pitch material phase: explicit pitch and finite phase in [-360, 360] required');
  const pitch=validatePitchSnapshotV78(input.pitch),q=pitch.releaseOrientation,spin=pitch.spinRadPerSecond;
  if(q===undefined||Math.hypot(spin.x,spin.y,spin.z)===0)
    throw Error('pitch material phase: saved material orientation and nonzero spin required');
  if(input.phaseDegrees===0)return pitch;
  return validatePitchSnapshotV78({...pitch,releaseOrientation:normalizeQuaternion(multiplyQuaternions(
    quaternionFromAxisAngle(spin,input.phaseDegrees*Math.PI/180),q))});
}
