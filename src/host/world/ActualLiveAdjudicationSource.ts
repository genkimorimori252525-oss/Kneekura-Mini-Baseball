import { cloneInert } from '../../core/adjudication/OfficialWindowPolicy';
import { getRuleProfile, type RuleProfile } from '../../core/rules/RuleProfile';
import type { RuleProfileId } from '../../core/model/RuleProfileRef';
import { actualLivePlayFields as fields, actualLivePlayId as id } from './ActualLivePlayScope';
import { actorFreeze as freeze, actorJson as json } from './PhysicalPlateAppearanceActorEvidenceFromSqlite';
export type ActualLiveOfficialPolicy = Readonly<{ sourceId: string; sourceVersion: string; ruleProfileId: string;
  officialWindows: NonNullable<RuleProfile['officialWindows']> }>;
export type AcceptedActualLiveAdjudication = Readonly<{ sourceId: string; sourceVersion: string; physicalEndSourceId: string;
  policy: ActualLiveOfficialPolicy | null }>;
export const actualLiveAdjudicationInput = (raw: AcceptedActualLiveAdjudication, sourceId: string): AcceptedActualLiveAdjudication => {
  const s = cloneInert(raw);
  if (!fields(s, ['sourceId', 'sourceVersion', 'physicalEndSourceId', 'policy']) || s.sourceId !== sourceId
    || ![s.sourceId, s.sourceVersion, s.physicalEndSourceId].every(id)) throw new Error('invalid actual live adjudication Source');
  if (s.policy !== null) {
    const p = s.policy;
    if (!fields(p, ['sourceId', 'sourceVersion', 'ruleProfileId', 'officialWindows'])
      || ![p.sourceId, p.sourceVersion, p.ruleProfileId].every(id)
      || !fields(p.officialWindows, ['appeal', 'review', 'challenge'])) throw new Error('invalid actual official profile Source');
    for (const kind of ['appeal', 'review', 'challenge'] as const) {
      const w = p.officialWindows[kind];
      if (!w || !fields(w, ['available', ...('expiresAfterTicks' in w ? ['expiresAfterTicks'] : [])]) || typeof w.available !== 'boolean'
        || 'expiresAfterTicks' in w && (kind === 'appeal' || !w.available || !Number.isSafeInteger(w.expiresAfterTicks) || (w.expiresAfterTicks as number) <= 0)) {
        throw new Error('invalid actual official profile window');
      }
    }
  }
  return freeze(s);
};
/** Supplement only unspecified profile capability. Accepted fixture values are never production defaults. */
export const actualLiveAdjudicationProfile = (profileId: RuleProfileId, raw: ActualLiveOfficialPolicy | null): RuleProfile => {
  const original = cloneInert(getRuleProfile(profileId));
  if (raw === null) return freeze(original);
  const p = actualLiveAdjudicationInput({ sourceId: 'validation', sourceVersion: 'v1', physicalEndSourceId: 'validation', policy: raw }, 'validation').policy!;
  if (p.ruleProfileId !== original.id || Object.entries(original.officialWindows ?? {}).some(([kind, value]) =>
    json(p.officialWindows[kind as keyof typeof p.officialWindows]) !== json(value))) throw new Error('actual official profile differs from original Match policy');
  return freeze({ ...original, officialWindows: p.officialWindows });
};
