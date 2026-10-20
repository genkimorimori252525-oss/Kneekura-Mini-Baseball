"""Independent raw archive / selected CSV / compact library comparison.

No importer or JavaScript geometry helper is imported. The retained upstream
landmarks.csv is a derived optical-measurement dataset, not raw C3D evidence.
"""
import csv
import hashlib
import io
import itertools
import json
import math
from pathlib import Path
import sys
import traceback
import zipfile
from decimal import Decimal


def sha(path):
    digest = hashlib.sha256()
    with path.open('rb') as handle:
        for chunk in iter(lambda: handle.read(1024 * 1024), b''):
            digest.update(chunk)
    return digest.hexdigest()


def require(condition, message):
    if not condition:
        raise AssertionError(message)


def tick(text):
    value = Decimal(text) * 1000000
    require(value == value.to_integral_value() and value >= 0, 'inexact original time')
    return int(value)


def distance(a, b):
    return math.sqrt(sum((x - y) ** 2 for x, y in zip(a, b)))


def run(dataset, library_path, output):
    report = {'pass': False, 'authority': 'INDEPENDENT_UPSTREAM_LANDMARK_ARCHIVE_READBACK',
              'limitation': 'Published derived optical landmarks; raw C3D files/body forms/contact outcomes are not inferred.'}
    try:
        data = json.loads(library_path.read_text(encoding='utf-8'))
        manifest = json.loads((dataset / 'download-manifest.json').read_text(encoding='utf-8'))
        require(manifest['sourceCommit'] == data['sourceCommit'] == '44b98dae05cceb016f080ab39d105c85b8639084', 'revision differs')
        archive = dataset / 'upstream_archives/dataset-v1/hitting_landmarks.zip'
        archive_pin = next(item for item in manifest['archives'] if item['name'] == 'hitting_landmarks.zip')
        archive_sha = sha(archive)
        require(archive_sha == archive_pin['sha256'] == '9cc2bdc94f5f5a6c5d540f4abe459caae2c5164cd53f6a6fd23f4b2b7283bcb3', 'archive SHA differs')
        csv_path = dataset / data['provenance']['csvPath']
        require(sha(csv_path) == data['provenance']['csvSha256'] == '282efb3d111bf973bd81780c7f3ff55224943d3b219e1a086840a815bb6f762c', 'selected CSV SHA differs')
        for name in ['metadata', 'model']:
            require(sha(dataset / data['provenance'][name + 'Path']) == data['provenance'][name + 'Sha256'], name + ' SHA differs')
        metadata_path = dataset / data['provenance']['metadataPath']
        with metadata_path.open(encoding='utf-8-sig', newline='') as handle:
            metadata = {row['session_swing']: row for row in csv.DictReader(handle)}
        clips = {clip['source']['motion']: clip for clip in data['clips']}
        require(len(clips) == 673 and len(data['index']) == 677, 'library census differs')
        headers = ['session_swing', 'time', 'blast_hand_x', 'blast_hand_y', 'blast_hand_z',
                   'sweet_spot_x', 'sweet_spot_y', 'sweet_spot_z', 'contact_time']
        trials = {}
        selected_windows = {identity: [] for identity in clips}
        with zipfile.ZipFile(archive) as zipped, csv_path.open(encoding='utf-8-sig', newline='') as selected_handle:
            require(zipped.namelist() == ['landmarks.csv'], 'archive entry differs')
            with io.TextIOWrapper(zipped.open('landmarks.csv'), encoding='utf-8-sig', newline='') as source_handle:
                for csv_line, (original, selected) in enumerate(itertools.zip_longest(csv.DictReader(source_handle), csv.DictReader(selected_handle)), start=2):
                    require(original is not None and selected is not None, 'archive / selected CSV length differs')
                    expected = {key: original[key] for key in headers}
                    require(expected == selected, f'archive source value differs at selected CSV line {csv_line}')
                    identity = selected['session_swing']
                    row_tick, contact_tick = tick(selected['time']), tick(selected['contact_time'])
                    state = trials.setdefault(identity, {'rows': 0, 'missingRows': 0, 'lastTick': -1, 'contactTick': contact_tick})
                    require(row_tick > state['lastTick'] and contact_tick == state['contactTick'], 'original clock differs')
                    state['rows'] += 1
                    state['lastTick'] = row_tick
                    coordinates = [selected[key] for key in headers[2:8]]
                    missing = any(value == '' or not math.isfinite(float(value)) for value in coordinates)
                    state['missingRows'] += int(missing)
                    if identity in clips and contact_tick - 300000 <= row_tick <= contact_tick + 80000:
                        require(not missing, 'missing coordinate in included window')
                        selected_windows[identity].append((csv_line, expected))
        require(len(trials) == 677 and sum(state['rows'] for state in trials.values()) == 469377, 'raw census differs')
        missing_trials = sorted(identity for identity, state in trials.items() if state['missingRows'])
        require(missing_trials == ['203_3', '342_1', '342_2', '67_2'], 'excluded trials differ')
        index = {entry['id']: entry for entry in data['index']}
        for identity, state in trials.items():
            entry, meta = index[identity], metadata[identity]
            require(entry['missingRows'] == state['missingRows'] and entry['eligible'] == (state['missingRows'] == 0), 'eligibility differs')
            require(entry['athlete'] == meta['user'] and entry['side'] == meta['hitter_side'], 'trial metadata differs')
            require(entry['lengthM'] == float(meta['bat_length_in']) * .0254 and entry['speedMph'] == float(meta['bat_speed_mph_max_x']), 'numeric metadata differs')
        maximum_hand = 0.0
        maximum_rigid_error = 0.0
        maximum_axis_error = 0.0
        sample_count = 0
        per_clip = []
        for identity, clip in clips.items():
            records = selected_windows[identity]
            rows = [row for _, row in records]
            require(len(rows) == len(clip['rows']) == 137, 'window count differs ' + identity)
            raw_window_sha = hashlib.sha256(json.dumps(rows, separators=(',', ':'), ensure_ascii=False).encode()).hexdigest()
            require(raw_window_sha == clip['source']['sourceRowsSha256'], 'source row hash differs ' + identity)
            require(records[0][0] == clip['sourceRowRange']['firstCsvLine'] and records[-1][0] == clip['sourceRowRange']['lastCsvLine'], 'row provenance differs')
            hand_max = 0.0
            for i, (row, sample) in enumerate(zip(rows, clip['rows'])):
                original_tick = tick(row['time'])
                require(sample[0] == original_tick, 'source time differs')
                hand = [float(row['blast_hand_y']), float(row['blast_hand_z']), float(row['blast_hand_x'])]
                sweet = [float(row['sweet_spot_y']), float(row['sweet_spot_z']), float(row['sweet_spot_x'])]
                require(sample[11:14] == sweet and sample[17:20] == hand, 'measured points differ')
                grip, tip, q = sample[1:4], sample[4:7], sample[7:11]
                length = clip['normalization']['batLengthM']
                rigid_error = abs(distance(grip, tip) - length)
                maximum_rigid_error = max(maximum_rigid_error, rigid_error)
                require(rigid_error < 1e-10, 'rigid length differs')
                require(abs(sum(component * component for component in q) - 1) < 1e-12, 'unit quaternion differs')
                w, x, y, z = q
                axis = [2 * (x * y - w * z), 1 - 2 * (x * x + z * z), 2 * (y * z + w * x)]
                actual_axis = [(tip[k] - grip[k]) / length for k in range(3)]
                axis_error = distance(axis, actual_axis)
                require(axis_error < 1e-10, 'quaternion axis differs')
                maximum_axis_error = max(maximum_axis_error, axis_error)
                require(distance([grip[k] + (tip[k] - grip[k]) * clip['normalization']['sweetSpotT'] for k in range(3)], sweet) < 1e-10, 'rigid sweet point differs')
                residual = distance([grip[k] + actual_axis[k] * .17145 for k in range(3)], hand)
                hand_max = max(hand_max, residual)
                require(residual <= .0200000001, 'hand residual exceeds bound')
                a, b = rows[max(0, i - 1)], rows[min(136, i + 1)]
                dt = (tick(b['time']) - tick(a['time'])) / 1000000
                velocity = [(float(b[key]) - float(a[key])) / dt for key in ['sweet_spot_y', 'sweet_spot_z', 'sweet_spot_x']]
                require(sample[14:17] == velocity, 'original central-difference velocity differs')
                sample_count += 1
            require(abs(hand_max - clip['binding']['maximumHandResidualM']) < 1e-10, 'reported hand residual differs')
            maximum_hand = max(maximum_hand, hand_max)
            per_clip.append({'id': clip['id'], 'sourceRowsSha256': raw_window_sha, 'samples': 137, 'maxHandResidualM': hand_max})
        require(sample_count == 92201, 'sample total differs')
        report.update({'pass': True, 'archiveSha256': archive_sha, 'librarySha256': sha(library_path), 'libraryBytes': library_path.stat().st_size,
                       'rawRowsComparedToArchive': 469377, 'sourceTrials': 677, 'includedClips': 673, 'excludedTrials': missing_trials,
                       'originalKeys': sample_count, 'maximumHandResidualM': maximum_hand, 'maximumRigidLengthErrorM': maximum_rigid_error,
                       'maximumQuaternionAxisError': maximum_axis_error, 'perClip': per_clip})
    except Exception as error:
        report['error'] = str(error)
        report['traceback'] = traceback.format_exc()
    output.parent.mkdir(parents=True, exist_ok=True)
    output.write_text(json.dumps(report, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
    print(json.dumps({key: report.get(key) for key in ['pass', 'includedClips', 'originalKeys', 'rawRowsComparedToArchive', 'error']}, ensure_ascii=False))
    return 0 if report['pass'] else 1


if __name__ == '__main__':
    raise SystemExit(run(Path(sys.argv[1]), Path(sys.argv[2] if len(sys.argv) > 2 else 'docs/demos/measured-bat-library-v1.json'),
                        Path(sys.argv[3] if len(sys.argv) > 3 else 'docs/verification/releases/v68/measured-library/source-audit.json')))
