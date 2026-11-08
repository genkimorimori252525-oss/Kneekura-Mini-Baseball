/**
 * preContactSpeedLossV1: the sweet-spot speed of a bat that meets the ball before its clip's own contact moment.
 *
 * The measured clips are normalised so the speed at the clip's contact is the batter's target speed, but the samples just
 * before that moment run faster (median 1.09x at -5 ms and 1.15x at -10 ms of clip time, 1,042 contacts, 2026-11-06):
 * the recorded impact slowdown is smeared ahead of the contact. A ball met before the contact pose (a late swing,
 * deep contact) then left at up to impactSpeedLimitV1 x target, so deep contacts were the fastest in the game (78.7 mph
 * against MLB's 66.6 mph below 12 in behind the plate front, Statcast 2024 bat tracking).
 *
 * Here such a contact keeps the clip's pose and velocity direction, but its speed is the contact-moment speed less a
 * share per millisecond of swing time still to go, for a bat that is still gaining speed. 0.005/ms reproduces the
 * MLB bat speed by contact depth (66.8/69.3/70.9/71.7 mph against 66.6/69.1/71.1/72.2 for <-12/-12..-6/-6..0/0..6 in)
 * once the contact plane sits at the MLB depth. Never below half the contact speed.
 */
export function preContactSweetSpotSpeedV1(contactSpeedMps:number,secondsBeforeContact:number,lossPerMillisecond:number):number{
  if(!(Number.isFinite(contactSpeedMps)&&contactSpeedMps>=0)||!(Number.isFinite(secondsBeforeContact)&&secondsBeforeContact>=0)
    ||!(Number.isFinite(lossPerMillisecond)&&lossPerMillisecond>=0&&lossPerMillisecond<=.05))
    throw Error('invalid pre-contact speed input');
  return contactSpeedMps*Math.max(.5,1-lossPerMillisecond*secondsBeforeContact*1000);
}
