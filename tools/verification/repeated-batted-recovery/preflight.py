"""Cheap raw admission for a fresh continuation; no Native/domain replay."""
import argparse, hashlib, json, pathlib, sqlite3

INPUT_SHA = '585ab7862ab93991e97cd5032ba8d520e113635559aa0019b5dd9bd43257a04a'
def sha(path): return hashlib.sha256(pathlib.Path(path).read_bytes()).hexdigest()
def require(value, message):
    if not value: raise ValueError(message)
def unique(pairs):
    result = {}
    for key, value in pairs:
        require(key not in result, 'duplicate JSON key: ' + key); result[key] = value
    return result
def load(text): return json.loads(text, object_pairs_hook=unique)
def closed(path):
    for suffix in ['-wal', '-journal']:
        extra = pathlib.Path(str(path) + suffix)
        require(not extra.exists() or extra.stat().st_size == 0, 'nonempty input sidecar: ' + suffix)
def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--manifest', required=True); parser.add_argument('--manifest-sha256', required=True)
    parser.add_argument('--output', required=True); args = parser.parse_args()
    require(sha(args.manifest) == args.manifest_sha256, 'fresh manifest pin differs')
    m = load(pathlib.Path(args.manifest).read_text())
    require(m['schema'] == 'fresh_published_closed_continuation_input_v1', 'wrong input kind')
    require(m['origin'] == {'kind': 'published_closed_snapshot', 'notRawProducerAdmission': True, 'historicalReceiptsInherited': False}, 'origin must be fresh closed-input replay')
    require(m['input']['sha256'] == INPUT_SHA and m['physicalEndSourceId'] == 'physical-end', 'closed input identity differs')
    require(set(m['models']) == {'batted_world_models', 'batted_contact_response_models'}, 'model census must be exact')
    require(m['nextBatterPlayerId'] == 'away-2', 'next batter differs')
    require(m['nextTake'] == {'action': {'kind': 'take'}, 'plateZ': 0, 'strikeZone': {'centerX': 0, 'halfWidth': 0.2, 'lowerY': 1.4, 'upperY': 1.8}, 'ballRadiusMeters': 0.0366}, 'explicit TAKE recipe differs')
    path = pathlib.Path(m['input']['path']).resolve(strict=True); closed(path)
    require(path.stat().st_size == 3362816 and sha(path) == INPUT_SHA, 'closed input pin/size differs')
    db = sqlite3.connect(path.as_uri() + '?mode=ro&immutable=1', uri=True, timeout=0); db.row_factory = sqlite3.Row
    try:
        db.execute('PRAGMA query_only=ON')
        schemas = {
            'matches': {'match_id', 'durable_revision', 'state_json', 'activation_json'},
            'applications': {'application_id', 'match_id', 'closure_id', 'request_hash', 'result_json'},
            'actual_first_base_play_ends': {'source_id', 'source_json', 'snapshot_json', 'snapshot_hash'},
            'actual_live_play_fences': {'game_id', 'play_id'},
            'physical_pitch_progress_actions': {'source_id', 'game_id', 'play_id', 'snapshot_json', 'snapshot_hash'},
            'physical_plate_appearance_actors': {'source_id', 'game_id', 'play_id'},
            'official_participant_bindings': {'game_id', 'player_id', 'binding_json'},
            'official_initial_world_sources': {'source_id', 'snapshot_json'},
            'batted_world_models': {'source_id', 'game_id', 'source_json', 'source_hash'},
            'batted_contact_response_models': {'source_id', 'game_id', 'source_json', 'source_hash'},
            'world_player_workload_heads': {'career_id', 'player_id', 'revision', 'state_json'},
            'world_pitch_timing_baselines': {'source_json'}, 'world_player_release_baselines': {'source_json'},
        }
        for table, columns in schemas.items():
            require(columns <= {r['name'] for r in db.execute(f'PRAGMA table_info("{table}")')}, 'missing raw prerequisite schema: ' + table)
        tables = {r['name'] for r in db.execute("SELECT name FROM sqlite_master WHERE type='table'")}
        for table in ['applications', 'world_player_workload_activities', 'actual_live_adjudications', 'actual_live_play_closures', 'actual_role_workload_settlements']:
            require(table not in tables or db.execute(f'SELECT count(*) FROM "{table}"').fetchone()[0] == 0, 'input already contains downstream stage: ' + table)
        require(db.execute("SELECT count(*) FROM sqlite_master WHERE type='trigger'").fetchone()[0] == 0, 'input contains test triggers')
        match = db.execute('SELECT * FROM matches').fetchall(); require(len(match) == 1, 'competing initial Match')
        state = load(match[0]['state_json'])
        require(match[0]['match_id'] == 'game-1' and match[0]['durable_revision'] == 0 and match[0]['activation_json'] is None, 'initial Match advanced')
        require(state['ruleProfileId'] == 'npb-2026' and state['playId'] == 7 and state['bases'] == {'first': None, 'second': None, 'third': None}, 'original profile/play/occupancy differs')
        pitches = db.execute('SELECT * FROM physical_pitch_progress_actions').fetchall(); require(len(pitches) == 1, 'competing original pitch')
        pitch = load(pitches[0]['snapshot_json']); actor = pitch['frame']['batterActor']
        require(pitches[0]['source_id'] == 'pitch-0' and pitches[0]['play_id'] == 7 and pitch['frame']['match']['ruleProfileId'] == 'npb-2026', 'original pitch lineage differs')
        require(actor['binding']['playerId'] == 'away-1', 'original batter differs')
        world = db.execute('SELECT snapshot_json FROM official_initial_world_sources').fetchall()
        require(len(world) == 1 and load(world[0][0])['match']['ruleProfileId'] == 'npb-2026', 'initial World profile differs')
        end = db.execute('SELECT source_json FROM actual_first_base_play_ends').fetchall()
        require(len(end) == 1 and load(end[0][0])['sourceId'] == 'physical-end', 'persisted end identity differs')
        require(db.execute('SELECT count(*) FROM actual_live_play_fences').fetchone()[0] == 1, 'missing or competing seal')
        bindings = [load(r[0]) for r in db.execute('SELECT binding_json FROM official_participant_bindings')]
        next_binding = [b for b in bindings if b['playerId'] == 'away-2']
        require(len(next_binding) == 1 and next_binding[0]['personId'] == 'person-away-2' and next_binding[0]['side'] == 'AWAY', 'next Player/Person binding differs')
        active = [*actor['defenderBindings'], next_binding[0]]
        require(len(active) == len({b['playerId'] for b in active}) == 10, 'active ten differs')
        models = []
        for table, expected in m['models'].items():
            rows = db.execute(f'SELECT * FROM "{table}"').fetchall(); require(len(rows) == 1, 'competing model: ' + table)
            row = rows[0]; model = load(row['source_json'])
            require(row['source_id'] == model['sourceId'] == expected['sourceId'] and row['source_hash'] == expected['sourceHash'] == hashlib.sha256(row['source_json'].encode()).hexdigest(), 'model pin differs: ' + table)
            for binding in active:
                members = [a for a in model['actors'] if a['playerId'] == binding['playerId'] and a['personId'] == binding['personId']]
                require(len(members) == 1 and len(members[0]['primitives']) == 5 and {p['role'] for p in members[0]['primitives']} == {'glove', 'body', 'tag_hand', 'left_foot', 'right_foot'}, 'missing exact accepted body/model member: ' + binding['playerId'])
            models.append({'sourceId': model['sourceId'], 'actorCount': len(model['actors']), 'activeTenPresent': True})
        require(db.total_changes == 0, 'raw admission changed input')
    finally: db.close()
    closed(path); require(sha(path) == INPUT_SHA, 'raw admission changed input bytes')
    output = pathlib.Path(args.output)
    with output.open('x') as file:
        json.dump({'schema': 'fresh_closed_input_raw_preflight_v1', 'inputManifestSha256': args.manifest_sha256, 'inputSha256': INPUT_SHA, 'readOnly': True,
                   'allConnectionsClosed': True, 'models': models, 'nativeReauthenticated': False, 'historicalReceiptsInherited': False}, file, indent=2); file.write('\n')
if __name__ == '__main__': main()
