import { cloneInert } from '../../core/adjudication/OfficialWindowPolicy';
import type { TraitScope } from '../../core/world/traits/TraitTypes';
import type { TraitSourceSnapshot } from '../../core/world/traits/sources/SourceTraitTypes';
import { readSnapshot } from '../../core/world/traits/sources/SourceTraitValidation';
import { freeze, obj, readScope, same } from '../../core/world/traits/TraitValidation';
import { readContactDescriptorReportV191, type ContactDescriptorReportV191 } from './ContactDescriptorReportV191';

export type ContactDescriptorIdentityV229 = Readonly<{ scope: TraitScope; source: TraitSourceSnapshot;
  capturedInventoryHash: string | null; currentInventoryHash: string | null }>;
export type ContactDescriptorEnvelopeV229 = Readonly<{ boundary: 'NATIVE_CONTACT_DESCRIPTOR_ENVELOPE_ONLY';
  version: 'native-contact-descriptor-envelope-v229'; report: ContactDescriptorReportV191; identity: ContactDescriptorIdentityV229 | null }>;
const hash = (v: unknown): v is string => typeof v === 'string' && /^[0-9a-f]{64}$/.test(v);
/** Validates detached identity only; authority comes from the same Native snapshot reader.
 * currentInventoryHash identifies the observed collection and is not a current career date. */
export function createContactDescriptorEnvelopeV229(rawReport: unknown, rawIdentity: ContactDescriptorIdentityV229 | null): ContactDescriptorEnvelopeV229 {
  const report = readContactDescriptorReportV191(rawReport);
  if (rawIdentity === null) {
    if (report.source !== null || !report.reasons.includes('NO_REGISTERED_CONTACTS')) throw Error('contact envelope missing collection identity');
    return freeze({ boundary: 'NATIVE_CONTACT_DESCRIPTOR_ENVELOPE_ONLY' as const, version: 'native-contact-descriptor-envelope-v229' as const, report, identity: null });
  }
  const i = obj(cloneInert(rawIdentity), ['scope', 'source', 'capturedInventoryHash', 'currentInventoryHash'], 'identity');
  const scope = readScope(i.scope, 'identity.scope'), source = readSnapshot(i.source, 'identity.source');
  if (!same(scope, report.scope) || report.source === null || !same(source, report.source)) throw Error('contact envelope scope or source differs');
  const captured = i.capturedInventoryHash, current = i.currentInventoryHash;
  if (!(captured === null || hash(captured)) || !(current === null || hash(current))) throw Error('contact envelope invalid inventory hash');
  if (captured !== current) throw Error('contact envelope capture differs from current inventory');
  if (current === null && !report.reasons.includes('INVENTORY_NOT_CAPTURED')) throw Error('contact envelope current inventory unavailable');
  return freeze({ boundary: 'NATIVE_CONTACT_DESCRIPTOR_ENVELOPE_ONLY' as const, version: 'native-contact-descriptor-envelope-v229' as const,
    report, identity: { scope, source, capturedInventoryHash: captured, currentInventoryHash: current } });
}

/** Parse data only; validated shape never grants Native provenance or a career clock. */
export function readContactDescriptorEnvelopeV229(raw: unknown, expectedScope?: TraitScope): ContactDescriptorEnvelopeV229 {
  const value = obj(cloneInert(raw), ['boundary', 'version', 'report', 'identity'], 'envelope');
  if (value.boundary !== 'NATIVE_CONTACT_DESCRIPTOR_ENVELOPE_ONLY' || value.version !== 'native-contact-descriptor-envelope-v229')
    throw Error('invalid contact envelope version or boundary');
  const result = createContactDescriptorEnvelopeV229(value.report, value.identity as ContactDescriptorIdentityV229 | null);
  if (expectedScope !== undefined && !same(result.report.scope, readScope(expectedScope, 'expectedScope'))) throw Error('contact envelope expected scope differs');
  return result;
}
