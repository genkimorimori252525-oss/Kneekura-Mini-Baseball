import { createRequire } from 'node:module';
import type { DatabaseSync } from 'node:sqlite';
import { cloneInert } from '../../core/adjudication/OfficialWindowPolicy';
import { projectSpinControlMasteryV123, SPIN_TECHNIQUES_V123, type SpinMasteryPolicyV123, type SpinTechniqueV123 } from '../../core/world/traits/SpinControlMasteryV123';
import { assessSpinMotorProfilesV123, type SpinMotorQualificationInputV123 } from '../../core/world/traits/SpinMotorQualificationV123';
import { readNativeDevelopmentPracticeExposureFromSqlite } from './SqliteDevelopmentPracticeExposureStore';
import { readNativeStandaloneBattingContactV123 } from './SqliteStandalonePracticeStore';
import { playerPersonLinkEvidenceFromSqlite } from './SqlitePlayerPersonLinkStore';
import { withBodyCompositionTransaction, bodyCompositionTableInstalled } from './BodyMaterializationSqliteOwnership';
import { nonPitchFields as fields, nonPitchId as id } from './NonPitchDevelopmentRepetition';
import { defensiveMetadataId as claim } from './ActualDefensiveMetadata';
import { actorJson as json, actorHash as hash, actorFreeze as freeze } from './PhysicalPlateAppearanceActorEvidenceFromSqlite';
import {withNativeDevelopmentReadPhaseV126} from './NativeDevelopmentReadPhaseV126';
import type { MeasuredPracticeMotorBindingV133 } from './StandaloneMeasuredPracticeV133';

type Ref = Readonly<{ sourceId: string; sourceVersion: string }>;
type PinnedRef = Ref & Readonly<{ sourceHash: string; snapshotHash: string }>;
export type AcceptedSpinMasteryCalibrationV123 = Ref & Readonly<{ acceptedAtDay: number; technique: SpinTechniqueV123;
  /** Minimums apply to every bound original motor profile, not pooled success. */
  status: 'MODEL_VERIFIED' | 'UNVERIFIED'; minimumIntentionalContacts: number; minimumDirectionalSpinRadPerSecond: number;
  minimumSuccessFraction: number }>;
export type AcceptedSpinMasteryV123 = Ref & Readonly<{ sourceEffectIdentity: string; careerId: string; playerId: string;
  personLinkSourceId: string; acceptedAtDay: number; technique: SpinTechniqueV123; exposureRef: PinnedRef;
  repertoireRef: Ref; calibrationRef: Ref; distinctiveness: number; policy: SpinMasteryPolicyV123 }>;
