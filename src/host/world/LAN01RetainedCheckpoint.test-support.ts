import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { lstatSync, mkdirSync, readFileSync, realpathSync, writeFileSync } from 'node:fs';
import { dirname, isAbsolute, join } from 'node:path';
import { gunzipSync } from 'node:zlib';
import { cloneInert } from '../../core/adjudication/OfficialWindowPolicy';

/** Preserved LAN01-R5 cp27 delivery boundary and its earlier provenance. */
const LAN01_PRIOR_CP27 = Object.freeze({
  sourceCommit: 'b38668807c4117b3053a50e4696735842373e2a3',
  publicSourceCommit: '9ada8883bb9553b08777379e6fefd5e8609e3ea6',
  sourceTree: '58f6c35f960058451e78e7066873c33ed40d45f4',
  runControlSha256: 'f60765c5fa947248f29c05edef04f55523ac29cf3041aba05145f4b3999df304',
  receiptSha256: 'f24b161688e37f9bc71365e856ab1f9c9bc355b9249b642444bf7036d081f4b4',
  censusSha256: 'b9f288b5ffe06b73ea4ee3ddf45758a05d98e72bb867c42f3d0b804bbbd21432',
  priorRunTerminalSha256: '2896744a52c7b580bbd1495c220f9da8931d0fe3fd5da32c970d7751a14eb11f',
  priorVitestReportSha256: null, priorSuffixResultPresent: false,
  gzipSha256: '7e296210d3e8cb32dcb07160ecd6223e2b6fb7ed85449319286dda2564e9d29c', gzipBytes: 803695,
  databaseSha256: '84e88bebcd4779c4222f3f32d5b3e48fc47d6c3c3e7dc4c27e30a0661dda5579', databaseBytes: 12349440,
  tableCount: 115, checkpointSequence: 27, returnedOwnerCall: 30,
  runnerModelResultHash: '35997800a5657833158e32f402af8329e57b4f21e778ee745aa20f692b574f0c',
  viewSnapshotHash: 'd6d7cd1cc61228cc13e68cc50e2310f3dda0cc55dd02d6af7396a1717c33452b',
  firstPitchSnapshotHash: '68e29c4cd60a0c7d3410156046228c5b38572a6d5b47a8bcd5113e0e1bab6d08',
  secondPitchSnapshotHash: '25c0ed5ec3217eb9df99da312fe5a9ea78df76f4247a8d65e272fa0f63d55ec7',
  anchorViewSnapshotHash: '5c08bc1c38f9a668153bd3d0bbe9c7d679d57b50120f0250edb23aa54466c0f9',
  cut0ViewSnapshotHash: '568fa0da5a5de99433ebac948f632126943af5cc21ca825c92e0695a288217c1',
  secondPostureSnapshotHash: '11c1f85eef98f38a8a1af82dd840e94ff58a79a6e21c8f4a9d17e53dad3fc0dd',
  returnedDeliveryHash: '5f830eee747970f9ff1ab96c3fd694f840e3a9ee7fefae26e628e76495e9fa3c',
  deliveryBoundary: Object.freeze({
    postureReference: { owner: 'batting_observation_v1_postures' as const, sourceId: 'lan01:swing:posture', sourceHash: '82606c4f3b619e8d953e7c86aa296f3d009f3f486ad3f61433ee0289598a17f4', snapshotHash: '911abceea086956bab311509f6dfdbd292e8921764b2c7d2aa68dfdd01d0a147' },
    intentReference: { owner: 'batting_execution_v1_intents' as const, sourceId: 'lan01:swing:intent', sourceHash: 'facfec19572a71e974d746ded4c3313f1b56c411212f299df69c37da38162c40', snapshotHash: 'af28a8bcf00b23e24fbbcac2ce4361bd4ad942235ed4f0429531803bba93e985' },
    launchReference: { owner: 'pa_physical_v1_launches' as const, sourceId: 'lan01:swing:launch', sourceHash: '86e6f2ec29849ce53ea2f5c60fe9352cb877fdd21b84ed9950542d0e17a60125', snapshotHash: 'f795d16d79150bc52295b1dcdbdfb12fdd1d45ccee8dcec46b493a862cc7fc55' },
    captureCutReference: { owner: 'pa_physical_v1_cuts' as const, sourceId: 'lan01:swing:capture-cut', sourceHash: 'd58821eae3289e93a28dbaab49bdafa4603af5968daea54d56d9b021faef9a85', snapshotHash: '957a204c0b084132e398c9699ef3b55b481e13d5c183103cfb79a41bde92a1bd' },
    observationReference: { owner: 'batting_observation_v1_observations' as const, sourceId: 'lan01:swing:capture', sourceHash: 'a485edf179288fd151988f1f227d30fd026b4eb4735f0afd4e72644124818c7c', snapshotHash: '2bbe48c45033678822606d4926abd63584aee6dacea42446e18182a26135f26d' },
    deliveryCutReference: { owner: 'pa_physical_v1_cuts' as const, sourceId: 'lan01:swing:delivery-cut', sourceHash: 'a387d3a515548989e80e151a62de57d2fd477e4b92a152cfaa1df752a3f003a0', snapshotHash: '4efb6dc64fa98a1e10dde2bf1c5d8da95de09ce88043c72aae45a9396af6cf15' },
    deliveryReference: { owner: 'batting_observation_v1_deliveries' as const, sourceId: 'lan01:swing:delivery', sourceHash: 'ad139f8c2323d89a9956e9a280e3eb4848447f4b8d0de7a1a393b130e2bd917d', snapshotHash: 'e89cff6d316ac087e2b0331f8f53ca6e6a87fcad725f459cc3a24dacc297ead8' },
    fieldCalibrationReference: { owner: 'pa_physical_v1_field_calibrations' as const, sourceId: 'lan01:field:calibration', sourceHash: '0e166b7e541b3f366456517af104532adbd0775d7dfc3d474d26657fbbd02cbe', snapshotHash: '59ebcd47d379609f23624e36edc7ad0978435c333ea49057bb16b61b9072cc15' },
    cut5ViewReference: { owner: 'pa_lifecycle_v1_execution_views' as const, sourceId: 'lan01:occupied:cut5:view', sourceHash: 'e4167fa24fe30c577b3c6354b9ece63d13cd81f55737f2f25373efa3949c2a23', snapshotHash: '40ff1dc543c78790031480d9666c8c21782bc306bc6cd77fb08034ed181fe430' },
  }),
  priorCp23: Object.freeze({
    sourceCommit: 'b1a8c797fe1b293663a94d3c259498760c20b190', publicSourceCommit: '5c5e4b1dbdb039ed70e673b80284c933fd878ee7',
    sourceTree: 'f1543cc585cc2181c40e39a17bb4731f49268f2d',
    gzipSha256: '20eb34335f9256a4237bfebfb1c0736bb9cf05b56d39947785243c2cd7a9f95d',
    databaseSha256: 'd0505072f55baf7a073563814e5fd82c643f7b8a8ab39b8d36f096ada5fb79b7',
    receiptSha256: '9ee4d4d324637d4e23a9905b7a18d1bd68a299319978dbd1c659d172c3c822ec',
    boundary: 'both occupied TAKEs and complete cut0; third action absent',
  }),
  priorCp5: Object.freeze({
    sourceCommit: '4d452cea7ee37d41ca4f517612ffa96a7bb878d2', sourceTree: '3dcc76c69323fdd3461d4af7ec7f61bafe646e2a',
    gzipSha256: 'fac97a92b42c858860babd827d975a693e1754f6498686edbd15928a3d612e6f',
    databaseSha256: '9476906a4cfc2728c6b968baf90763fdf0a1bae58595d409a345016cc813f177',
    receiptSha256: '9b8d372485d6c60e95794e0b58f6a5bae03f7e003a030e2c4c56d877c7bf285d',
    originalRunOutcome: 'FAILED_QUERY_ONLY_FIXTURE_READ',
  }),
  failedCp11Continuation: Object.freeze({
    terminalSha256: '268f81c2c4109734473d56533fbf3e9e3a2b402ad5f80a200602914c7ab44ea9',
    reportSha256: 'dafebb63b30883923c875c5061378da2837909021841d73be360d94a88597ace',
    originalRunOutcome: 'FAILED_IMMUTABLE_HOLD_EXHAUSTED', reusableAsCorrectedPrefix: false,
  }),
});

