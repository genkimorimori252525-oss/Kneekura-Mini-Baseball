"""Select original hip markers for the existing bat clips; never fit a body/COM."""
from pathlib import Path
import csv
import hashlib
import io
import json
import math
import sys
import zipfile

repo = Path(__file__).resolve().parents[2]
dataset = Path(sys.argv[1]).resolve()
target = Path(sys.argv[2]).resolve()
assert not target.exists(), 'requires a new output file'
bat_path = repo / 'docs/demos/measured-bat-motions.json'
bat_bytes = bat_path.read_bytes()
bats = json.loads(bat_bytes)
archive = dataset / 'upstream_archives/dataset-v1/hitting_landmarks.zip'
sha = lambda p: hashlib.sha256(p.read_bytes()).hexdigest()
selected = {c['source']['motion']: c for c in bats['clips']}
times = {k: {r['time']: i for i, r in enumerate(c['sourceRows'])} for k, c in selected.items()}
frames = {k: {} for k in selected}
columns = ['session_swing', 'time'] + [f'{hip}_{axis}' for hip in ['left_hip', 'right_hip'] for axis in 'xyz']
with zipfile.ZipFile(archive) as z:
    member_sha = hashlib.sha256()
    with z.open('landmarks.csv') as stream:
        for chunk in iter(lambda: stream.read(1024 * 1024), b''):
            member_sha.update(chunk)
    with z.open('landmarks.csv') as binary, io.TextIOWrapper(binary, encoding='utf-8-sig', newline='') as text:
        reader = csv.DictReader(text)
        assert set(columns) <= set(reader.fieldnames)
        for row in reader:
            key, time = row['session_swing'], row['time']
            if key not in times or time not in times[key]:
                continue
            index = times[key][time]
            assert index not in frames[key], 'duplicate source time'
            # Join to the exact original bat observation, not nearest time.
            assert all(row[k] == v for k, v in selected[key]['sourceRows'][index].items())
            def point(prefix):
                values = [float(row[prefix + '_' + a]) for a in 'xyz']
                assert all(math.isfinite(n) for n in values)
                return dict(zip('xyz', [values[1], values[2], values[0]]))
            left, right = point('left_hip'), point('right_hip')
            frames[key][index] = {'tick': selected[key]['frames'][index]['tick'], 'leftHip': left, 'rightHip': right,
                                  'sourceRow': {k: row[k] for k in columns}}
clips = []
for key, bat in selected.items():
    assert len(frames[key]) == len(bat['frames'])
    clips.append({'clipId': bat['id'], 'batSourceSha256': bat['source']['sha256'], 'handedness': bat['side'],
                  'frames': [frames[key][i] for i in range(len(bat['frames']))]})
result = {'version': 'measured_pelvis_reference_dataset_v1',
          'authority': 'ORIGINAL_HIP_JOINT_CENTERS_NOT_MEASURED_BODY_COM_OR_PLAYER_CALIBRATION',
          'sourceCommit': bats['sourceCommit'], 'archiveSha256': sha(archive), 'archiveMemberSha256': member_sha.hexdigest(),
          'originalBatDatasetSha256': hashlib.sha256(bat_bytes).hexdigest(),
          'sourceFields': columns, 'worldFromLab': [[0, 1, 0], [0, 0, 1], [1, 0, 0]],
          'units': 'm', 'ticksPerSecond': 1000000,
          'interpolation': 'LINEAR_BETWEEN_ORIGINAL_KEYS_NOT_MEASURED_CONTINUOUS_VELOCITY',
          'bodyCenterPolicy': 'HIP_MIDPOINT_PROXY_REQUIRES_EXPLICIT_COLLIDER_BINDING', 'clips': clips}
target.parent.mkdir(parents=True, exist_ok=True)
target.write_text(json.dumps(result, ensure_ascii=False, separators=(',', ':')) + '\n', encoding='utf-8')
print(json.dumps({'output': str(target), 'sha256': sha(target), 'clips': len(clips),
                  'originalKeys': sum(len(c['frames']) for c in clips), 'nativeAdmission': False}))
