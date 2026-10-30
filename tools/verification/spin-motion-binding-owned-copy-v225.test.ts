import { readFileSync } from 'node:fs';
import { expect, it } from 'vitest';
import { parseDebugRecord } from './live-debug-record.mjs';
import { sourceDescriptionsV225 } from './spin-motion-binding-owned-copy-v225';
const path='work/motor-evidence-readonly-gate-v224-01/authenticated-motor-evidence.lossless.json';
it('V225-owned P01 builds two sources solely from the retained normal qualification and contact evidence',()=>{
 const raw=parseDebugRecord(readFileSync(path,'utf8')) as Parameters<typeof sourceDescriptionsV225>[0],before=JSON.stringify(raw),sources=sourceDescriptionsV225(raw);
 expect(sources.map(s=>s.technique)).toEqual(['BACKSPIN','TOPSPIN']);expect(sources.every(s=>s.evidenceReferences.length===3)).toBe(true);
 expect(sources.every(s=>Object.keys(s.masteryReference).length===4)).toBe(true);expect(JSON.stringify(raw)).toBe(before);
 expect(sources.flatMap(s=>s.evidenceReferences.map(e=>e.sourceEventId))).toEqual(raw.evidence.map(e=>e.sourceEventId));
});
it('V225-owned P02 refuses missing or duplicate original evidence',()=>{
 const raw=parseDebugRecord(readFileSync(path,'utf8')) as Parameters<typeof sourceDescriptionsV225>[0];
 const missing={...raw,evidence:raw.evidence.slice(1)};expect(()=>sourceDescriptionsV225(missing)).toThrow();
 const duplicated={...raw,evidence:[...raw.evidence,raw.evidence[0]]};expect(()=>sourceDescriptionsV225(duplicated)).toThrow();
});