export type SpinMasteryAuthorityV123 = Readonly<{
  readAcceptedMastery(sourceId: string): AcceptedSpinMasteryV123 | null;
  readAcceptedCalibration(sourceId: string): AcceptedSpinMasteryCalibrationV123 | null;
}>;
const day = (v: unknown): v is number => typeof v === 'number' && Number.isSafeInteger(v) && v >= 0;
const unit = (v: number) => Number.isFinite(v) && v >= 0 && v <= 1;
const ref = (v: Ref) => fields(v, ['sourceId', 'sourceVersion']) && Object.values(v).every(id);
const sourceInput = (raw: unknown, sourceId: string): AcceptedSpinMasteryV123 => {
  const s = cloneInert(raw) as AcceptedSpinMasteryV123;
  if (!fields(s, ['sourceId', 'sourceVersion', 'sourceEffectIdentity', 'careerId', 'playerId', 'personLinkSourceId', 'acceptedAtDay',
    'technique', 'exposureRef', 'repertoireRef', 'calibrationRef', 'distinctiveness', 'policy']) || s.sourceId !== sourceId
    || ![s.sourceId, s.sourceVersion, s.sourceEffectIdentity, s.careerId, s.playerId, s.personLinkSourceId].every(id)
    || !day(s.acceptedAtDay) || !SPIN_TECHNIQUES_V123.includes(s.technique) || !ref(s.repertoireRef) || !ref(s.calibrationRef)
    || !fields(s.exposureRef, ['sourceId', 'sourceVersion', 'sourceHash', 'snapshotHash'])
    || ![s.exposureRef.sourceId, s.exposureRef.sourceVersion].every(id)
    || ![s.exposureRef.sourceHash, s.exposureRef.snapshotHash].every(v => typeof v === 'string' && /^[a-f0-9]{64}$/.test(v))
    || !unit(s.distinctiveness)) throw Error('invalid accepted intentional spin mastery Source');
  return freeze(s);
};
const calibrationInput = (raw: unknown): AcceptedSpinMasteryCalibrationV123 => {
  const c = cloneInert(raw) as AcceptedSpinMasteryCalibrationV123;
  if (!fields(c, ['sourceId', 'sourceVersion', 'acceptedAtDay', 'technique', 'status', 'minimumIntentionalContacts',
    'minimumDirectionalSpinRadPerSecond', 'minimumSuccessFraction']) || ![c.sourceId, c.sourceVersion].every(id)
    || !day(c.acceptedAtDay) || !SPIN_TECHNIQUES_V123.includes(c.technique) || !['MODEL_VERIFIED', 'UNVERIFIED'].includes(c.status)
    || !Number.isSafeInteger(c.minimumIntentionalContacts) || c.minimumIntentionalContacts < 1
    || !Number.isFinite(c.minimumDirectionalSpinRadPerSecond) || c.minimumDirectionalSpinRadPerSecond <= 0
    || !unit(c.minimumSuccessFraction) || c.minimumSuccessFraction === 0) throw Error('invalid explicit spin mastery calibration');
  return freeze(c);
};
/** Identity alone may never pool different actual implementations. Called only
 * with re-executed original Native contacts; the pure regression uses explicit
 * synthetic inputs and does not substitute for Native admission. */
