"""Reject incomplete or misleading H/AB references; reproduce the released bytes offline."""
import copy
import importlib.util
import json
from pathlib import Path
import unittest
import zipfile

spec = importlib.util.spec_from_file_location('reference', Path(__file__).with_name('import-mlb-course-reference-v87.py'))
reference = importlib.util.module_from_spec(spec)
spec.loader.exec_module(reference)

class ReferenceAudit(unittest.TestCase):
    def packet(self):
        def row(player, hits, at_bats):
            return {'player': {'id': player}, 'season': '2025', 'sport': {'id': 1}, 'split': {'code': 'zn01'},
                    'stat': {'hits': hits, 'atBats': at_bats}}
        return {'stats': [{'totalSplits': 2, 'splits': [row(1, 1, 1), row(2, 0, 9)]}]}

    def audit(self, packet):
        return reference.audit_split(json.dumps(packet).encode(), 'zn01')

    def test_weights_counts_instead_of_averaging_player_averages(self):
        self.assertEqual(self.audit(self.packet()), {'hits': 1, 'atBats': 10, 'average': .1, 'players': 2})

    def test_incomplete_page_and_duplicate_player_are_rejected(self):
        packet = self.packet()
        packet['stats'][0]['totalSplits'] = 3
        with self.assertRaisesRegex(AssertionError, 'Incomplete'):
            self.audit(packet)
        packet = self.packet()
        packet['stats'][0]['splits'][1]['player']['id'] = 1
        with self.assertRaisesRegex(AssertionError, 'Duplicate'):
            self.audit(packet)

    def test_wrong_season_sport_game_zone_or_counts_are_rejected(self):
        changes = [('season', '2024'), ('sport', {'id': 2}), ('gameType', 'P'),
                   ('split', {'code': 'zn02'}), ('stat', {'hits': 2, 'atBats': 1}),
                   ('stat', {'hits': 1.0, 'atBats': 2})]
        for key, value in changes:
            with self.subTest(key=key, value=value):
                packet = copy.deepcopy(self.packet())
                packet['stats'][0]['splits'][0][key] = value
                with self.assertRaises(AssertionError):
                    self.audit(packet)

    def test_offline_archive_reproduces_data_and_unknown_is_not_redistributed(self):
        archive_path = Path('docs/data/mlb-2025/mlb2025-zones-source-v87.zip')
        with zipfile.ZipFile(archive_path) as archive:
            source = {name: archive.read(name) for name in archive.namelist()}
        data, rebuilt_archive = reference.build(source)
        self.assertEqual(archive_path.read_bytes(), rebuilt_archive)
        self.assertEqual(Path('docs/demos/mlb-2025-course-reference-v87.json').read_bytes(), data)
        ref = json.loads(data)
        self.assertEqual([z['zoneId'] for z in ref['zones']], reference.ZONE_IDS)
        self.assertEqual(ref['unknown']['hits'], 10)
        self.assertEqual(ref['unknown']['atBats'], 63)
        self.assertEqual(sum(z['hits'] for z in ref['zones']) + 10, ref['total']['hits'])
        self.assertEqual(sum(z['atBats'] for z in ref['zones']) + 63, ref['total']['atBats'])

if __name__ == '__main__':
    unittest.main()
