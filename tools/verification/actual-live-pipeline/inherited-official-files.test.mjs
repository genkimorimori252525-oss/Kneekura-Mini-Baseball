import { readInheritedOfficialEvidence } from './inherited-official-files.mjs';
import { assertInheritedOfficialEvidence } from './inherited-official-evidence.mjs';
import { officialInputs } from './inherited-files-fixture.test-support.mjs';
import { fileLoaderContracts } from './inherited-files-contract.test-support.mjs';

fileLoaderContracts({ kind: 'official', inputs: officialInputs, read: readInheritedOfficialEvidence,
  assertSemantic: assertInheritedOfficialEvidence });
