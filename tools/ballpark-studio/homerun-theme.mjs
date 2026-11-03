// Home-run themes belong to a park's home team and play only for its own home
// runs there. release/game/parts/016-audio-runtime-v100.js holds the same rule.
export const HOME_TEAMS=Object.freeze({TBD:Object.freeze({name:'タンボフドラゴンズ',early:'tbd-early',late:'tbd-late',walkoff:'tbd-walkoff'})});
export function homeThemeTrack(teamId,{inning,walkoff=false}){
 const team=HOME_TEAMS[teamId];if(!team)return null;
 return walkoff?team.walkoff:inning<=6?team.early:team.late;
}
