#!/bin/bash
# Pitcher response surface on the settled pitching (target plan V2, pitch mix by count, recognition): random pitcher leagues
# (top speed 138-165 km/h, control 55-110; each league's owned pitches scaled to its top speed), fielding-free games, then
# ability-fit.py --role=pitcher on the Statcast outcome table.
# usage: NATIVE=<native.js> BASE=<league config with the standard repertoire> TABLE=<outcome table.json> OUT=<dir>
#        LEAGUES=60 GAMES=8 EXTRA="<the batter and observation flags of the settled set>" tools/pitching/pitcher-surface.sh
# Leagues are made once (OUT/league-*.json); games already finished are kept (games.sh RESUME=1), so it can be run again.
set -e
: "${NATIVE:?}" "${BASE:?}" "${TABLE:?}" "${OUT:?}"
LEAGUES=${LEAGUES:-60}; GAMES=${GAMES:-8}
[ -f "$OUT/abilities.json" ] || node tools/calibration/random-league.mjs "$NATIVE" "$BASE" "$OUT" "$LEAGUES" 7 --pitchers
seeds=$(seq 9101 $((9100 + GAMES)))
for ((i = 0; i < LEAGUES; i++)); do
  SLOT=${SLOT:-node-pitch:2} PAR=${PAR:-2} RESUME=1 NATIVE="$NATIVE" OUT="$OUT/rec" EXTRA="$EXTRA" \
    bash tools/calibration/games.sh "p$i" "$OUT/league-$i.json" $seeds
done
python -I tools/calibration/ability-fit.py fit "$OUT/abilities.json" "$OUT/rec/g-p{league}-*.jsonl" "$TABLE" "$OUT/surface-pitch.json" --role=pitcher
echo ALLDONE
