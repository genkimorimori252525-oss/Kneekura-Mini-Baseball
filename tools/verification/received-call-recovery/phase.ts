import assert from 'node:assert/strict';
import { runReceivedCallRecoveryPhase } from '../../../src/host/world/ReceivedCallCheckpointRecovery.test-support';
const required = (key: string) => { const value = process.env[`BASEBALL_RECEIVED_RECOVERY_${key}`]; assert(value, `missing ${key}`); return value; };
const phase = required('PHASE'); assert(phase === 'authenticate' || phase === 'reception' || phase === 'after_observation');
runReceivedCallRecoveryPhase({ phase,
  inputManifest: { path: required('INPUT'), sha256: required('INPUT_SHA256') },
  predecessorReceipt: { path: required('PREDECESSOR_RECEIPT'), sha256: required('PREDECESSOR_RECEIPT_SHA256') },
  predecessorTerminal: { path: required('PREDECESSOR_TERMINAL'), sha256: required('PREDECESSOR_TERMINAL_SHA256') },
  qualificationTerminal: { path: required('QUALIFICATION_TERMINAL'), sha256: required('QUALIFICATION_TERMINAL_SHA256') },
  sourceCommit: required('SOURCE_COMMIT'), sourceManifestSha256: required('SOURCE_SHA256'), configurationSha256: required('CONFIG_SHA256'),
  outputDirectory: required('OUTPUT'), receiptPath: required('RECEIPT'), progress: marker => console.info(JSON.stringify(marker)),
});
