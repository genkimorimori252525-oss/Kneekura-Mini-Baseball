import { cloneInert } from '../../core/adjudication/OfficialWindowPolicy';
import { actorHash as hash,actorJson as json,actorFreeze as freeze } from './PhysicalPlateAppearanceActorEvidenceFromSqlite';
import { renewalAdoptionInput,renewalEnrollmentInput,renewalMotorInput,renewalExactCut,assertRenewalCut,type RenewalAdoptionExecutionSource,type RenewalCut } from './ActualReceivedUmpireRenewal';
import type { DurableReceivedRenewalEnrollment } from './ActualReceivedUmpireRenewalEvidence';
import type { DurableReceivedRenewalMotor } from './SqliteActualReceivedUmpireRenewalMotorStore';
import type { AcceptedBattedWorldMotion } from './SqliteBattedWorldMotionStore';
import type { ReceivedRenewalMotorReceipt } from './ActualReceivedUmpireRenewalMotor';
import type { ActualPlayerKinematics,ActualPlayerOwnedMotionCoverage } from './ActualPlayerKinematicsFromPrefix';
export type RenewalParticipantBinding=Pick<ActualPlayerKinematics,'playerId'|'personId'|'personLinkSourceId'|'gameId'|'gameDay'>;
const roles=['glove','body','tag_hand','left_foot','right_foot'] as const;
const tick=(n:number)=>Number.isSafeInteger(n)&&n>=0;
/** Pure composition of freshly authenticated Native facts. The physical owner
 * supplies the original ten bindings and bounded selves, never a caller command. */
