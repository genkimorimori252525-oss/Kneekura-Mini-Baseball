import { readFileSync } from 'node:fs';
import type { MeasuredBattingProfileV1 } from './MeasuredBattingTrajectoryV1';
import { MEASURED_BATTING_REPERTOIRE_V1 } from './MeasuredBattingTrajectoryV1';
import { fixture, flight } from './BattingFixtures.test-support';
import type { BattingRepertoireValues } from './BattingTypes';

type Clip=Readonly<{id:string;side:'R'|'L';contactTimeSeconds:number;source:{sha256:string};
  normalization:{batLengthM:number;sweetSpotT:number};
  measurements:MeasuredBattingProfileV1['measured']['frames'];
  binding:{sweetSpotFromTipM:number;handReferenceFromKnobM:number;maximumHandResidualM:number}}>;
export const measuredClips=(JSON.parse(readFileSync(new URL('../../../../../docs/demos/measured-bat-motions.json',import.meta.url),'utf8')) as {clips:Clip[]}).clips;
export function measuredRepertoire(index=0):BattingRepertoireValues {
  const c=measuredClips[index],base=fixture().source.profiles[0].profile;
  return {repertoireId:'measured-test-repertoire',repertoireVersion:MEASURED_BATTING_REPERTOIRE_V1,
    profiles:[{minimumAggression:0,profile:{...base,batLengthM:c.normalization.batLengthM,sweetSpotT:c.normalization.sweetSpotT}}],
    sampledProfiles:[{profileId:base.profileId,handedness:c.side,sourceImpactTick:Math.round(c.contactTimeSeconds*1_000_000),playbackRate:1,
      measured:{provenance:{clipId:c.id,sourceSha256:c.source.sha256},frames:structuredClone(c.measurements),
        batLengthM:c.normalization.batLengthM,sweetSpotFromTipM:c.binding.sweetSpotFromTipM,
        handReferenceFromKnobM:c.binding.handReferenceFromKnobM,maximumHandResidualM:c.binding.maximumHandResidualM,
        sourceTicksPerSecond:1_000_000}}]};
}
/** Synthetic pitch duration allows the complete recorded takeback. Neither the
 * pitch nor capability ceiling below is an empirical athlete assessment. */
export function measuredFixture(index=0) {
  const r=fixture();Object.assign(r.source,measuredRepertoire(index),{handedness:measuredClips[index].side});
  r.source.predictions.forEach(p=>Object.assign(p.trajectory.start.position,{z:27}));return r;
}
export function measuredActual(){const f=flight();Object.assign(f.start.position,{z:27});return f;}