/** Exact LAN01-R6 cp21 after accepted third-pitch input and complete cut9.
 * The first remaining writer is commitment; earlier checkpoints are provenance only. */
const LAN01_PRIOR_CP21 = Object.freeze({
  ...LAN01_PRIOR_CP27,
  sourceCommit: '7d04312564243f83d9db94e0f692693ab94a6b30',
  publicSourceCommit: '7b989ef996035c0ad2fc1bbaf549b12f7d45634a',
  sourceTree: '4f67963c020d6768cfd9d90468cda7f15ef9c105',
  runControlSha256: 'b508b5b94f604203c303cdaf6a939ec762f5c274f56243c23c815f42904bff4c',
  receiptSha256: '1a154dc1cc0c8e027495d819e3349eccb1d806eaadd7e46bd5953602a6a4e506',
  censusSha256: 'c7f1af266abe03727895125ecb3e3fbe11baaeb306f66b9072551612c2b0705e',
  priorRunTerminalSha256: null,
  priorRunObservationSha256: 'fa60da67d0796f6594de6ea31cb5bdb870daaafa9e337092c5f0d57fee4e20d6',
  priorRunOutcome: 'INTERRUPTED_AFTER_ENVIRONMENT_CHANGE_TERMINAL_UNKNOWN',
  priorVitestReportSha256: null, priorSuffixResultPresent: false,
  gzipSha256: 'c11060ee2789fb3a3e4414975731d561beb0779d2e3822016c87a5e95dae7974', gzipBytes: 921724,
  databaseSha256: 'd6db63ca4b6302e7810db064de3b9fda451d67b25a453299b8a7334de946f85a', databaseBytes: 14417920,
  tableCount: 117, rowCount: 1290, checkpointSequence: 21, returnedOwnerCall: 21,
  returnedInputHash: 'bebb859a96ba407d7db163cf84e7c1a8cc4c77d9444a5092a9c072ca17511797',
  firstRemainingWriter: Object.freeze({
    owner: 'SamePlateAppearancePhysicalEpisode', method: 'acceptOperation', sourceId: 'lan01:swing:commitment',
    argumentsHash: '55ca606ba61b079c7f08142b1223ac14fc1944d70a50907dd7c51335ecf466c1',
  }),
  inputBoundary: Object.freeze({
    ...LAN01_PRIOR_CP27.deliveryBoundary,
    predictionReference: { owner: 'batting_prediction_v1_predictions' as const, sourceId: 'lan01:swing:forecast', sourceHash: '9b8b53ddc17cc89b6d74e04911fa371d95a86a836261a34d393288515c078f07', snapshotHash: '9c6210faa4c84e2bd6897e7f554d1d3776c954c4b561b1abc27686672eeaf93e' },
    scoreReference: { owner: 'batting_score_v1_assessments' as const, sourceId: 'lan01:swing:score', sourceHash: 'a8610d3eceda2cce6d1d13a918ac467cc1a8099537a2e295ebb2922c9fdbf91f', snapshotHash: 'a35aa83fcd40f2e9be9b6910dee638625828a4fe629221efdf8265f7e3c9cea3' },
    emotionReference: { owner: 'batting_emotion_execution_v1_executions' as const, sourceId: 'lan01:swing:emotion', sourceHash: '09a5b9e01139682591c791b55facf60e88b7d0e06568772d37ed24cd5927236b', snapshotHash: '5fe4af53843d48d480b4435890bab7e9637950414d312ebe9194a04ee048a521' },
    decisionCutReference: { owner: 'pa_physical_v1_cuts' as const, sourceId: 'lan01:swing:decision-cut', sourceHash: '9929d9c3b6500cc47ec0336a86eb8bf3414dfc21c629cc19bc1db9778b2176a6', snapshotHash: '7a93f018c4233f3ac5d063f340026b2c8e289ff2a854a8a0192f19f7a1d385cc' },
    decisionPrefixReference: { owner: 'pa_lifecycle_v1_work_prefixes' as const, sourceId: 'lan01:occupied:cut9:prefix', sourceHash: '3ff1726d0067cd9afb251350f028b5bfcf70ec70434091780259a8ab4ec3c7ac', snapshotHash: 'c9127809ec5dc94ee06950e7696421eb4852fe3e6cfb5a4243a29e168a1a8e87' },
    inputReference: { owner: 'batting_execution_v1_inputs' as const, sourceId: 'lan01:swing:input', sourceHash: '45f087b14a3e9ff81a23b885df411f24698fc1210d08ef71b82e7e41dbb5428d', snapshotHash: 'e9ee71e4525091ac0942ef60f7240fa092703e971294492e796a4885d31301ac' },
    cut9ViewReference: { owner: 'pa_lifecycle_v1_execution_views' as const, sourceId: 'lan01:occupied:cut9:view', sourceHash: 'fc9cdadb774d5834cff2f166793c3b5271a5da822402884292ee1c24d30e4b6e', snapshotHash: '9e83c718644d104c39bf8b35e553b5ad88975d2a21bf04f9e5cb73403607455e' },
  }),
  priorCp27: LAN01_PRIOR_CP27,
});
/** Exact LAN01-R7 cp14 after cut12 prefix, eleven TOTALs and view.
 * The first remaining writer is the original complete calibration set. */
