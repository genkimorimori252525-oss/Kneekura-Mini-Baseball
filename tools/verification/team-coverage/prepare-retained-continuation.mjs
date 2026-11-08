import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { constants, copyFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';

const [attemptArgument, bundleArgument] = process.argv.slice(2); assert.ok(attemptArgument && bundleArgument);
const attempt = resolve(attemptArgument), bundle = resolve(bundleArgument);
const manifest = JSON.parse(readFileSync(join(attempt, 'manifest.json'), 'utf8'));
const authentication = JSON.parse(readFileSync(join(attempt, 'owner-authentication-receipt.json'), 'utf8'));
assert.equal(authentication.status, 'PASS_CLOSED_CUT17_ORIGINAL_OWNER_AUTHENTICATION_OBSERVATION2_NOT_ADMITTED');
assert.equal(authentication.exactNextStage, 'defender-observation-2');
const sha = bytes => createHash('sha256').update(bytes).digest('hex');
const bundleHash = sha(readFileSync(bundle));
assert.equal(bundleHash, '9d72fb34dbdf40aa1cb877dd0954a085e4577506b0de4c812a5d2102c382c42f');
assert.equal(sha(readFileSync(manifest.closedPath)), authentication.databaseHash);
assert.equal(sha(readFileSync(manifest.sourceMapPath)), authentication.authorityMapHash);
const destination = join(attempt, 'continuation'), originalDirectory = resolve(attempt, '..');
assert.ok(!existsSync(destination)); mkdirSync(destination); mkdirSync(join(destination, 'retained-resume'));
const copy = (from, to) => { copyFileSync(from, to, constants.COPYFILE_EXCL); assert.equal(sha(readFileSync(to)), sha(readFileSync(from))); };
copy(join(originalDirectory, 'retained-prefix.sqlite'), join(destination, 'retained-prefix.sqlite'));
copy(join(originalDirectory, 'accepted-sources-0.json'), join(destination, 'accepted-sources-0.json'));
copy(manifest.closedPath, join(destination, 'retained-resume', 'resume.sqlite'));
copy(manifest.sourceMapPath, join(destination, 'retained-resume', 'accepted-sources.json'));
copy(join(attempt, 'original-files', 'selected-policy.json'), join(destination, 'retained-resume', 'selected-policy.json'));
const receipt = { status: 'PREPARED_AUTHENTICATED_CUT17_CONTINUATION_COPY', destination,
  parentClosedDatabaseHash: authentication.databaseHash, parentSourceMapHash: authentication.authorityMapHash,
  bundle, bundleHash, exactNextStage: authentication.exactNextStage,
  previousObservation2ProposalHash: 'UNKNOWN_UNPUBLISHED', priorFailedAttempt: manifest.failedStage,
  previousFailedLogsPreservedAt: join(attempt, 'original-files', 'stage-child-logs'),
  selectionScope: 'accepted_individual_selected_only', nativeCandidateTeamActorBranch: false,
  teamExecutionCredit: 0, officialResult: null };
writeFileSync(join(destination, 'continuation-manifest.json'), JSON.stringify(receipt, null, 2)); console.log(JSON.stringify(receipt));