export const deriveReceivedRenewalComposition=(raw:RenewalAdoptionExecutionSource,enrollment:DurableReceivedRenewalEnrollment,motor:DurableReceivedRenewalMotor,
  selves:readonly ActualPlayerKinematics[],bindings:readonly RenewalParticipantBinding[],actualCut:RenewalCut):ReceivedRenewalComposition=>{
  const source=renewalAdoptionInput(raw),e=cloneInert(enrollment),m=cloneInert(motor),players=cloneInert(selves),original=cloneInert(bindings);
  renewalEnrollmentInput(e.source);renewalMotorInput(m.source);assertRenewalCut(e.cut,actualCut);
  if(source.action.renewalEnrollmentSourceId!==e.source.sourceId||source.action.renewalMotorSourceId!==m.source.sourceId
    ||source.baseFieldSourceId!==e.anchor.baseField.sourceId||source.previousExecutionSourceId!==e.anchor.physicalPredecessor.sourceId
    ||m.source.renewalEnrollmentSourceId!==e.source.sourceId||m.renewalEnrollmentSourceId!==e.source.sourceId||m.enrollmentHash!==hash(e)
    ||m.gameId!==e.gameId||m.playId!==e.playId||m.physicalPitchSourceId!==e.physicalPitchSourceId||m.playerId!==e.playerId)throw new Error('received renewal composition motor or predecessor binding differs');
  if(original.length!==10||players.length!==10||new Set(original.map(b=>b.playerId)).size!==10||new Set(players.map(s=>s.playerId)).size!==10
    ||e.anchor.participants.length!==10||new Set(e.anchor.participants.map(p=>p.playerId)).size!==10)throw new Error('received renewal composition requires ten original participants');
  const receiver=players.find(s=>s.playerId===e.playerId);
  if(!receiver||json(m.receipt.self)!==json(receiver)||hash(receiver)!==e.anchor.selfHash||m.receipt.lifecycle.status!=='adoption_pending'
    ||m.receipt.movementStartTick!==e.cut.tick||m.receipt.segment.startTick!==e.cut.tick||m.receipt.segment.endTick!==m.receipt.coverageEndTick)throw new Error('received renewal composition motor self or exact segment differs');
  for(const at of [m.receipt.startAt,m.receipt.issuedAt])assertRenewalCut(e.cut,renewalExactCut(at,m.receipt.ticksPerSecond));
  const contributors=original.map(binding=>{
    const self=players.find(s=>s.playerId===binding.playerId),anchor=e.anchor.participants.find(p=>p.playerId===binding.playerId);
    if(!self||!anchor||self.personId!==binding.personId||self.personLinkSourceId!==binding.personLinkSourceId||self.gameId!==binding.gameId
      ||self.gameId!==e.gameId||self.gameDay!==binding.gameDay||self.physicalPitchSourceId!==e.physicalPitchSourceId||anchor.personId!==self.personId
      ||anchor.selfHash!==hash(self)||anchor.activeCommandHash!==hash(self.activeCommand))throw new Error('received renewal composition participant Player/Person basis differs');
    assertRenewalCut(e.cut,renewalExactCut(self.at,self.ticksPerSecond));
    const coverage=self.ownedMotionCoverage;
    if(!coverage||self.roles.length!==5||new Set(self.roles.map(p=>p.role)).size!==5||self.roles.some(p=>!roles.includes(p.role))
      ||coverage.roleAuthorities.length!==5||new Set(coverage.roleAuthorities.map(p=>p.role)).size!==5||coverage.roleAuthorities.some(p=>!roles.includes(p.role))
      ||hash(coverage.roleAuthorities)!==anchor.roleAuthoritiesHash)throw new Error('received renewal composition requires each owned role authority');
    if(!tick(coverage.physicalThroughTick)||coverage.physicalThroughTick<e.cut.tick||!tick(coverage.rootAuthority.acceptedThroughTick)
      ||coverage.rootAuthority.acceptedThroughTick<e.cut.tick||!tick(self.activeCommand.acceptedThroughTick)||self.activeCommand.acceptedThroughTick<e.cut.tick)throw new Error('received renewal composition current coverage is exhausted');
    const retainedRoles=self.roles.map(p=>{
      const a=coverage.roleAuthorities.find(a=>a.role===p.role)!;
      if(p.canonicalActor.playerId!==self.playerId||p.canonicalActor.primitive.role!==p.role||p.canonicalActor.primitive.radius!==p.radiusMeters
        ||p.canonicalActor.primitive.ticksPerSecond!==self.ticksPerSecond||p.canonicalActor.primitive.endTick!==coverage.physicalThroughTick
        ||!tick(a.acceptedThroughTick)||a.acceptedThroughTick<=e.cut.tick||!tick(a.command.acceptedThroughTick)||a.acceptedThroughTick>a.command.acceptedThroughTick)throw new Error('received renewal composition retained role coverage differs');
      if(Object.values(p.canonicalRoundingResidual.acceleration).some(v=>v!==0)||json(p.relativeAcceleration)!==json(p.declaredPose.relativeAcceleration))throw new Error('received renewal composition acceleration residual is unsupported');
      return {role:p.role,radiusMeters:p.radiusMeters,command:a.command,acceptedThroughTick:a.acceptedThroughTick,offsetAcceleration:p.declaredPose.relativeAcceleration};
    });
    const selected=self.playerId===e.playerId;
    if(selected&&json(retainedRoles)!==json(m.receipt.retainedRoles))throw new Error('received renewal motor retained role basis differs');
    const retained={playerId:self.playerId,bodyAcceleration:self.root.acceleration,primitiveMotions:retainedRoles.map(p=>({role:p.role,offsetAcceleration:p.offsetAcceleration}))};
    const coverageThroughTick=Math.min(selected?m.receipt.coverageEndTick:Math.min(coverage.rootAuthority.acceptedThroughTick,self.activeCommand.acceptedThroughTick),...retainedRoles.map(p=>p.acceptedThroughTick));
    if(!tick(coverageThroughTick)||coverageThroughTick<=e.cut.tick)throw new Error('received renewal composition cannot renew another Players exhausted coverage');
    return {playerId:self.playerId,personId:self.personId,selfHash:hash(self),at:self.at,kind:selected?'renewal_motor' as const:'retained' as const,
      motorSourceId:selected?m.source.sourceId:null,motorHash:selected?hash(m):null,
      rootAuthority:selected?{owner:'actual_received_umpire_renewal_motors' as const,sourceId:m.source.sourceId,sourceHash:hash(m.source),adoptionOwner:'batted_world_field_executions' as const,
        adoptionSourceId:source.sourceId,adoptionSourceHash:hash(source),acceptedThroughTick:m.receipt.coverageEndTick}:coverage.rootAuthority,
      roleAuthorities:coverage.roleAuthorities,retainedCommand:self.activeCommand,retainedRoles,command:selected?m.receipt.command:retained,coverageThroughTick};
  });
  return freeze({version:'received_renewal_adoption_composition_v1' as const,physicalPitchSourceId:e.physicalPitchSourceId,renewalEnrollmentSourceId:e.source.sourceId,
    renewalDecisionSourceId:m.source.renewalDecisionSourceId,renewalMotorSourceId:m.source.sourceId,originProcessSourceId:e.originProcessSourceId,
    at:{originTick:e.cut.originTick,elapsedSeconds:e.cut.elapsedSeconds,tick:e.cut.tick},ticksPerSecond:e.cut.ticksPerSecond,
    coverageThroughTick:Math.min(...contributors.map(p=>p.coverageThroughTick)),contributors,commands:contributors.map(p=>p.command),sourceCoverage:'received_receiver_only_v1' as const});
};
export type ReceivedRenewalComposition=Readonly<{
  version:'received_renewal_adoption_composition_v1';physicalPitchSourceId:string;renewalEnrollmentSourceId:string;renewalDecisionSourceId:string;renewalMotorSourceId:string;originProcessSourceId:string;
  at:ActualPlayerKinematics['at'];ticksPerSecond:number;coverageThroughTick:number;sourceCoverage:'received_receiver_only_v1';commands:AcceptedBattedWorldMotion['commands'];
  contributors:readonly Readonly<{playerId:string;personId:string;selfHash:string;at:ActualPlayerKinematics['at'];kind:'renewal_motor'|'retained';motorSourceId:string|null;motorHash:string|null;
    rootAuthority:ActualPlayerOwnedMotionCoverage['rootAuthority'];roleAuthorities:ActualPlayerOwnedMotionCoverage['roleAuthorities'];retainedCommand:ActualPlayerKinematics['activeCommand'];
    retainedRoles:ReceivedRenewalMotorReceipt['retainedRoles'];command:AcceptedBattedWorldMotion['commands'][number];coverageThroughTick:number}>[];
}>;
