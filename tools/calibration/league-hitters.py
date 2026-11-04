# Inverts all hitters of a season (targets file) into leagues of 18 through real-league-spec.py with measured priors and writes maker configs.
# usage: python -I -X utf8 league-hitters.py [--targets=<targets.json>] [--tag=X]   (paths inside: surface, build, base config, work folder K:/kbm-work/mlb24all)
# Splits all MLB 2024 hitters (400+ PA) into leagues of 18 and inverts each through real-league-spec.py with the measured priors.
import json, subprocess, sys, os
R = 'C:/Users/genki/Documents/Codex/2026-10-15/new-chat/work/mini-baseball'
W = 'K:/kbm-work/mlb24all'
TPATH = next((a.split('=', 1)[1] for a in sys.argv if a.startswith('--targets=')), 'K:/kbm-work/targets-mlb2024-bb.json'); sys.argv = [a for a in sys.argv if not a.startswith('--targets=')]
OUTTAG = next((a.split('=', 1)[1] for a in sys.argv if a.startswith('--tag=')), ''); sys.argv = [a for a in sys.argv if not a.startswith('--tag=')]
targets = json.load(open(TPATH, encoding='utf8'))
base = json.load(open(f'{R}/work/calibration/cfg-mlbstd17.json', encoding='utf8'))
slots = [b for team in base['teams'] for b in team['battingOrder']]
pool = sorted([pid for pid, t in targets.items() if t['pa'] >= 400])
adjust = sys.argv[1:]  # optional: --adjust=... --table=... passed through
for i in range(0, len(pool), 18):
    chunk = pool[i:i + 18]
    if len(chunk) < 18: chunk += pool[:18 - len(chunk)]   # fill the last league with repeats (their stats are not reused)
    L = i // 18
    pick = {s: {'source': pid} for s, pid in zip(slots, chunk)}
    json.dump(pick, open(f'{W}/pick-{L}.json', 'w'))
    cmd = [sys.executable, '-I', '-X', 'utf8', f'{R}/tools/calibration/real-league-spec.py', TPATH, 'K:/kbm-work/surface-rand8.json',
           f'{R}/work/calibration/cfg-mlbstd17.json', f'{W}/spec{OUTTAG}-{L}.json', f'{W}/truth{OUTTAG}-{L}.json', '--sprint=K:/kbm-work/sprint_speed_lahman.csv',
           '--batspeed=K:/kbm-work/mlb_batter_bat_tracking_player_year.csv', '--year=2024', '--attack-offset=2.8', '--soft=1', '--power-offset=3.3', f'--pick={W}/pick-{L}.json'] + adjust
    subprocess.run(cmd, check=True, capture_output=True)
    subprocess.run(['node', f'{R}/tools/maker/kbm-maker.mjs', f'{R}/work/calibration/build32/native.js', f'{R}/work/calibration/cfg-mlbstd17.json', f'{W}/spec{OUTTAG}-{L}.json', f'{W}/cfg{OUTTAG}-{L}.json'], check=True, capture_output=True)
    print('league', L, 'done')
