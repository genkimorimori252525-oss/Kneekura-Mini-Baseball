#!/bin/bash
# Plays the archetype standard league (standard-archetypes.py: n copies whose two pitchers own a real-sized repertoire and
# together throw the standard mix) by turns: seed k goes to copy (k - first) mod n, so any number of games keeps the copies even.
# Records land as games.sh's under the tag <tag>-<copy>; score them together with the glob <tag>-[0-9].
# Run from the repository root, with games.sh's environment (SLOT, PAR, NATIVE, OUT, EXTRA, MAX, TRIES, RESUME).
# usage: tools/pitching/games-arch.sh <tag> <config prefix (…/cfg-arch)> <first seed> <games> [copies=6]
tag=$1; prefix=$2; first=$3; games=$4; n=${5:-6}
for ((i = 0; i < n; i++)); do
  seeds=()
  for ((k = first + i; k < first + games; k += n)); do seeds+=($k); done
  [ ${#seeds[@]} -gt 0 ] && bash tools/calibration/games.sh "$tag-$i" "$prefix-$i.json" "${seeds[@]}"
done
