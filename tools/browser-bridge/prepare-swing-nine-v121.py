from pathlib import Path
path=Path('tools/browser-bridge/probe-swing-nine-v121.mjs')
if path.exists(): raise SystemExit('probe already exists')
text=Path('tools/browser-bridge/probe-full-match-v116.mjs').read_text(encoding='utf-8')
old="teams,players,measuredClips:clips"
assert text.count(old)==1
text=text.replace(old,"teams,players:players.map((p,i)=>({...p,physical:{...api.LIVE_MATCH_AUTHORED_SI_DEFAULTS_V1,...p.physical,maximumSweetSpotSpeedMps:45,targetSweetSpotSpeedMps:30,motorLatencySeconds:.02,plateVision:90,swingPolicyV121:{version:'swing_policy_v121',sourceId:'SYNTHETIC_VERIFICATION_NOT_PLAYER_MEASUREMENTS',effort:.85,compactness:.5,controlPriority:.5,effortVariation:.05,twoStrikeEffortDelta:i%2?-.1:0,twoStrikeCompactnessDelta:i%2?.1:0,maximumClockAccelerationPerSecond:90}}})),measuredClips:clips")
text=text.replace('athleticUsage,inputSha256:',"swingPolicyTestV121:true,syntheticUniformMotorLimits:true,athleticUsage,inputSha256:")
text=text.replace('report.pitches++;report.maximumPitchWallMs',"assert(r.play.diagnostics.swingMotorV121,'V121 motor missing');report.pitches++;report.maximumPitchWallMs")
path.write_text(text,encoding='utf-8',newline='\n')
print(path)
