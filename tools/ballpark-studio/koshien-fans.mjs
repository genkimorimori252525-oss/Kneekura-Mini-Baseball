// Presentation palettes are independent of green seats and architectural trim.
const HOME=Object.freeze(['#ffd33c','#eab51a']),VISITOR=Object.freeze(['#5287d0','#dfe8ef']);
export const PAYPAY_HOME_COLORS=Object.freeze(['#f7c600','#db9f10']);
export function koshienFanPalettes(a){if(a.style==='fukuoka_dome')return{home:a.crowd?.homeColors??PAYPAY_HOME_COLORS,visitor:null};return a.style==='koshien'?
 {home:a.crowd?.homeColors??HOME,visitor:a.crowd?.visitorColors??VISITOR}:
 {home:[a.colors.red,a.colors.blue],visitor:null};}
// Approximate the reference map's small upper left-field visitor section.
// These are the existing 84-sector bowl's coordinates, never screen coordinates.
export function koshienFanZone(sector,tier){return tier===2&&sector>=32&&sector<38?'visitor':'home';}
