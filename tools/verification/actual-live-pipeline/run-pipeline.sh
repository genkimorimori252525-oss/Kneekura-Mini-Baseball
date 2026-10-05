#!/usr/bin/env bash
set -euo pipefail
test "$#" -eq 1 || { echo 'Usage: bash run-pipeline.sh /absolute/frozen-run-config.json'; exit 2; }
wrapper_dir=$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)
# Both historical slots must be idle: the current policy permits one heavy process.
exec 9>/workspace/shared/baseball-native-check.lock
flock -n 9 || { echo 'Native main lock occupied; nothing launched'; exit 75; }
exec 8>/workspace/shared/baseball-native-aux-check.lock
flock -n 8 || { echo 'Native auxiliary lock occupied; nothing launched'; exit 75; }
exec python3 -B "$wrapper_dir/supervise-pipeline.py" "$1"
