import * as geometry from './model.mjs';
import {renderStadium,stadiumMesh} from './stadium-mesh.mjs';
import {prepareLogo} from './ground-logo.mjs';
import * as surface from './surface-layers.mjs';
globalThis.KneekuraBallparkGeometryV1=Object.freeze(geometry);
globalThis.KneekuraBallparkArchitectureV2=Object.freeze({render:renderStadium,scoreboardTarget:g=>{const s=stadiumMesh(g)?.scoreboard;return s?{x:0,y:s.baseY+24*s.scale,z:s.z,scale:s.scale}:null;}});
globalThis.KneekuraBallparkGroundLogoV2=Object.freeze({prepare:prepareLogo});
globalThis.KneekuraBallparkSurfaceV3=Object.freeze(surface);
