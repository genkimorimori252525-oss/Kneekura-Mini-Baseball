import{readFileSync as read}from'node:fs';
import{createHash}from'node:crypto';
import assert from'node:assert/strict';
const root='docs/verification/traits-spin-continuation-v123/',scope=JSON.parse(read(root+'IMPLEMENTATION-SCOPE.json','utf8'));
assert.equal(scope.targetPlansConfirmed,true);assert.equal(scope.scopeQuestionsResolved,true);assert.equal(scope.askSameScopeAgain,false);
assert.equal(scope.signature.currentScope,'FOUNDATION_ONLY');
for(const key of['automaticRecognition','automaticNaming'])assert.equal(scope.signature[key],'DEFERRED_TO_PENNANT_IMPLEMENTATION');
assert.equal(scope.signature.deferredItemsBlockCurrentCompletion,false);assert.equal(scope.signature.physicalEffectsFromName,false);
assert.equal(scope.signature.draft32FenceOverridden,false);assert.equal(scope.signature.reopenTrigger,'HUMAN_REQUEST_TO_IMPLEMENT_PENNANT');
assert.equal(scope.scopePublication.commit,'db0ad7a9b15efae7a8839858b4b6d180a8643b01');
assert.equal(scope.scopePublication.change,'TWO_ADDED_LINES_SCOPE_NOTE_ONLY');assert.equal(scope.scopePublication.apiReadbackMatched,true);
const manifest=JSON.parse(read(root+'source-manifest.json','utf8'));assert.equal(scope.designCommit,manifest.commit);
for(const file of manifest.files){const name=file.path.split('/').at(-1),bytes=read(root+'upstream/'+name);
 assert(scope.plans.includes(name));assert.equal(bytes.length,file.bytes);assert.equal(createHash('sha256').update(bytes).digest('hex'),file.sha256);}
for(const path of['PLAN.md','RESULTS.md'])assert(read(root+path,'utf8').slice(0,500).includes('IMPLEMENTATION-SCOPE.json'));
for(const path of['docs/ai-continuity/CURRENT.md','docs/ai-continuity/REQUIREMENTS.md','docs/verification/spin-trial-v124/RESULTS.md'])
 assert(read(path,'utf8').slice(0,2200).includes('IMPLEMENTATION-SCOPE.json'));
const decision=read(scope.decisionRecord,'utf8');assert(decision.includes('6412388620'));assert(decision.includes('同じ対象確認'));
console.log(JSON.stringify({boundary:'HUMAN_SCOPE_AND_PINNED_DOCUMENT_INTEGRITY_ONLY',scopeQuestionsResolved:true,
 signatureAutomaticNaming:'DEFERRED_TO_PENNANT_IMPLEMENTATION',plans:scope.plans,sourceBytesUnchanged:true,entryPoints:5}));
