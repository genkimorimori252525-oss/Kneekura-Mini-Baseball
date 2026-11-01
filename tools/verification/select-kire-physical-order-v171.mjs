import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdir, readFile, realpath, stat, writeFile } from 'node:fs/promises';
import { dirname, isAbsolute, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseDebugRecord, stringifyDebugRecord, firstDebugDifference } from './live-debug-record.mjs';

// Saved-data selection/export only. No Source, factory, gate analyzer, browser,
// trajectory or current-physics verification API is imported or invoked.
assert.equal(process.argv.length, 2, 'usage: node tools/verification/select-kire-physical-order-v171.mjs');
const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..'), task = 'MB-20261027-REALISM-DEBUG-PLAN',
  base = 'docs/verification/realism-debug-20261027/', parentFolder = base + 'kire-gyro-domain-v169-01',
  output = base + 'kire-physical-order-selection-v171-01', out = resolve(root, output),
  category = 'PHYSICALLY_ORDERED_INPUTS_BELOW_EXPLORATORY_SCREEN_NOT_SKILL_ADMISSION',
  receiptPath = 'docs/ai-continuity/verification-receipts/' + task + '_99c626670d5a4a509dcb9f9904301611.json',
  MAX_FILE_BYTES = 64 * 1024 * 1024, MAX_OUTPUT_BYTES = 16 * 1024 * 1024,
  sha = value => createHash('sha256').update(value).digest('hex'), pin = bytes => ({ bytes:bytes.length, sha256:sha(bytes) }),
  inside = (basePath, path) => { const r = relative(basePath, path);return r !== '' && !isAbsolute(r) && r !== '..' && !r.startsWith('..' + sep); },
  local = path => relative(root, resolve(root, path)).split(sep).join('/'), inputPins = {}, artifactPins = {}, startedAt = new Date().toISOString();
const physicalRoot = await realpath(root);
async function pinnedRead(path, expected) {
  const absolute = resolve(root, path), physical = await realpath(absolute);
  assert(inside(root, absolute) && inside(physicalRoot, physical), 'saved data must resolve inside project: ' + path);
  assert(!local(path).startsWith('src/'), 'current Source is outside this saved-data selection');
  assert((await stat(absolute)).size <= MAX_FILE_BYTES, 'saved file exceeds bounded size');
  const bytes = await readFile(absolute), actual = pin(bytes);
  if (typeof expected === 'string') assert.equal(actual.sha256, expected, 'saved hash changed: ' + path);
  else if (expected !== undefined) assert.deepEqual(actual, expected, 'saved bytes/hash changed: ' + path);
  if (inputPins[local(path)]) assert.deepEqual(actual, inputPins[local(path)], 'saved input changed during selection');
  inputPins[local(path)] = actual;return bytes;
}
async function save(name, value, rawText = false) {
  const path = resolve(out, name);assert(inside(out, path), 'export escaped new folder');
  const text = rawText ? value : stringifyDebugRecord(value);assert(Buffer.byteLength(text) <= MAX_OUTPUT_BYTES, 'bounded export required');
  const bytes = Buffer.from(text + '\n');await writeFile(path, bytes, { flag:'wx' });
  artifactPins[name] = { path:output + '/' + name, ...pin(bytes) };return { ...artifactPins[name], recordSha256:sha(text) };
}
const exact = (a, b, message) => assert.equal(stringifyDebugRecord(a), stringifyDebugRecord(b), message),
  pairKey = ids => JSON.stringify([...ids].sort()), lexIds = (a, b) => {
    for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return a[i] < b[i] ? -1 : 1;return 0;
  };
await pinnedRead(fileURLToPath(import.meta.url));
await pinnedRead('tools/verification/live-debug-record.mjs');
await pinnedRead('docs/agent-decisions/2026-10-28-kire-physical-order-v171.md');
const parent = JSON.parse((await pinnedRead(parentFolder + '/report.json',
  '81e7ba44e51e4eef1c130b93b666e750ff93e7705dcfccbbe5cda03d5ef9511a')).toString('utf8')),
  receipt = JSON.parse((await pinnedRead(receiptPath, 'adedbeafac9125748761c94732a51e8f6d947bce1596a35c9342626e2a29a7ed')).toString('utf8'));
