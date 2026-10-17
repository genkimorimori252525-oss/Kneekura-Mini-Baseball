import importlib.util
from pathlib import Path
import math, struct, unittest

spec = importlib.util.spec_from_file_location('vmd_bats', Path(__file__).with_name('import-vmd-bats.py'))
vmd = importlib.util.module_from_spec(spec)
spec.loader.exec_module(vmd)

def fixture(keys):
    header = b'Vocaloid Motion Data 0002'.ljust(30, b'\0') + b'test'.ljust(20, b'\0') + struct.pack('<I',len(keys))
    records = b''
    for name, frame, position, quaternion, curve in keys:
        records += name.encode('cp932').ljust(15,b'\0') + struct.pack('<I7f',frame,*position,*quaternion) + bytes(curve)
    return header + records + struct.pack('<I',0)

class MotionTests(unittest.TestCase):
    def test_bezier_linear_and_independent_channels(self):
        self.assertAlmostEqual(vmd.bezier_ratio((20,20,107,107),.37),.37,places=8)
        self.assertLess(vmd.bezier_ratio((100,0,127,40),.5),.3)

    def test_destination_key_curve_and_shortest_quaternion(self):
        curve = [20]*4 + [20]*4 + [107]*4 + [107]*4 + [0]*48
        data = fixture([('センター',30,(10,0,0),(0,0,0,-1),curve),('センター',0,(0,0,0),(0,0,0,1),curve)])
        model = vmd.parse_vmd(data)
        position, quaternion = vmd.sample_track(model['tracks']['センター'],15)
        self.assertAlmostEqual(position[0],5,places=8)
        self.assertAlmostEqual(abs(quaternion[3]),1,places=8)

    def test_rejects_corrupt_count_and_nonfinite_keys(self):
        curve=[0]*64
        with self.assertRaises(ValueError): vmd.parse_vmd(b'bad')
        data=fixture([('センター',0,(math.nan,0,0),(0,0,0,1),curve)])
        with self.assertRaises(ValueError): vmd.parse_vmd(data)
        data=fixture([('センター',0,(0,0,0),(0,0,0,1),curve)])
        with self.assertRaises(ValueError): vmd.parse_vmd(data[:60])

    def test_reflection_is_consistent_for_position_and_orientation(self):
        q=(0,math.sin(.3),0,math.cos(.3)); vector=(1,0,0)
        reflected=vmd.reflect(vmd.rotate(q,vector))
        converted=(-q[0],-q[1],q[2],q[3])
        actual=vmd.rotate(converted,vmd.reflect(vector))
        for a,b in zip(reflected,actual): self.assertAlmostEqual(a,b,places=12)

    def test_reference_rigid_bat_has_fixed_length_and_no_body(self):
        curve=[20]*4+[20]*4+[107]*4+[107]*4+[0]*48
        model=vmd.parse_vmd(fixture([('センター',0,(0,0,0),(0,0,0,1),curve),('センター',3,(1,0,0),(0,0,0,1),curve)]))
        frames=vmd.make_frames(model,bat_length=.84)
        self.assertGreater(len(frames),3)
        for frame in frames:
            distance=math.dist(tuple(frame['grip'].values()),tuple(frame['tip'].values()))
            self.assertAlmostEqual(distance,.84,places=8)
            self.assertNotIn('body',frame)
        self.assertGreater(frames[1]['sweetSpotVelocity']['x'],0)

    def test_ambiguous_ancestor_is_rejected_but_irrelevant_duplicate_is_not_used(self):
        curve=[0]*64
        keys=[('センター',0,(0,0,0),(0,0,0,1),curve)]*2
        with self.assertRaises(ValueError): vmd.make_frames(vmd.parse_vmd(fixture(keys)))
        keys=[('シャツ',0,(0,0,0),(0,0,0,1),curve)]*2
        model=vmd.parse_vmd(fixture(keys))
        self.assertEqual(model['ambiguousTracks'],['シャツ'])
        self.assertEqual(len(vmd.make_frames(model)),1)

    def test_composition_registers_rigidly_without_changing_local_path_shape(self):
        frame=lambda tick,x: {'tick':tick,'grip':{'x':x,'y':0,'z':0},'tip':{'x':x,'y':.84,'z':0},
          'sweetSpot':{'x':x,'y':.84*.72,'z':0},'orientation':{'x':0,'y':0,'z':0,'w':1},
          'sweetSpotVelocity':{'x':1,'y':0,'z':0}}
        first=[frame(0,0),frame(1000,1)]; second=[frame(0,10),frame(1000,12)]
        composed=vmd.compose_frames([first,second])
        self.assertEqual([f['tick'] for f in composed],[0,1000,2000])
        self.assertEqual([f['grip']['x'] for f in composed],[0,1,3])
        self.assertAlmostEqual(math.dist(tuple(composed[-1]['grip'].values()),tuple(composed[-1]['tip'].values())),.84)

    def test_composite_coverage_includes_later_segments(self):
        segments=[{'id':'a','usedAncestorTracks':['センター'],'unappliedPotentialParentTracks':[], 'ambiguousUnappliedTracks':[], 'sourceMorphs':[]},
          {'id':'b','usedAncestorTracks':['上半身2'],'unappliedPotentialParentTracks':['右肩C'],'ambiguousUnappliedTracks':['補助'],'sourceMorphs':[{'name':'test','frame':0,'weight':1}]}]
        metadata=vmd.composite_coverage(segments)
        self.assertEqual(metadata['usedAncestorTracks'],['センター','上半身2'])
        self.assertEqual(metadata['unappliedPotentialParentTracks'],['右肩C'])
        self.assertEqual(metadata['ambiguousUnappliedTracks'],['補助'])
        self.assertEqual(metadata['sourceMorphs'][0]['segmentId'],'b')

if __name__=='__main__': unittest.main()