const LAN01_PRIOR_CP14 = Object.freeze({
  ...LAN01_PRIOR_CP21,
  sourceCommit: 'c8c9e657faf94b4a2e02d51d38b97297429732da',
  publicSourceCommit: '092b768cb5c8b3072031df9400c87f88814fbc54',
  sourceTree: '06af20f366aa46a820c3bc9eabb03f657097c30e',
  runControlSha256: 'a7db84bafc85358c2a073ead4d6e12fcfea10c769e74468ea12a124391d8de19',
  receiptSha256: 'be09d528d29b47b5e381f7d6137762f37a60fd2702f72cba151504681ad4caed',
  censusSha256: '686ba32106185fec35a310e035b99a6206190fb999efbf4ffb81d758c357837b',
  contentAuditSha256: '419b559b02ff6a316b94d1378963172de4536238d14b1b2ed6c969f19ecb70e2',
  priorRunTerminalSha256: '8a48d3907ac9924c50f65ca063dd002edc08024bc8060d594532324c8319592c',
  priorRunObservationSha256: null,
  priorRunOutcome: 'FAILED_WALL_AFTER_CUT12_VIEW_BEFORE_CALIBRATION_RETURN',
  priorVitestReportSha256: null, priorSuffixResultPresent: false,
  gzipSha256: 'c28e883a9cbc2317e3e629e99807c26715b56d41e22f85deb4d1435761883128', gzipBytes: 999475,
  databaseSha256: '17698377c8347d6ddcb145852cafda439193512de56b2f206f2f894c3171fd9f', databaseBytes: 15671296,
  tableCount: 117, rowCount: 1397, checkpointSequence: 14, returnedOwnerCall: 14,
  returnedViewHash: 'c0a7eef8ddba81d5ad3c83bcc296bfdf5541985583290504ae8676ce3245459f',
  firstRemainingWriter: Object.freeze({
    owner: 'SamePlateAppearanceLifecycle', method: 'acceptCalibrationSet', sourceIdPrefix: 'lan01:occupied:cut12:',
    argumentsHash: 'f3bcf512bce0a0727213fd030e508dc720796a93a694d5a5c17b541d4c960434',
  }),
  fieldBoundary: Object.freeze({
    ...LAN01_PRIOR_CP21.inputBoundary,
    commitmentReference: { owner: 'pa_physical_v1_commitments' as const, sourceId: 'lan01:swing:commitment', sourceHash: 'd36e1b99f292fb5dd7a52704a50a883126fc90712283804a54c08d765ef682a2', snapshotHash: '0894002904f06790980a82e52dfafc42716549f393b051fead3d268a2e66d745' },
    resolutionReference: { owner: 'pa_physical_v1_resolutions' as const, sourceId: 'lan01:swing:resolution', sourceHash: '8062c5b5277518ce2c5165fa43647c37c3094ab6d1baef67d010e44c5d9c36bc', snapshotHash: '134455d5b5757feff4c72f5045a7cbb849928a4e2f50a6b849b61fe824a44339' },
    fieldRootReference: { owner: 'pa_physical_v1_field_roots' as const, sourceId: 'lan01:field:field-root', sourceHash: 'b061e6493a86d9d6219679aadc6fe2522b21a7523c0c1abbc5069e916e1bffd4', snapshotHash: '57426980d03f9f3172d1c9f0b56e2647a1cc545cf045e5eae39052488b4bcab5' },
    cut12PrefixReference: { owner: 'pa_lifecycle_v1_work_prefixes' as const, sourceId: 'lan01:occupied:cut12:prefix', sourceHash: '6ba6a8203df2bfb8a1506586daad5890fac8a60461adc7aca1502d418fbd16f7', snapshotHash: '1f3517002d2ea47133cba4e7ed661b19b9b4f2e78a43fded9ad2cefd28387cca' },
    cut12ViewReference: { owner: 'pa_lifecycle_v1_execution_views' as const, sourceId: 'lan01:occupied:cut12:view', sourceHash: 'e084f63c11021cd970dc86737d72b6a614ba600d3bbee6a4da7528fed95cb067', snapshotHash: 'f1917289244c16440081790b0e6b2a57d9059dc4c1013e2421995b405729bf69' },
  }),
  priorCp21: LAN01_PRIOR_CP21,
});
/** Exact LAN01-R6 cp19: the cut9 view is accepted but its calibration set is
 * absent. The later ground-contact lineage remains failed evidence only. */
