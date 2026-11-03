import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { stringifyDebugRecord, parseDebugRecord } from './live-debug-record.mjs';

const sha = value => createHash('sha256').update(value).digest('hex');
const authority = 'LOCAL_DEBUG_CHECKPOINT_NOT_NATIVE_ADMISSION';

/** This envelope detects local debug-case mixups. It is not a signature or
 * Native authorization, and does not modify the Core continuation format. */
export function sealDebugCheckpoint({ caseId, coreSha256, configurationText, commands, continuation }) {
  assert(typeof caseId === 'string' && caseId.length > 0, 'debug checkpoint case ID required');
  assert(/^[a-f0-9]{64}$/.test(coreSha256) && typeof configurationText === 'string' && Array.isArray(commands), 'debug checkpoint scope required');
  assert.equal(continuation?.version, 'live_match_continuation_v116', 'unsupported Core continuation');
  assert.equal(continuation.pitchCount, commands.length, 'Core pitch count differs');
  const continuationText = stringifyDebugRecord(continuation);
  return { version: 1, authority, caseId, coreSha256, configurationSha256: sha(configurationText),
    commandPrefixSha256: sha(stringifyDebugRecord(commands)), nextPitchOrdinal: commands.length + 1,
    continuationText, continuationSha256: sha(continuationText) };
}

export function restoreDebugCheckpoint({ caseId, coreSha256, configurationText, commands, checkpoint }) {
  assert(checkpoint?.version === 1 && checkpoint.authority === authority, 'unsupported local debug checkpoint');
  assert.equal(checkpoint.caseId, caseId, 'debug checkpoint case differs');
  assert.equal(checkpoint.coreSha256, coreSha256, 'debug checkpoint Core differs');
  assert.equal(checkpoint.configurationSha256, sha(configurationText), 'debug checkpoint configuration differs');
  assert.equal(checkpoint.nextPitchOrdinal, commands.length + 1, 'debug checkpoint pitch ordinal differs');
  assert.equal(checkpoint.commandPrefixSha256, sha(stringifyDebugRecord(commands)), 'debug checkpoint command prefix differs');
  assert.equal(checkpoint.continuationSha256, sha(checkpoint.continuationText), 'debug checkpoint continuation bytes differ');
  const continuation = parseDebugRecord(checkpoint.continuationText);
  assert.equal(continuation?.version, 'live_match_continuation_v116', 'unsupported Core continuation');
  assert.equal(continuation.pitchCount, commands.length, 'Core pitch count differs');
  return continuation;
}

export function verifyDebugCaseRuntime(packet, runtime) {
  assert.equal(packet.coreSha256, runtime.coreSha256, 'debug case Core differs');
  assert.equal(packet.backgroundRuntimeSha256, runtime.backgroundRuntimeSha256, 'debug case Worker runtime differs');
  assert.equal(packet.browserVersion, runtime.browserVersion, 'debug case Chrome build differs');
}