export const qualifySpinMotorGroupsV133 = (input: Omit<SpinMotorQualificationInputV123, 'contacts'> & Readonly<{
  contacts: readonly (SpinMotorQualificationInputV123['contacts'][number] & Readonly<{ motorBindingV133?: MeasuredPracticeMotorBindingV133 }>)[];
}>) => {
  const plain = (contacts: typeof input.contacts) => contacts.map(({ motorBindingV133: _binding, ...contact }) => contact);
  if (!input.contacts.some(c => c.motorBindingV133)) return { motorQualification: assessSpinMotorProfilesV123({ ...input, contacts: plain(input.contacts) }) };
  const groups = new Map<string, typeof input.contacts[number][]>();
  for (const contact of input.contacts) {
    const key = json([contact.profileRef, contact.motorBindingV133 ?? null]);
    const group = groups.get(key) ?? []; group.push(contact); groups.set(key, group);
  }
  const motorBindingsV133: MeasuredPracticeMotorBindingV133[] = [], courseMotorProfileRefsV133: { profileId: string; version: string }[] = [];
  const qualified = new Map<string, { profileId: string; version: string }>();
  const rejected: ReturnType<typeof assessSpinMotorProfilesV123>['rejectedProfiles'][number][] = [];
  let successfulContacts = 0;
  for (const [, contacts] of [...groups].sort(([a], [b]) => a < b ? -1 : a > b ? 1 : 0)) {
    const result = assessSpinMotorProfilesV123({ ...input, contacts: plain(contacts) });
    successfulContacts += result.successfulContacts; rejected.push(...result.rejectedProfiles);
    for (const r of result.qualifiedProfiles) qualified.set(json(r), r);
    if (result.qualifiedProfiles.length) {
      if (contacts[0].motorBindingV133) motorBindingsV133.push(contacts[0].motorBindingV133);
      else courseMotorProfileRefsV133.push(contacts[0].profileRef);
    }
  }
  return { motorQualification: { qualifiedProfiles: [...qualified.values()].sort((a, b) => json(a).localeCompare(json(b))),
    rejectedProfiles: rejected, totalContacts: input.contacts.length, successfulContacts }, motorBindingsV133, courseMotorProfileRefsV133 };
};
const derive = (db: DatabaseSync, source: AcceptedSpinMasteryV123, calibration: AcceptedSpinMasteryCalibrationV123) => withNativeDevelopmentReadPhaseV126(db,()=>{
  const person = playerPersonLinkEvidenceFromSqlite(db).readLink(source.personLinkSourceId);
  if (!person || person.careerId !== source.careerId || person.playerId !== source.playerId || person.acceptedAtDay > source.acceptedAtDay) {
    throw Error('spin mastery original Player/Person link differs');
  }
  if (calibration.sourceId !== source.calibrationRef.sourceId || calibration.sourceVersion !== source.calibrationRef.sourceVersion
    || calibration.acceptedAtDay > source.acceptedAtDay || calibration.status !== 'MODEL_VERIFIED' || calibration.technique !== source.technique) {
    throw Error('spin mastery calibration is unverified, future or for another technique');
  }
  const exposure = readNativeDevelopmentPracticeExposureFromSqlite(db, source.exposureRef.sourceId);
  if (!exposure || exposure.source.sourceVersion !== source.exposureRef.sourceVersion || hash(exposure.source) !== source.exposureRef.sourceHash
    || hash(exposure) !== source.exposureRef.snapshotHash || exposure.episode.careerId !== source.careerId
    || exposure.episode.playerId !== source.playerId || exposure.episode.effectiveDay > source.acceptedAtDay) throw Error('spin mastery original exposure differs');
  const contacts = exposure.episode.practiceSourceEventIds.map(eventId => {
    const c = readNativeStandaloneBattingContactV123(db, eventId);
    if (c.careerId !== source.careerId || c.playerId !== source.playerId || c.personLinkSourceId !== source.personLinkSourceId
      || c.episodeId !== exposure.episode.episodeId || json(c.repertoireRef) !== json(source.repertoireRef)
      || c.spinIntentV123?.technique !== source.technique) throw Error('spin mastery practice intent or original repertoire differs');
    return c;
  });
  const grouped = qualifySpinMotorGroupsV133({ technique: source.technique,
    minimumIntentionalContacts: calibration.minimumIntentionalContacts,
    minimumDirectionalSpinRadPerSecond: calibration.minimumDirectionalSpinRadPerSecond,
    minimumSuccessFraction: calibration.minimumSuccessFraction,
    contacts: contacts.map(c => ({ profileRef: c.profileRef, velocityMps: c.observation.velocityMps,
      spinRadPerSecond: c.observation.spinRadPerSecond, bats: c.observation.bats,
      ...(c.motorBindingV133 ? { motorBindingV133: c.motorBindingV133 } : {}) })) });
  const { motorQualification } = grouped;
  const successful = motorQualification.successfulContacts;
  if (contacts.length < calibration.minimumIntentionalContacts || !grouped.motorBindingsV133 && successful / contacts.length < calibration.minimumSuccessFraction
    || !motorQualification.qualifiedProfiles.length) {
    throw Error('spin mastery has insufficient actual directional contacts');
  }
  const projection = projectSpinControlMasteryV123({ scope: { careerId: source.careerId, playerId: source.playerId }, atDay: source.acceptedAtDay,
    policy: source.policy, proofs: [{ technique: source.technique, sourceId: source.sourceId, sourceVersion: source.sourceVersion,
      sourceEffectIdentity: source.sourceEffectIdentity, acceptedAtDay: source.acceptedAtDay, episode: exposure.episode, bundle: exposure.bundle,
      distinctiveness: source.distinctiveness, repertoireRef: source.repertoireRef,
      calibration: { ...source.calibrationRef, status: calibration.status } }] });
  if (projection.qualified.length !== 1) throw Error('spin mastery does not meet the explicit consolidated qualification policy');
  const motorProfileRefs = motorQualification.qualifiedProfiles;
  return freeze({ boundary: 'NATIVE_SPIN_MASTERY_QUALIFICATION' as const, nativeAdmission: true as const,
    source, calibration, person, projection, motorProfileRefs, motorQualification, successfulContacts: successful,
    ...(grouped.motorBindingsV133 ? { motorBindingsV133: grouped.motorBindingsV133, courseMotorProfileRefsV133: grouped.courseMotorProfileRefsV133 } : {}),
    contacts: contacts.map(c => ({ eventId: c.event.sourceEventId, proofHash: c.proofHash, sourceRef: c.sourceRef,
      profileRef: c.profileRef, observation: c.observation, ...(c.motorBindingV133 ? { motorBindingV133: c.motorBindingV133 } : {}) })) });
});
export type DurableSpinMasteryV123 = ReturnType<typeof derive>;
type Row = { source_id: string; career_id: string; player_id: string; technique: SpinTechniqueV123; accepted_at_day: number;
  source_json: string; source_hash: string; calibration_json: string; snapshot_json: string; snapshot_hash: string };

