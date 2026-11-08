import assert from 'node:assert/strict';
import { readFileSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
const [input, output] = process.argv.slice(2); assert.ok(input && output);
const original = readFileSync(input, 'utf8');
assert.equal(createHash('sha256').update(original).digest('hex'), '9d72fb34dbdf40aa1cb877dd0954a085e4577506b0de4c812a5d2102c382c42f');
const marker = '// tools/verification/team-coverage/retained-entry.ts';
const boundary = original.lastIndexOf(marker); assert.ok(boundary > 0);
let library = original.slice(0, boundary);
const old = 'var sqliteMetadataClaimRows = (db, sql, id147) => read(db, sql, (statement) => statement.all({ id: id147 }));';
assert.equal(library.split(old).length, 2);
library = library.replace(old, 'var sqliteMetadataClaimRows = (db, sql, id147) => { try { return read(db, sql, (statement) => statement.all({ id: id147 })); } catch (error) { console.error(JSON.stringify({diagnosticOnly:true,sql,bindings:{id:id147},error:String(error)})); throw error; } };');
writeFileSync(output, library + `
const probeDirectory = resolve(process.argv[2]);
const probePath = join(probeDirectory, 'closed-prefix.sqlite');
const probeSha = () => createHash38('sha256').update(readFileSync(probePath)).digest('hex');
const probeBefore = probeSha(), probeStarted = Date.now();
if(process.argv[3]==='with-owner-prefix') {
  const probePinDb = new DatabaseSync4(probePath,{readOnly:true});
  const probePinRow = probePinDb.prepare('SELECT source_hash,snapshot_hash FROM pa_physical_v1_cuts WHERE source_id=?').get('team-native:pitch3:delivery-cut'); probePinDb.close();
  const probePin={owner:'pa_physical_v1_cuts',sourceId:'team-native:pitch3:delivery-cut',sourceHash:probePinRow.source_hash,snapshotHash:probePinRow.snapshot_hash};
  for(let probeIndex=0;probeIndex<2;probeIndex++) {
    const probeOwner = openSqliteSamePlateAppearancePhysicalEpisodeStore(probePath);
    try {const probeOwned=probeOwner.readOperation(probePin);assert3.equal(actorHash(probeOwned.record),probePin.snapshotHash);}
    finally {probeOwner.close();}
  }
}
const probeDb = new DatabaseSync4(probePath, {readOnly:true});
let probeOutcome;
try {
  const probeRow = probeDb.prepare('SELECT snapshot_json FROM pa_lifecycle_v1_execution_views WHERE source_id=?').get('team-retained:cut19:view');
  const probeView = JSON.parse(probeRow.snapshot_json);
  const probeRef = {owner:'pa_lifecycle_v1_execution_views',sourceId:probeView.source.sourceId,sourceHash:actorHash(probeView.source),snapshotHash:actorHash(probeView)};
  const probeIds = probeDb.prepare('SELECT source_id FROM pa_lifecycle_v1_execution_calibrations WHERE view_source_id=? ORDER BY rowid').all('team-retained:cut18:view').map(r=>r.source_id);
  const probeResult = withSqliteReadTransaction(probeDb,()=>({current:readCurrentSamePaLifecycleViewFromSqlite(probeDb,probeRef),calibrations:readSamePaLifecycleSetFromSqlite(probeDb,'calibration',probeIds)}));
  probeOutcome = {status:'PASS_PINNED_READONLY_CAL19_PROBE',calibrationCount:probeResult.calibrations.length,viewReference:probeRef};
} catch(error) { probeOutcome={status:'FAIL_PINNED_READONLY_CAL19_PROBE',error:String(error)}; }
finally {probeDb.close();}
assert3.equal(probeSha(),probeBefore);
const probeReport={outcome:probeOutcome,databaseHash:probeBefore,elapsedMilliseconds:Date.now()-probeStarted,diagnosticOnly:true,teamExecutionCredit:0,pinnedParentSha:'9d72fb34dbdf40aa1cb877dd0954a085e4577506b0de4c812a5d2102c382c42f'};
writeFileSync(join(probeDirectory,process.argv[3]==='with-owner-prefix'?'pinned-cal19-with-owner-prefix-probe.json':'pinned-cal19-read-probe.json'),JSON.stringify(probeReport,null,2)); console.log(JSON.stringify(probeReport));
`, { flag: 'wx' });
