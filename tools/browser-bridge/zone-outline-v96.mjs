import assert from 'node:assert/strict';

/** Render the established single outline. Core retains its five-sided volume. */
export function applyZoneOutlineV96(html) {
  const before = `  if(setup){const polygon=setup.volume.platePolygon,lower=polygon.map(p=>project({...p,y:y0})),upper=polygon.map(p=>project({...p,y:y1}));
   for(let i=0;i<polygon.length;i++){const j=(i+1)%polygon.length;edges.push([lower[i],lower[j]],[upper[i],upper[j]],[lower[i],upper[i]]);}}
  else for(let i=0;i<4;i++)edges.push([zoneCorners[i],zoneCorners[(i+1)%4]]);`,
    choices = [before, before.replaceAll('\n', '\r\n')], found = choices.filter(marker => html.includes(marker));
  assert.equal(found.length, 1, 'expected the unique V94 depth-wire outline');
  assert.equal(html.split(found[0]).length, 2, 'ambiguous zone renderer');
  return html.replace(found[0], '  for(let i=0;i<4;i++)edges.push([zoneCorners[i],zoneCorners[(i+1)%4]]);');
}