assert(parent.pass && parent.endPinsEqual);assert.equal(receipt.task_id, task);assert.equal(receipt.result, 'PASS');assert.equal(receipt.exit_code, 0);
assert.equal(receipt.receipt_id, task + '_99c626670d5a4a509dcb9f9904301611');
assert.equal(receipt.command[1], 'tools/verification/check-kire-gyro-domain-v169.mjs');assert.equal(receipt.command.at(-1), parentFolder);
await pinnedRead(receipt.output_path, receipt.output_sha256);
assert.equal(parent.summary.modelCandidateCount, 0);assert.equal(parent.summary.nearAmountAndDirectionTripleCount, 311);
assert.equal(parent.uniqueNewFlightInputs, 24);assert.equal(parent.oldRecordReuse.uniqueCases, 56);
// These are immutable V169 output artifacts, not current Source pins.
for (const [path, expected] of Object.entries(parent.artifactPins)) {
  assert(inside(resolve(root, parentFolder), resolve(root, path)), 'V169 artifact escaped its study');await pinnedRead(path, expected);
}
async function parentArtifact(name) {
  const path = resolve(root, parentFolder, name), expected = parent.artifactPins[path];assert(expected, 'V169 artifact pin missing: ' + name);
  return parseDebugRecord((await pinnedRead(path, expected)).toString('utf8'));
}
const [cases, pairs, packed, summary] = await Promise.all(['cases.json', 'pairs.json', 'packed-all-triples.json', 'summary.json'].map(parentArtifact)),
  near = (await Promise.all(parent.packing.nearTripleFiles.map(item => parentArtifact(item.file)))).flat(),
  caseById = new Map(cases.map(item => [item.id, item])), pairByIds = new Map(pairs.map(item => [pairKey([item.caseAId, item.caseBId]), item]));
assert.equal(cases.length, 80);assert.equal(caseById.size, 80);assert.equal(pairs.length, 3160);assert.equal(packed.tripleRows.length, 82160);
assert.equal(near.length, 311);assert.equal(summary.modelCandidateCount, 0);exact(pairs, packed.pairs, 'saved pair artifacts disagree');
const flagBit = name => { const index = packed.schema.flagBits.indexOf(name);assert(index >= 0);return 1 << index; },
  packedNear = packed.nearTripleRows.map(index => packed.tripleRows[index]);
for (const [index, row] of near.entries()) {
  exact(row.caseIds, packedNear[index].slice(0, 3).map(i => cases[i].id), 'near row/packed IDs differ');
  for (const field of packed.schema.flagBits) assert.equal(row[field], Boolean(packedNear[index][6] & flagBit(field)));
}
const eligible = near.filter(row => row.nearAmountAndDirection && row.p10StrictlyIncreasing && row.transitionIntervalStrictlyDecreasing
  && row.late20StrictlyIncreasing && row.withinCasePercentileOrder && !row.adjacentTimeShapeCandidate);
assert.equal(eligible.length, 143, 'the fixed physical-order category must contain the preserved 143 rows');
function score(row) {
  assert(row.orderedCaseIds && row.orderedCaseIds.length === 3 && row.modelCandidate === false && row.skillAdmission === false);
  const ordered = row.orderedCaseIds.map(id => { const item = caseById.get(id);assert(item);return item; }),
    durations = ordered.map(item => item.percentTimes.p90 - item.percentTimes.p10),
    p10DelaysSeconds = [ordered[1].percentTimes.p10 - ordered[0].percentTimes.p10, ordered[2].percentTimes.p10 - ordered[1].percentTimes.p10],
    durationReductionsSeconds = [durations[0] - durations[1], durations[1] - durations[2]],
    fourSeconds = [...p10DelaysSeconds, ...durationReductionsSeconds],
    late20Increases = [ordered[1].comparison.commonTime.late20Fraction - ordered[0].comparison.commonTime.late20Fraction,
      ordered[2].comparison.commonTime.late20Fraction - ordered[1].comparison.commonTime.late20Fraction],
    threePairs = [[0, 1], [0, 2], [1, 2]].map(([a, b]) => pairByIds.get(pairKey([ordered[a].id, ordered[b].id]))),
    relativeDifferences = threePairs.flatMap(item => [item.commonTimeRelativeAmountDifference, item.samePlaneRelativeAmountDifference]);
  assert(fourSeconds.every(value => Number.isFinite(value) && value > 0));assert(late20Increases.every(value => Number.isFinite(value) && value > 0));
  assert(relativeDifferences.every(value => typeof value === 'number' && Number.isFinite(value)));
  return { orderedCaseIds:row.orderedCaseIds, minimumFourSeconds:Math.min(...fourSeconds), p10DelaysSeconds,
    durationReductionsSeconds, fourSeconds, durationsSeconds:durations, minimumLate20Increase:Math.min(...late20Increases), late20Increases,
    maximumRelativeAmountDifference:Math.max(...relativeDifferences) };
}
// One fixed ranking. No result of a later flight can select another row here.
const ranking = eligible.map(row => ({ row, score:score(row) })).sort((a, b) =>
  b.score.minimumFourSeconds - a.score.minimumFourSeconds || b.score.minimumLate20Increase - a.score.minimumLate20Increase
  || a.score.maximumRelativeAmountDifference - b.score.maximumRelativeAmountDifference || lexIds(a.score.orderedCaseIds, b.score.orderedCaseIds)),
  selected = ranking[0], selectedIds = selected.score.orderedCaseIds;