export const LAN01_RETAINED_CHECKPOINT = Object.freeze({
  ...LAN01_PRIOR_CP27,
  sourceCommit: LAN01_PRIOR_CP21.sourceCommit, publicSourceCommit: LAN01_PRIOR_CP21.publicSourceCommit,
  sourceTree: LAN01_PRIOR_CP21.sourceTree, runControlSha256: LAN01_PRIOR_CP21.runControlSha256,
  priorRunTerminalSha256: null, priorRunObservationSha256: LAN01_PRIOR_CP21.priorRunObservationSha256,
  priorRunOutcome: LAN01_PRIOR_CP21.priorRunOutcome,
  receiptSha256: '2e684a90f3c112d217206e05470201a998311bfa1c0a627e97c614f4872863e9',
  censusSha256: '91a4f460ef426113790873993623d0c5ed2e2b4f5f5047055a4115dadd30a42b',
  contentAuditSha256: 'dec2d14ffe07d932699b80ccdc746a60a897486c0396698edf9dceeb51de5659',
  gzipSha256: '1ff55c8e79eaee682eff205541416d6fe6d4434bfde056ac11085f7a0e59c96b', gzipBytes: 897694,
  databaseSha256: 'bf869360d63a56535e0e20b97df6ad831e2dfa93e58cb6355a8b9270ce95511d', databaseBytes: 14032896,
  tableCount: 117, rowCount: 1257, checkpointSequence: 19, returnedOwnerCall: 19,
  returnedViewHash: '8d8da8ca92da7a4b0c41cfdd9fc69c7d4ce0d0a0021e99645da7acf57bf3f6cb',
  firstRemainingWriter: Object.freeze({
    owner: 'SamePlateAppearanceLifecycle', method: 'acceptCalibrationSet', sourceIdPrefix: 'lan01:occupied:cut9:',
    // The owner arguments contain the same 32 IDs. Only the not-yet-accepted
    // batter_swing Source values deliberately change at this boundary.
    argumentsHash: '34eaf330c3eec2898008592b4c72a0873bf1a93cda66c466f0a294cddf0df7e0',
  }),
  decisionBoundary: Object.freeze({
    ...LAN01_PRIOR_CP27.deliveryBoundary,
    predictionReference: LAN01_PRIOR_CP21.inputBoundary.predictionReference,
    scoreReference: LAN01_PRIOR_CP21.inputBoundary.scoreReference,
    emotionReference: LAN01_PRIOR_CP21.inputBoundary.emotionReference,
    decisionCutReference: LAN01_PRIOR_CP21.inputBoundary.decisionCutReference,
    decisionPrefixReference: LAN01_PRIOR_CP21.inputBoundary.decisionPrefixReference,
    cut9ViewReference: LAN01_PRIOR_CP21.inputBoundary.cut9ViewReference,
  }),
  priorCp21: LAN01_PRIOR_CP21,
  priorCp14: LAN01_PRIOR_CP14,
  priorCp27: LAN01_PRIOR_CP27,
  failedGroundContactLineage: Object.freeze({
    publicSourceCommit: '3dfe091e660f967e3f94f1c88ce7f8464e3b9c09', sourceTree: '002147bcb96b59188946a284859f0a27dc529583',
    terminalSha256: '76197083717093fefb2e3cf3114c6bd3554044b889c7c192c990f036a92d14ca',
    reportSha256: 'fe2420e91fa7198ebd66d77dac2886f17f2f7f134155f030b9a2d34b9aabeb71',
    resultSha256: 'bf438c9d4d2996a753ce4d690a0212eac44e771c1e615ddb381da14f56917373',
    gzipSha256: 'f1e77cdc8ced9e639fefb02a732f09e9952f6b619df8ccdd03ce5d685d658590',
    databaseSha256: '2d51b8a4a62d7f8bf2aa8d14aa4ad4bcd359eedbc55ba5fe76b68949bbba29f1',
    originalRunOutcome: 'FAILED_ACTUAL_FIELD_SOLE_GLOVE_ACQUISITION_CANDIDATE_MISSING',
    reusableAsCorrectedSuffix: false,
  }),
});
export type LAN01RetainedSuffixInput = Readonly<{
  nativeReleased: boolean; checkpointGzip: string; destinationDirectory: string;
}>;
const sha256 = (bytes: Uint8Array) => createHash('sha256').update(bytes).digest('hex');
export const captureLAN01RetainedSuffixInput = (raw: LAN01RetainedSuffixInput): LAN01RetainedSuffixInput => {
  const input = cloneInert(raw);
  assert(input && Object.keys(input).sort().join('|') === ['nativeReleased', 'checkpointGzip', 'destinationDirectory'].sort().join('|'), 'LAN01 retained input fields differ');
  assert.equal(input.nativeReleased, true, 'LAN01 retained Native suffix must be reviewed and released');
  for (const value of [input.checkpointGzip, input.destinationDirectory]) {
    assert(typeof value === 'string' && isAbsolute(value), 'LAN01 retained paths must be absolute');
  }
  return input;
};

