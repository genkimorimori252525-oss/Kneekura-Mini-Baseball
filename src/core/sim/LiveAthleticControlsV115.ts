/** Authored individual controls, not league-relative ratings or measured MLB constants. */
export const liveAthleticControlBoundsV115=Object.freeze({
 fieldJumpHeightMetersV115:[0,1.5],fieldDivePushMpsV115:[0,2],
 fieldDiveRecoverySecondsV115:[.1,5],fieldJumpRecoverySecondsV115:[.05,3],
 runSlideReachMetersV115:[.2,2],runHeadSlideExtraMetersV115:[0,.5],
 runSlideRecoverySecondsV115:[.1,3],runHeadSlideRecoverySecondsV115:[.1,3],
 runHeadSlidePreferenceV115:[0,1],runSlideFrictionScaleV115:[.25,3],
} as const);
export type LiveAthleticControlsV115=Readonly<Partial<Record<keyof typeof liveAthleticControlBoundsV115,number>>>;
export type LiveAthleticProfileV115=Readonly<{
 heightMeters:number;jumpHeightMeters:number;divePushMps:number;diveRecoverySeconds:number;jumpRecoverySeconds:number;
 slideReachMeters:number;headSlideExtraMeters:number;slideRecoverySeconds:number;headSlideRecoverySeconds:number;
 headSlidePreference:number;slideFrictionScale:number;
}>;
export function validateLiveAthleticControlsV115(c:LiveAthleticControlsV115):void{
 if(!c||typeof c!=='object'||Array.isArray(c))throw Error('athletic controls: object required');
 for(const [key,descriptor]of Object.entries(Object.getOwnPropertyDescriptors(c))){
  if(!Object.hasOwn(descriptor,'value'))throw Error('athletic controls: inert numbers required');
  const value=descriptor.value;
  const bounds=liveAthleticControlBoundsV115[key as keyof typeof liveAthleticControlBoundsV115];
  if(!bounds||!Number.isFinite(value)||value<bounds[0]||value>bounds[1])throw Error('athletic controls: invalid '+key);
 }
}
export function validateLiveAthleticProfileV115(p:LiveAthleticProfileV115):boolean{
 return !!p&&Object.values(p).every(Number.isFinite)&&p.heightMeters>=1.1&&p.heightMeters<=2.5
  &&p.jumpHeightMeters>=0&&p.jumpHeightMeters<=1.5&&p.divePushMps>=0&&p.divePushMps<=2
  &&p.diveRecoverySeconds>=.1&&p.diveRecoverySeconds<=5&&p.jumpRecoverySeconds>=.05&&p.jumpRecoverySeconds<=3
  &&p.slideReachMeters>=.2&&p.slideReachMeters<=2&&p.headSlideExtraMeters>=0&&p.headSlideExtraMeters<=.5
  &&p.slideRecoverySeconds>=.1&&p.slideRecoverySeconds<=3&&p.headSlideRecoverySeconds>=.1&&p.headSlideRecoverySeconds<=3
  &&p.headSlidePreference>=0&&p.headSlidePreference<=1&&p.slideFrictionScale>=.25&&p.slideFrictionScale<=3;
}
export function resolveLiveAthleticProfileV115(input:Readonly<{heightMeters:number;accelerationMps2:number;reactionSeconds:number;gloveSpeedMps:number;controls?:LiveAthleticControlsV115}>):LiveAthleticProfileV115{
 const {heightMeters:h,accelerationMps2:a,reactionSeconds:r,gloveSpeedMps:g}=input,c=input.controls??{};
 validateLiveAthleticControlsV115(c);
 if(![h,a,r,g].every(Number.isFinite)||h<1.1||h>2.5||a<=0||r<0||g<=0)throw Error('athletic profile: finite individual SI required');
 return Object.freeze({heightMeters:h,jumpHeightMeters:c.fieldJumpHeightMetersV115??h*.18,
  divePushMps:c.fieldDivePushMpsV115??Math.min(.4,a*.06),
  diveRecoverySeconds:c.fieldDiveRecoverySecondsV115??Math.min(5,.55+r*2+.2*8/g),
  jumpRecoverySeconds:c.fieldJumpRecoverySecondsV115??Math.min(3,.18+r),
  slideReachMeters:c.runSlideReachMetersV115??h*.48,headSlideExtraMeters:c.runHeadSlideExtraMetersV115??.05,
  slideRecoverySeconds:c.runSlideRecoverySecondsV115??Math.min(3,.45+r*.5),
  headSlideRecoverySeconds:c.runHeadSlideRecoverySecondsV115??Math.min(3,.6+r*.7),
  headSlidePreference:c.runHeadSlidePreferenceV115??.2,slideFrictionScale:c.runSlideFrictionScaleV115??1});
}