async function readV169Pinned(path) {
  const expected = parent.startPins[resolve(root, path)];assert(expected, 'V169 must pin saved provenance: ' + path);return pinnedRead(path, expected);
}
const oldCasesPath = base + 'kire-saved-onset-v165-01/cases.json',
  oldCases = parseDebugRecord((await readV169Pinned(oldCasesPath)).toString('utf8')), parentReports = new Map();
async function nominalCase(id) {
  const newCase = parent.cases.find(item => item.id === id), oldCase = oldCases.find(item => item.id === id),
    origins = newCase ? [{ folder:parentFolder, detail:newCase }] : await Promise.all(oldCase.origins.map(async origin => {
      if (!parentReports.has(origin.parent)) {
        const reportPath = origin.parent + '/report.json', report = JSON.parse((await readV169Pinned(reportPath)).toString('utf8'));
        assert(report.pass && report.endPinsEqual);parentReports.set(origin.parent, report);
      }
      const matches = parentReports.get(origin.parent).cases.filter(item => item.run === 'nominal' && item.id === id && item.index === origin.index);
      assert.equal(matches.length, 1);return { folder:origin.parent, detail:matches[0] };
    }));
  assert(origins.length > 0, 'nominal provenance required');let first;
  for (const origin of origins) {
    const texts = {}, rawPins = {};
    for (const channel of ['input', 'main', 'worker', 'json']) {
      const path = origin.folder + '/' + origin.detail.files[channel];
      const bytes = origin.folder === parentFolder ? await pinnedRead(path, parent.artifactPins[resolve(root, path)]) : await readV169Pinned(path);
      const text = bytes.toString('utf8').trimEnd();assert.equal(sha(text), origin.detail.sha256[channel]);
      if (channel !== 'input') assert.equal(Buffer.byteLength(text), origin.detail.bytes[channel]);texts[channel] = text;rawPins[channel] = pin(bytes);
    }
    assert.equal(texts.main, texts.worker);assert.equal(texts.main, texts.json);
    const input = parseDebugRecord(texts.input), record = parseDebugRecord(texts.main), current = caseById.get(id),
      percentTimes = Object.fromEntries(['p10', 'p50', 'p90'].map(key => [key, record.observation.timingAtReference.percentTimes[key]?.elapsedSeconds ?? null]));
    assert.equal(input.item.id, id);assert.equal(record.id, id);assert.equal(input.observationIntervals, 160);
    exact(input.item.descriptor, record.descriptor, 'nominal descriptor differs');exact(input.item.factors, record.factors, 'nominal factors differ');
    exact(current.comparison, record.comparison, 'V169 comparison differs from nominal record');exact(current.percentTimes, percentTimes, 'V169 percentiles differ');
    assert.equal(record.observation.referenceElapsedSeconds, current.referenceElapsedSeconds);
    const result = { id, input, record, inputText:texts.input, recordText:texts.main, parentFolder:origin.folder,
      detail:origin.detail, rawPins, provenance:{ parentFolder:origin.folder, parentIndex:origin.detail.index, parentId:id,
        parentFiles:origin.detail.files, parentRecordSha256:origin.detail.sha256,
        sourceScope:'SAVED_V169_MEASUREMENT_INPUTS_NOT_ASSERTED_CURRENT_PHYSICS', inputFullTextExact:true,
        nominalMainWorkerJsonFullTextExact:true, measurementPerformed:false } };
    if (first) { assert.equal(first.inputText, result.inputText);assert.equal(first.recordText, result.recordText); } else first = result;
  }
  return first;
}
// Check nominal input/record provenance for all 80 inputs that contributed to
// ranking. Source files are never read or asserted current by this export.
const selectedNominals = new Map();
for (const item of cases) {
  const nominal = await nominalCase(item.id);if (selectedIds.includes(item.id)) selectedNominals.set(item.id, nominal);
}
assert.equal(selectedNominals.size, 3);
const nominals = selectedIds.map(id => selectedNominals.get(id)), reference = nominals[0].input.reference;
for (const nominal of nominals) exact(reference, nominal.input.reference, 'selected cases must share the saved reference');

