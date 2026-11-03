import type { DatabaseSync } from 'node:sqlite';
/** Missing immutable owners may not be reconstructed beneath surviving typed
 * references. Inspect raw JSON and indexed mirrors, including duplicate keys. */
export function assertNoJointPhysicalDescendantClaims(db:Pick<DatabaseSync,'prepare'>,owner:string,id:string,children:readonly Readonly<{table:string;indexColumn:string}>[]){
  const quote=(s:string)=>'"'+s.replaceAll('"','""')+'"';
  for(const c of children){
    const catalog=db.prepare('SELECT type FROM main.sqlite_master WHERE lower(name)=lower(?)').all(c.table);if(!catalog.length)continue;
    if(catalog.length!==1||catalog[0].type!=='table')throw new Error('joint physical surviving reference namespace differs');
    if(db.prepare('SELECT 1 FROM main.'+quote(c.table)+' WHERE '+quote(c.indexColumn)+'=? LIMIT 1').get(id))throw new Error('joint physical missing owner has surviving descendant claims; repair forbidden');
    for(const column of ['source_json','snapshot_json'])if(db.prepare(`SELECT 1 FROM main.${quote(c.table)},json_tree(${column}) node
      WHERE node.type='object' AND EXISTS(SELECT 1 FROM json_each(node.value) p WHERE p.key='owner' AND p.type='text' AND p.atom=$owner)
      AND EXISTS(SELECT 1 FROM json_each(node.value) p WHERE p.key='sourceId' AND p.type='text' AND p.atom=$id) LIMIT 1`).get({owner,id}))
      throw new Error('joint physical missing owner has surviving typed descendant claims; repair forbidden');
  }
}
