#!/bin/bash
# Plays seeded games on the bundled Core, PAR at a time, each under the guard.
# usage: PAR=n NATIVE=<native.js> EXTRA="--observe=..." OUT=<dir> tools/calibration/games.sh <tag> <config.json> <seeds...>
# Run from the repository root. Records land in $OUT/g-<tag>-<seed>.jsonl and logs in $OUT/glog-<tag>-<seed>.txt.
# With the shared guard in ~/.claude/tools, every session on this PC shares SLOT (default node:3).
tag=$1; cfg=$2; shift 2
G=tools/release/guard.mjs; SL=""
if [ -f "$HOME/.claude/tools/guard/guard.mjs" ]; then G="$HOME/.claude/tools/guard/guard.mjs"; SL="--slot=${SLOT:-node:3}"; fi
OUT=${OUT:-work/calibration/rec}; N=${NATIVE:-work/calibration/build/native.js}; i=0
mkdir -p "$OUT"
for s in "$@"; do
  ( rm -f "$OUT/g-$tag-$s.jsonl"; node "$G" $SL --idle=240 --max=1200 --watch="$OUT/g-$tag-$s.jsonl" -- "node --max-old-space-size=3072 tools/release/core-playthrough.mjs $N $cfg --seed=$s --pitches=450 --records=$OUT/g-$tag-$s.jsonl $EXTRA" > "$OUT/glog-$tag-$s.txt" 2>&1 ) &
  i=$((i+1)); if [ $((i%${PAR:-2})) = 0 ]; then wait; fi
done
wait