const oldRefinementFolder = base + 'pitch-break-kire-anchor-reuse-v164-01',
  refinementReportPath = oldRefinementFolder + '/report.json',
  refinementReport = JSON.parse((await pinnedRead(refinementReportPath)).toString('utf8'));
assert(refinementReport.pass && refinementReport.endPinsEqual);
const refinementReuse = [];
for (const nominal of nominals) for (const run of ['observationDense', 'physicalHalfStep']) {
  const plannedInput = structuredClone(nominal.input);plannedInput.observationIntervals = 640;
  if (run === 'physicalHalfStep') {
    plannedInput.item.descriptor.profile.air.integrationStepTicks = 2500;
    if (Object.hasOwn(plannedInput.item, 'effectiveIntegrationStepTicks')) plannedInput.item.effectiveIntegrationStepTicks = 2500;
  }
  const matches = refinementReport.cases.filter(row => row.run === run && row.id === nominal.id);
  if (!matches.length) { refinementReuse.push({ id:nominal.id, run, exactSavedInputAvailable:false, reason:'NO_MATCHING_SAVED_V164_CASE_ID', measurementPerformed:false });continue; }
  assert.equal(matches.length, 1);const detail = matches[0], texts = {};
  for (const channel of ['input', 'main', 'worker', 'json']) {
    const path = oldRefinementFolder + '/' + detail.files[channel];
    const text = (await pinnedRead(path)).toString('utf8').trimEnd();assert.equal(sha(text), detail.sha256[channel]);texts[channel] = text;
  }
  assert.equal(texts.main, texts.worker);assert.equal(texts.main, texts.json);
  const oldInput = parseDebugRecord(texts.input), record = parseDebugRecord(texts.main), exactInput = stringifyDebugRecord(oldInput) === stringifyDebugRecord(plannedInput);
  exact(record.descriptor, oldInput.item.descriptor, 'saved refinement record/input descriptor differs');
  refinementReuse.push({ id:nominal.id, run, exactSavedInputAvailable:exactInput, parentFolder:oldRefinementFolder, files:detail.files,
    savedInputRecordSha256:detail.sha256.input, plannedInputRecordSha256:sha(stringifyDebugRecord(plannedInput)),
    firstInputDifference:exactInput ? null : firstDebugDifference(plannedInput, oldInput),
    reuseScope:'EXACT_SAVED_INPUT_AVAILABILITY_ONLY_LATEST_CORE_MEASUREMENT_DEPENDENCIES_NOT_VERIFIED', measurementPerformed:false });
}

await mkdir(out); // No existing selection/export may be replaced.
await mkdir(resolve(out, 'selected'));
await save('ranking.json', { category, rule:{ primary:'MAX_MIN_OF_TWO_ADJACENT_P10_DELAYS_AND_TWO_DURATION_REDUCTIONS_SECONDS',
  secondary:'MAX_MIN_ADJACENT_LATE20_INCREASE', tertiary:'MIN_MAX_RELATIVE_AMOUNT_DIFFERENCE_ALL_THREE_PAIRS_BOTH_BASES',
  finalTieBreak:'ORDERED_ID_ARRAY_LEXICOGRAPHIC_CODE_UNIT_ORDER' },
  categoryCount:143, rankings:ranking.map(({ score }, index) => ({ rank:index + 1, ...score })), selectionPerformedOnce:true });
