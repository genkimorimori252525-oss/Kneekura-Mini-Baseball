import assert from 'node:assert/strict';
/** Test-only conservation for this fixture's one existing official-state opener.
 * No SQL data or schema byte is masked; both known metadata counters must advance
 * exactly once. This does not authenticate any gameplay or writer boundary. */
export const privatePitchFaultConservation=(before:Buffer,after:Buffer)=>{
 assert(before.length>=100);assert.equal(after.length,before.length);
 assert.equal(before.subarray(0,16).toString('binary'),'SQLite format 3\0');
 const change=before.readUInt32BE(24),valid=before.readUInt32BE(92);
 assert.equal(change,valid);assert(change<0xffffffff);
 assert.equal(after.readUInt32BE(24),change+1);assert.equal(after.readUInt32BE(92),valid+1);
 for(const [start,end] of [[0,24],[28,92],[96,before.length]])assert(before.subarray(start,end).equals(after.subarray(start,end)),'fault output changed outside the two expected SQLite header counters');
 return Object.freeze({version:'same_value_user_version_opener_header_commit_v1' as const,
  fileChangeCounter:{before:change,after:change+1},versionValidFor:{before:valid,after:valid+1},allOtherBytesIdentical:true as const});
};
