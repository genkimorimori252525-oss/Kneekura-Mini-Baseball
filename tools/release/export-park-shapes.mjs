// Writes the real ballpark outlines for the match from the studio's designs.
// usage: node tools/release/export-park-shapes.mjs
// Each park is {points, foul}: the outfield points as authored, and the foul side
// with its rounded nodes, read from compiled geometry so Core needs no style code.
// The stadium list's `core` key has no entry here and keeps the circle.
import {writeFileSync} from 'node:fs';
import {dodgerStadiumDesign, fukuokaDomeDesign, koshienDesign, niikuraDomeDesign, russianDomeDesign, validateDesign} from '../ballpark-studio/model.mjs';

const designs = {fukuoka: fukuokaDomeDesign, tambov: russianDomeDesign, niikura: niikuraDomeDesign, koshien: koshienDesign, dodger: dodgerStadiumDesign};
const node = p => ({angleDegrees: p.angleDegrees, distanceMeters: p.distanceMeters, heightMeters: p.heightMeters});
const shapes = {};
for (const [key, make] of Object.entries(designs)) {
  const design = make(), check = validateDesign(design);
  if (!check.ok) throw Error(key + ': ' + JSON.stringify(check.errors));
  const geometry = check.geometry, fenceIds = new Set(geometry.fencePoints.map(p => p.id));
  shapes[key] = {points: geometry.fencePoints.map(node), foul: {...design.foul, nodes: geometry.vertices.filter(p => !fenceIds.has(p.id)).map(node)}};
}
const text = 'globalThis.KneekuraParkShapesV1=Object.freeze(' + JSON.stringify(shapes) + ');\n';
writeFileSync(new URL('../../release/game/parts/park-shapes-v1.js', import.meta.url), text);
console.log(Object.entries(shapes).map(([k, s]) => k + ' ' + s.points.length + '+' + s.foul.nodes.length).join(', '), text.length);
