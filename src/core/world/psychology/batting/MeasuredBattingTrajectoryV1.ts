import type { Vec3 } from '../../../model/geometry';
import { cloneInert } from '../../../adjudication/OfficialWindowPolicy';
import { createMeasuredBatAxisReferenceV1, type MeasuredBatAxisReferenceInputV1 } from '../../../sim/contact/MeasuredBatAxisReferenceV1';
import { createReferenceBatKinematicsV1, type ReferenceBatKinematicsInputV1 } from '../../../sim/contact/ReferenceBatKinematicsV1';
import type { SwingKinematicsTrajectoryV1 } from '../../../sim/contact/SwingKinematicsV1';
import type { SwingKinematicsCourseProfileV1 } from '../../../sim/pitching/CourseAwareSwingKinematicsV1';
import { normalizeQuaternion, rotateVectorByQuaternion, type Quaternion } from '../../../sim/pitching/BaseballOrientation';

export const MEASURED_BATTING_REPERTOIRE_V1 = 'measured_bat_axis_repertoire_v1' as const;
export const MEASURED_BATTING_REPERTOIRE_UPRIGHT_V2 = 'measured_bat_axis_upright_repertoire_v2' as const;
/** Original registered metre coordinates and original source-clock keys. No
 * arbitrary caller transform, mirrored side, inferred torso or axial roll. */
export type MeasuredBattingProfileV1 = Readonly<{
  profileId: string; handedness: 'R' | 'L'; sourceImpactTick: number; playbackRate: number;
  measured: Omit<MeasuredBatAxisReferenceInputV1, 'startTick' | 'ticksPerSecond' | 'playbackRate' | 'transform'>;
}>;
const identity = (): Quaternion => ({x:0,y:0,z:0,w:1});
const zero = (): Vec3 => ({x:0,y:0,z:0});
const sub = (a:Vec3,b:Vec3):Vec3 => ({x:a.x-b.x,y:a.y-b.y,z:a.z-b.z});
const scale = (a:Vec3,s:number):Vec3 => ({x:a.x*s,y:a.y*s,z:a.z*s});
const dot = (a:Vec3,b:Vec3):number => a.x*b.x+a.y*b.y+a.z*b.z;
const cross = (a:Vec3,b:Vec3):Vec3 => ({x:a.y*b.z-a.z*b.y,y:a.z*b.x-a.x*b.z,z:a.x*b.y-a.y*b.x});
const norm = (a:Vec3):number => Math.hypot(a.x,a.y,a.z);
const fields = (v:unknown,ks:readonly string[]):boolean => !!v && typeof v==='object' && !Array.isArray(v)
  && Object.keys(v).sort().join('|')===[...ks].sort().join('|');
function assert(v:unknown,message:string):asserts v { if(!v)throw new Error('measured batting repertoire: '+message); }
const reference = (p:MeasuredBattingProfileV1) => createMeasuredBatAxisReferenceV1({...p.measured,
  startTick:0,ticksPerSecond:p.measured.sourceTicksPerSecond,playbackRate:1,
  transform:{rotation:identity(),translation:zero(),scale:1}}).reference;

/** Called by both accepted model owners and pure calculation boundaries. Legacy
 * repertoires must omit the extension; the new version must provide every row. */
export function assertMeasuredBattingRepertoireV1(raw: Readonly<{
  repertoireVersion:string; profiles:readonly Readonly<{profile:SwingKinematicsCourseProfileV1}>[];
  sampledProfiles?:readonly MeasuredBattingProfileV1[];
}>):void {
  const r=cloneInert(raw);
  if(r.repertoireVersion!==MEASURED_BATTING_REPERTOIRE_V1&&r.repertoireVersion!==MEASURED_BATTING_REPERTOIRE_UPRIGHT_V2){
    assert(!Object.hasOwn(r,'sampledProfiles'),'sampled profiles require their own version');return;
  }
  assert(Array.isArray(r.sampledProfiles)&&r.sampledProfiles.length===r.profiles.length,'missing measured profiles');
  const ids=new Set<string>();
  for(const p of r.sampledProfiles){
    assert(fields(p,['profileId','handedness','sourceImpactTick','playbackRate','measured'])
      &&typeof p.profileId==='string'&&p.profileId.trim()===p.profileId&&!ids.has(p.profileId)
      &&(p.handedness==='R'||p.handedness==='L')&&Number.isSafeInteger(p.sourceImpactTick)
      &&Number.isFinite(p.playbackRate)&&p.playbackRate>=.01&&p.playbackRate<=20,'invalid measured profile');
    assert(fields(p.measured,['provenance','frames','batLengthM','sweetSpotFromTipM','handReferenceFromKnobM',
      'maximumHandResidualM','sourceTicksPerSecond']),'invalid measured source fields');
    const original=reference(p),course=r.profiles.find(x=>x.profile.profileId===p.profileId)?.profile;
    assert(course&&course.batLengthM===original.batLengthM&&course.sweetSpotT===original.sweetSpotT,
      'course and measured bat geometry differ');
    assert(p.sourceImpactTick>original.frames[0].tick&&p.sourceImpactTick<original.frames.at(-1)!.tick,
      'impact phase must be inside the original measured interval');
    ids.add(p.profileId);
  }
}