const readArchived = (db: DatabaseSync, sourceId: string): DurableSpinMasteryV123 | null => {
  if (!id(sourceId)) throw Error('invalid intentional spin mastery identity');
  if (!bodyCompositionTableInstalled(db, 'world_spin_mastery_v123')) return null;
  const rows = db.prepare(`SELECT * FROM main.world_spin_mastery_v123 WHERE source_id=$id
    OR ${claim('source_json', ['sourceId'], '$id')} OR ${claim('snapshot_json', ['source', 'sourceId'], '$id')}`).all({ id: sourceId }) as Row[];
  if (rows.length > 1 || rows.length === 1 && rows[0].source_id !== sourceId) throw Error('spin mastery Source ownership differs');
  const row = rows[0]; if (!row) return null;
  const source = sourceInput(JSON.parse(row.source_json), sourceId), calibration = calibrationInput(JSON.parse(row.calibration_json));
  if (row.career_id !== source.careerId || row.player_id !== source.playerId || row.technique !== source.technique
    || row.accepted_at_day !== source.acceptedAtDay || row.source_json !== json(source) || row.source_hash !== hash(source)
    || row.calibration_json !== json(calibration)) throw Error('spin mastery original Source archive differs');
  const value = derive(db, source, calibration);
  if (row.snapshot_json !== json(value) || row.snapshot_hash !== hash(value)) throw Error('spin mastery original qualification archive differs');
  return value;
};
/** The physical owner joins a fixed qualification on its OWN Native snapshot.
 * No writer handle, second connection or caller-supplied receipt substitutes
 * for the original archived practice. Missing installation is pending data. */
export const readNativeSpinControlMasteryV123 = (db: DatabaseSync, sourceId: string): DurableSpinMasteryV123 | null => {
  const { DatabaseSync: Native } = createRequire(import.meta.url)('node:sqlite') as typeof import('node:sqlite');
  if (!(db instanceof Native) || !db.isTransaction) throw Error('spin mastery requires an active original snapshot');
  return withBodyCompositionTransaction(db, false, () => readArchived(db, sourceId));
};

/** Explicit accepted appraisal + actual Native practice. This owner stores
 * learned motor eligibility, never a name-driven physical effect. No human or
 * population calibration is supplied by this implementation. */