/** Authenticate before creating anything. No source database is opened, and a
 * destination is exclusive: a failed suffix always leaves inspectable evidence. */
export const prepareLAN01RetainedCheckpoint = (raw: LAN01RetainedSuffixInput) => {
  const input = captureLAN01RetainedSuffixInput(raw), pin = LAN01_RETAINED_CHECKPOINT;
  const pinnedFile = (path: string, expected: string) => {
    assert.equal(realpathSync(path), path, 'LAN01 input must be a canonical file path');
    assert(lstatSync(path).isFile(), 'LAN01 input must be a regular file');
    const bytes = readFileSync(path); assert.equal(sha256(bytes), expected, 'LAN01 retained input hash differs'); return bytes;
  };
  // The independently audited byte pins identify cp19 even after its original
  // private witness files are lost. Exact bytes bind the audited schema/rowid
  // census. No replacement witness is synthesized.
  const gzip = pinnedFile(input.checkpointGzip, pin.gzipSha256); assert.equal(gzip.length, pin.gzipBytes);
  const bytes = gunzipSync(gzip, { maxOutputLength: pin.databaseBytes });
  assert.equal(bytes.length, pin.databaseBytes); assert.equal(sha256(bytes), pin.databaseSha256);
  assert.equal(realpathSync(dirname(input.destinationDirectory)), dirname(input.destinationDirectory), 'LAN01 output parent must be canonical');
  mkdirSync(input.destinationDirectory, { mode: 0o700 });
  const path = join(input.destinationDirectory, 'lan01-cp19-swing-calibration-suffix.sqlite');
  writeFileSync(path, bytes, { flag: 'wx', mode: 0o600 });
  assert.equal(sha256(readFileSync(path)), pin.databaseSha256);
  return { input, path, pin, witnessRecheck: { originalRunControl: false, checkpointReceipt: false, tableCensus: false, priorRunTerminal: false } as const };
};