const roles = ['LOW_PHYSICAL_ORDER', 'MIDDLE_PHYSICAL_ORDER', 'HIGH_PHYSICAL_ORDER'], exported = [];
for (const [index, nominal] of nominals.entries()) {
  const prefix = 'selected/' + String(index).padStart(2, '0'), inputFile = await save(prefix + '-input.json', nominal.inputText, true),
    recordFile = await save(prefix + '-nominal-record.json', nominal.recordText, true),
    comparisonFile = await save(prefix + '-comparison.json', nominal.record.comparison);
  exported.push({ role:roles[index], id:nominal.id, factors:nominal.input.item.factors, sourceDescriptor:nominal.input.item.descriptor,
    parentProvenance:{ ...nominal.provenance, exportedInput:inputFile, exportedNominalRecord:recordFile, exportedComparison:comparisonFile } });
}
const adjacentPairs = [[0, 1], [1, 2]].map(([a, b]) => pairByIds.get(pairKey([selectedIds[a], selectedIds[b]]))),
  packet = { version:'physical_order_selection_inputs_v171', authority:'SAVED_DATA_ONLY_SELECTION_NOT_CURRENT_PHYSICS_PASS', category,
    reference, selected:exported, score:selected.score, gates:{ Q:true, P:true, D:true, L:true, A:false, legacyModelCandidate:false },
    observations:{ nominal:{ comparisons:nominals.map(item => item.record.comparison), percentTimes:nominals.map(item => ({ id:item.id, ...caseById.get(item.id).percentTimes })),
      maxRelativeAmountDifference:selected.score.maximumRelativeAmountDifference, allThreePairsMatched:true, adjacentPairs } },
    legacyExploratoryScreen:{ unchanged:true, minimumP50FractionDifference:.05, minimumLate20FractionDifference:.05, passed:false },
    scope:{ publicFixture:'curve4/seed3', savedV169Cases:80, categoryTriples:143, nominalRecordsReused:3,
      currentSourceAsserted:false, currentPhysicsPass:false, newFlightCount:0, humanCalibration:false, nativeAdmission:false, skillAdmission:false,
      uiSelectionImplemented:false, rerankingAfterMeasurementAllowed:false } };
const packetFile = await save('selected-physical-order-inputs-v171.json', packet);
await save('selection-integrity-v171.json', { category, validation:'SAVED_DATA_EXPORT_HASH_AND_PROVENANCE_ONLY', selectedIds,
  packetRawFilePin:{ bytes:packetFile.bytes, sha256:packetFile.sha256 }, packetRecordSha256:packetFile.recordSha256,
  recordHashMeaning:'SHA256_STRINGIFY_DEBUG_RECORD_WITHOUT_APPENDED_NEWLINE',
  currentSourceAsserted:false, currentPhysicsPass:false, newFlightCount:0, skillAdmission:false });
await save('saved-refinement-reuse-possibilities.json', { category, savedV164ReportPin:inputPins[refinementReportPath],
  entries:refinementReuse, latestCoreReuseApproved:false, currentSourceAsserted:false, newFlightCount:0 });
for (const [path, expected] of Object.entries(inputPins)) assert.deepEqual(pin(await readFile(resolve(root, path))), expected, 'saved data changed before export close: ' + path);
for (const expected of Object.values(artifactPins)) assert.deepEqual(pin(await readFile(resolve(root, expected.path))),
  { bytes:expected.bytes, sha256:expected.sha256 }, 'new export bytes changed');
await save('report.json', { selectionValidation:'PASS_SAVED_DATA_ONLY', category, startedAt, finishedAt:new Date().toISOString(),
  selectedIds, selectedScore:selected.score, categoryCount:143, sourceFlightSimulations:0, selectionPerformedOnce:true,
  sourceCurrentAsserted:false, currentPhysicsPass:false, skillAdmission:false, uiSelectionImplemented:false,
  preservedV169:{ receiptId:receipt.receipt_id, reportSha256:inputPins[parentFolder + '/report.json'].sha256,
    modelCandidateCount:0, legacyAThresholdUnchanged:true, originalReceiptAndPassNotReassigned:true },
  verifiedNominalInputCount:80, verifiedSelectedNominalRecords:3,
  exactSavedRefinementInputs:refinementReuse.filter(item => item.exactSavedInputAvailable).map(({ id, run }) => ({ id, run })),
  inputPins, artifactPins:{ ...artifactPins }, endSavedDataPinsEqual:true,
  limitations:['NO_CURRENT_SOURCE_OR_PHYSICS_ASSERTION', 'NO_FLIGHT_OR_CHROME_EXECUTION', 'PHYSICAL_ORDER_IS_NOT_SKILL_OR_PERCEPTION_ADMISSION'] });
console.log(JSON.stringify({ selectionValidation:'PASS_SAVED_DATA_ONLY', selectedIds, fourSeconds:selected.score.fourSeconds,
  minimumFourSeconds:selected.score.minimumFourSeconds, minimumLate20Increase:selected.score.minimumLate20Increase,
  maximumRelativeAmountDifference:selected.score.maximumRelativeAmountDifference, QPDL:true, A:false,
  category, newFlightCount:0, currentPhysicsPass:false, skillAdmission:false,
  exactSavedRefinementInputCount:refinementReuse.filter(item => item.exactSavedInputAvailable).length }));