/** Exact decimal rate arithmetic for the discrete commitment clock. This is
 * not a rounding allowance: an unrepresentable impact phase is rejected. */
function impactElapsedTicks(p:MeasuredBattingProfileV1,ticksPerSecond:number):number {
  const rate=String(p.playbackRate),parts=rate.split('.'),denominator=10n**BigInt(parts[1]?.length??0);
  const numerator=BigInt(parts.join(''));
  const top=BigInt(p.sourceImpactTick-p.measured.frames[0].tick)*BigInt(ticksPerSecond)*denominator;
  const bottom=BigInt(p.measured.sourceTicksPerSecond)*numerator;
  assert(top%bottom===0n,'impact phase is not representable on the world clock');
  const ticks=Number(top/bottom);assert(Number.isSafeInteger(ticks)&&ticks>0,'impact clock overflow');return ticks;
}
function turn(from:Vec3,to:Vec3):Quaternion {
  const a=scale(from,1/norm(from)),b=scale(to,1/norm(to)),cosine=Math.max(-1,Math.min(1,dot(a,b))),axis=cross(a,b),sine=norm(axis);
  if(sine>1e-12){const half=Math.atan2(sine,cosine)/2;return normalizeQuaternion({...scale(axis,Math.sin(half)/sine),w:Math.cos(half)});}
  if(cosine>=0)return identity();
  // An explicitly deterministic proper half-turn, never a handedness mirror.
  const perpendicular=cross(a,Math.abs(a.x)<.9?{x:1,y:0,z:0}:{x:0,y:1,z:0});
  return {...scale(perpendicular,1/norm(perpendicular)),w:0};
}

/** The course planner supplies perceived aim and contact time only. A single
 * rigid registration moves the entire measured curve; no per-key retargeting,
 * speed matching, actual-flight input or guaranteed-contact correction exists. */
export function planMeasuredBattingTrajectoryV1(p:MeasuredBattingProfileV1,handedness:'R'|'L',
  intended:SwingKinematicsTrajectoryV1,registration:'legacy_axis_v1'|'upright_yaw_v2'='legacy_axis_v1'):ReferenceBatKinematicsInputV1 {
  assert(registration==='legacy_axis_v1'||registration==='upright_yaw_v2','unknown registration');
  assert(p.handedness===handedness,'recorded side differs from batter side');
  const original=reference(p),elapsed=impactElapsedTicks(p,intended.ticksPerSecond);
  const startTick=intended.contactTick-elapsed;
  assert(Number.isSafeInteger(startTick)&&startTick>=0,'measured onset precedes the world clock');
  const measured=createReferenceBatKinematicsV1(original).sample(p.sourceImpactTick-original.frames[0].tick);
  const axis=sub(measured.state.pose.tip,measured.state.pose.grip),target=intended.contact.batAxis;
  let rotation:Quaternion;
  if(registration==='upright_yaw_v2'){
    // The measured capture already shares world +Y (gravity). Preserve that
    // registration and its attack plane; matching the legacy axis's vertical
    // component could overturn the entire recorded swing. A vertical axis
    // has no defined horizontal heading and requires another measured clip.
    const from=measured.sweetSpotVelocity,to=intended.contact.sweetSpotVelocity;
    assert(Math.hypot(from.x,from.z)>1e-12&&Math.hypot(to.x,to.z)>1e-12,'undefined upright heading');
    // A bat axis alone admits an upside-down / backwards swing plane. Align
    // the measured direction of motion instead, retaining gravity and the
    // recorded grip-to-barrel side. Source axes are already registered.
    const yaw=Math.atan2(from.z*to.x-from.x*to.z,from.x*to.x+from.z*to.z);
    rotation={x:0,y:Math.sin(yaw/2),z:0,w:Math.cos(yaw/2)};
  }else rotation=turn(axis,target);
  const translation=sub(intended.contact.sweetSpotPosition,rotateVectorByQuaternion(measured.sweetSpot,rotation));
  const planned={...original,startTick,ticksPerSecond:intended.ticksPerSecond,playbackRate:p.playbackRate,
    transform:{rotation,translation,scale:1}};
  createReferenceBatKinematicsV1(planned);return planned;
}
