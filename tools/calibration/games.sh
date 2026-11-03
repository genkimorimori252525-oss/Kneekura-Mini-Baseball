#!/bin/bash
# Plays seeded games on the bundled Core, PAR at a time, each under the guard.
# usage: PAR=n NATIVE=<native.js> EXTRA="--observe=..." OUT=<dir> [MAX=2400] [TRIES=3] [RESUME=1] tools/calibration/games.sh <tag> <config.json> <seeds...>
# The guard's hard limit also counts the wait for a slot, so it is twice what one game takes. Each game saves a checkpoint
# every 25 pitches ($OUT/ck-<tag>-<seed>.json); a game the guard stops goes on from there, up to TRIES runs in all, and ends
# with the same records as one played straight through. RESUME=1 also goes on from a checkpoint an earlier call left.
# Run from the repository root. Records land in $OUT/g-<tag>-<seed>.jsonl and logs in $OUT/glog-<tag>-<seed>.txt.
# With the shared guard in ~/.claude/tools, every session on this PC shares SLOT (default node:3).
tag=$1; cfg=$2; shift 2
G=tools/release/guard.mjs; SL=""
if [ -f "$HOME/.claude/tools/guard/guard.mjs" ]; then G="$HOME/.claude/tools/guard/guard.mjs"; SL="--slot=${SLOT:-node:3}"; fi
OUT=${OUT:-work/calibration/rec}; N=${NATIVE:-work/calibration/build/native.js}; i=0
mkdir -p "$OUT"
for s in "$@"; do
  ( rec=$OUT/g-$tag-$s.jsonl; ck=$OUT/ck-$tag-$s.json; log=$OUT/glog-$tag-$s.txt
    if [ "$RESUME" != 1 ] || [ ! -f "$ck" ] || grep -q '"finished":true' "$ck"; then rm -f "$rec" "$ck"; : > "$log"; fi
    for try in $(seq ${TRIES:-3}); do
      from=""; if [ -f "$ck" ]; then from="--from=$ck"; else rm -f "$rec"; fi
      node "$G" $SL --idle=240 --max=${MAX:-2400} --watch="$rec" -- "node --max-old-space-size=3072 tools/release/core-playthrough.mjs $N $cfg --seed=$s --pitches=450 --records=$rec --checkpoint=$ck $from $EXTRA" >> "$log" 2>&1
      [ $? = 124 ] || break
      echo "RESUMING after guard stop ($try)" >> "$log"
    done ) &
  i=$((i+1)); if [ $((i%${PAR:-2})) = 0 ]; then wait; fi
done
wait