export const openSqliteSpinControlMasteryV123 = (path: string, authority?: SpinMasteryAuthorityV123) => {
  if (!id(path) || authority !== undefined && (typeof authority.readAcceptedMastery !== 'function'
    || typeof authority.readAcceptedCalibration !== 'function')) throw Error('invalid intentional spin mastery authority');
  const { DatabaseSync: Native } = createRequire(import.meta.url)('node:sqlite') as typeof import('node:sqlite'), db = new Native(path);
  try {
    db.exec(`PRAGMA journal_mode=WAL; PRAGMA synchronous=FULL; PRAGMA busy_timeout=5000;
      CREATE TABLE IF NOT EXISTS main.world_spin_mastery_v123(source_id TEXT PRIMARY KEY,career_id TEXT NOT NULL,player_id TEXT NOT NULL,
        technique TEXT NOT NULL,accepted_at_day INTEGER NOT NULL,source_json TEXT NOT NULL,source_hash TEXT NOT NULL,
        calibration_json TEXT NOT NULL,snapshot_json TEXT NOT NULL,snapshot_hash TEXT NOT NULL,
        UNIQUE(career_id,player_id,technique,accepted_at_day));`);
    let closed = false;
    const transaction = <T>(write: boolean, body: () => T): T => {
      if (closed) throw Error('closed intentional spin mastery owner');
      return withBodyCompositionTransaction(db, write, body);
    };
    const read = (sourceId: string) => readArchived(db, sourceId);
    const scopeRows = (careerId: string, playerId: string) => db.prepare(`SELECT * FROM main.world_spin_mastery_v123
      WHERE (career_id=$career OR ${claim('source_json', ['careerId'], '$career')}
        OR ${claim('snapshot_json', ['source', 'careerId'], '$career')})
      AND (player_id=$player OR ${claim('source_json', ['playerId'], '$player')}
        OR ${claim('snapshot_json', ['source', 'playerId'], '$player')})`).all({ career: careerId, player: playerId }) as Row[];
    return Object.freeze({
      accept(sourceId: string) {
        return transaction(true, () => {
          const prior = read(sourceId), raw = authority?.readAcceptedMastery(sourceId) ?? null;
          if (prior && !authority) return prior;
          if (!raw) throw Error('accepted intentional spin mastery Source is missing');
          const source = sourceInput(raw, sourceId), rawCalibration = authority!.readAcceptedCalibration(source.calibrationRef.sourceId);
          if (!rawCalibration) throw Error('accepted intentional spin mastery calibration is missing');
          const calibration = calibrationInput(rawCalibration);
          if (prior) {
            if (json(prior.source) !== json(source) || json(prior.calibration) !== json(calibration)) throw Error('spin mastery Source and calibration are frozen');
            return prior;
          }
          // All aliases of the same practice/effect remain one skill. A later
          // appraisal of that SAME skill may retain its original practice.
          const value = derive(db, source, calibration);
          const events = new Set(value.contacts.map(c => c.eventId));
          for (const row of scopeRows(source.careerId, source.playerId)) {
            const peer = read(row.source_id)!;
            if (peer.source.technique !== source.technique && (peer.source.sourceEffectIdentity === source.sourceEffectIdentity
              || peer.projection.qualified[0].episodeId === value.projection.qualified[0].episodeId
              || peer.contacts.some(c => events.has(c.eventId)))) throw Error('spin mastery aliases the same original practice/effect');
          }
          for (const row of db.prepare(`SELECT calibration_json FROM main.world_spin_mastery_v123
            WHERE ${claim('calibration_json', ['sourceId'], '$id')}`).all({ id: calibration.sourceId })) {
            if (row.calibration_json !== json(calibration)) throw Error('spin mastery calibration identity is already frozen differently');
          }
          db.prepare('INSERT INTO main.world_spin_mastery_v123 VALUES(?,?,?,?,?,?,?,?,?,?)').run(sourceId, source.careerId, source.playerId,
            source.technique, source.acceptedAtDay, json(source), hash(source), json(calibration), json(value), hash(value));
          const saved = read(sourceId);
          if (json(saved) !== json(value)) throw Error('spin mastery original owners changed during INSERT');
          return saved!;
        });
      },
      read(sourceId: string) { return transaction(false, () => read(sourceId)); },
      selectAtDay(careerId: string, playerId: string, atDay: number) {
        if (![careerId, playerId].every(id) || !day(atDay)) throw Error('invalid historical spin mastery scope');
        // Independent skills require independent failure-poisoned phases.
        // A broken original for one skill must leave other qualifications usable.
        return transaction(false, () => {
          const latest = new Map<SpinTechniqueV123, Row>(), blocked = new Set<SpinTechniqueV123>();
          const rejected: { sourceId: string; technique: SpinTechniqueV123 | null; reason: 'ORIGINAL_SOURCE_INVALID' | 'ALIASED_SOURCE' }[] = [];
          const reject = (row: Row, reason: typeof rejected[number]['reason']) => {
            const technique = SPIN_TECHNIQUES_V123.includes(row.technique) ? row.technique : null;
            if (technique) blocked.add(technique);
            rejected.push({ sourceId: row.source_id, technique, reason });
          };
          for (const row of scopeRows(careerId, playerId)) {
            try {
              // Authenticate index metadata before excluding a future Source;
              // never re-evaluate its later practice to decide a past skill.
              const source = sourceInput(JSON.parse(row.source_json), row.source_id);
              const archived = JSON.parse(row.snapshot_json) as DurableSpinMasteryV123;
              if (row.source_hash !== hash(source) || row.career_id !== careerId || row.player_id !== playerId
                || source.careerId !== careerId || source.playerId !== playerId || row.accepted_at_day !== source.acceptedAtDay
                || row.technique !== source.technique || row.snapshot_hash !== hash(archived)
                || json(archived.source) !== row.source_json) throw Error('spin mastery history index differs');
              if (source.acceptedAtDay > atDay) continue;
              const prior = latest.get(source.technique);
              if (!prior || source.acceptedAtDay > prior.accepted_at_day) latest.set(source.technique, row);
            } catch { reject(row, 'ORIGINAL_SOURCE_INVALID'); }
          }
          const valid: DurableSpinMasteryV123[] = [];
          for (const technique of SPIN_TECHNIQUES_V123) {
            const row = latest.get(technique); if (!row || blocked.has(technique)) continue;
            try { valid.push(read(row.source_id)!); } catch { reject(row, 'ORIGINAL_SOURCE_INVALID'); }
          }
          const keys = (v: DurableSpinMasteryV123) => ['effect:' + v.source.sourceEffectIdentity,
            'episode:' + v.projection.qualified[0].episodeId, ...v.contacts.map(c => 'event:' + c.eventId)];
          const uses = new Map<string, number>();
          for (const value of valid) for (const key of new Set(keys(value))) uses.set(key, (uses.get(key) ?? 0) + 1);
          const values = valid.filter(value => {
            if (!keys(value).some(key => uses.get(key)! > 1)) return true;
            reject(latest.get(value.source.technique)!, 'ALIASED_SOURCE'); return false;
          });
          const masteredTechniqueSet = values.map(v => v.source.technique);
          return freeze({ boundary: 'NATIVE_SPIN_MASTERY_INVENTORY' as const, nativeAdmission: true as const,
            familyId: 'intentional_batted_spin_control', scope: { careerId, playerId }, atDay, masteredTechniqueSet,
            effectiveStateId: values.length === 0 ? 'NONE' : values.length === 1 ? 'BLUE_' + masteredTechniqueSet[0] : 'GOLD',
            qualified: values.map(v => v.projection.qualified[0]),
            motorQualifications: values.map(v => ({ technique: v.source.technique,
              qualificationRef: { sourceId: v.source.sourceId, sourceVersion: v.source.sourceVersion },
              acceptedAtDay: v.source.acceptedAtDay, repertoireRef: v.source.repertoireRef,
              calibration: { ...v.source.calibrationRef, status: v.calibration.status }, motorProfileRefs: v.motorProfileRefs.map(r => {
                const binding = v.motorBindingsV133?.find(b => json(b.profileRef) === json(r));
                return binding ? { ...r, implementationV133: binding.implementationV133 } : r;
              }) })),
            rejected: rejected.sort((a, b) => a.sourceId < b.sourceId ? -1 : a.sourceId > b.sourceId ? 1 : 0) });
        });
      },
      close() { if (!closed) { db.close(); closed = true; } },
    });
  } catch (error) { db.close(); throw error; }
};
