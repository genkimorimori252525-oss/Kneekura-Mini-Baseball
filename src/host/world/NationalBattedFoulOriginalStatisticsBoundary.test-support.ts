import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';

/** Private qualification input, never domain evidence. The packet must pin the
 * actual closed run's journal and its unchanged source/observer files. */
export type NationalOriginalStatisticsBoundary = Readonly<{
  journal: Readonly<{ path: string; sha256: string }>;
  originalTail: Readonly<{ path: string; sha256: string }>;
  observer: Readonly<{ path: string; sha256: string }>;
  phases?: Readonly<{ path: string; sha256: string }>;
}>;
const sha = (text: string) => createHash('sha256').update(text).digest('hex');
const legacyTail = '8cf103e5070420d9f5018cffd9e3390870e03db69a87339e06f9c9b84d9269fa';
const markedTail = '92f9184cbd439ae1a0085fa790f41ecab1a49be1312ede6bda1c871a6388fea0';
export const assertNationalOriginalScoringSubmitEntered = (journal: string): void => {
  assert(journal.split('\n').filter(Boolean).some(line => {
    const row = JSON.parse(line) as { entry?: { name?: string; owner?: string; method?: string; argument?: string } };
    return row.entry?.name === 'owner-call' && row.entry.owner === 'ActualLiveScoring'
      && row.entry.method === 'submit' && row.entry.argument === 'national-live:ground-out';
  }), 'original missing-scoring assertion has no subsequent scoring-entry witness');
};
export const assertNationalOriginalStatisticsBoundary = (witness: NationalOriginalStatisticsBoundary): void => {
  const pinned = (input: NationalOriginalStatisticsBoundary['journal']) => {
    const text = readFileSync(input.path, 'utf8'); assert.equal(sha(text), input.sha256, 'original assertion witness file changed'); return text;
  };
  pinned(witness.originalTail);
  assert([legacyTail, markedTail].includes(witness.originalTail.sha256), 'unqualified original assertion source');
  if (witness.originalTail.sha256 === markedTail) {
    assert(witness.phases, 'original assertion completion marker is missing');
    assert(pinned(witness.phases).split('\n').filter(Boolean).some(line =>
      JSON.parse(line).phase === 'original_missing_scoring_assertion_completed'), 'original assertion completion marker is missing');
  }
  const observer = pinned(witness.observer)
    .replace(/^const evidence = .*;$/m, 'const evidence = PRIVATE_INPUT;')
    .replace(/^it\('NAT-N01 .*', \(\) => \{$/m, 'it(PRIVATE_ORIGINAL_CASE, () => {')
    .replace(/^}, [0-9_]+\);$/m, '}, PRIVATE_CAP);');
  assert.equal(sha(observer), '3af29d9bbedc4e34ec2f8ec790981c67a04d3e921274af4105d6843ea44c2bd5', 'unqualified original owner observer');
  assertNationalOriginalScoringSubmitEntered(pinned(witness.journal));
};
