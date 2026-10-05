import copy
import unittest
from replay_scope_contract import validate_role_read_replay_terminal

CURRENT = dict(stage='role-read-replay', path='/replay/receipt.json', sha256='a' * 64)
INHERITED = [dict(stage='01-official', path='/original/official.receipt.json', sha256='b' * 64),
             dict(stage='02-role-workload', path='/original/role.receipt.json', sha256='c' * 64)]
COUNTS = dict(officialStarted=0, officialCompleted=0, roleStarted=0, roleCompleted=0, nextStarted=0, nextCompleted=0)
EXECUTED = dict(readOnlyConnections=2, readTransactions=2, settlementReads=2, currentHeadReads=20,
                officialHelperCalls=0, roleHelperCalls=0, nextHelperCalls=0, newOfficialApplications=0, newWorkloadActivities=0, newPhysicalPitchActions=0)
def fixture():
    return dict(status='read_replay_passed', executionScope='role_read_replay', wholePipelinePassed=False,
                remainingStages=['next'], inheritedStages=['official','role'], counts=dict(COUNTS), executed=dict(EXECUTED),
                phaseReceipts=[dict(CURRENT)], inheritedStageReceipts=copy.deepcopy(INHERITED), openSqliteHandles=[])

class RoleReplayScopeTests(unittest.TestCase):
    def test_admits_two_reads_with_no_new_domain_helper(self):
        value=fixture()
        self.assertEqual(validate_role_read_replay_terminal(value,[CURRENT],INHERITED),'read_replay_passed')
    def test_retains_partial_status_with_original_official_proof(self):
        value=fixture()
        self.assertEqual(validate_role_read_replay_terminal(value,copy.deepcopy(value['phaseReceipts']),copy.deepcopy(value['inheritedStageReceipts'])),'read_replay_passed')
    def rejected(self, value, receipts=None, inherited=None):
        with self.assertRaises(AssertionError):
            validate_role_read_replay_terminal(value,[CURRENT] if receipts is None else receipts,INHERITED if inherited is None else inherited)
    def test_rejects_new_official_helper_count(self):
        value=fixture();value['counts']['officialCompleted']=1;self.rejected(value)
    def test_rejects_truthy_helper_count(self):
        value=fixture();value['counts']['roleCompleted']=False;self.rejected(value)
    def test_rejects_extra_helper_count(self):
        value=fixture();value['counts']['replay']=2;self.rejected(value)
    def test_rejects_missing_or_foreign_current_receipt(self):
        self.rejected(fixture(),receipts=[])
        self.rejected(fixture(),receipts=[dict(CURRENT,sha256='c'*64)])
    def test_rejects_missing_or_foreign_inherited_receipt(self):
        self.rejected(fixture(),inherited=[])
        self.rejected(fixture(),inherited=[dict(INHERITED[0],sha256='d'*64),INHERITED[1]])
    def test_rejects_wrong_stage_labels(self):
        value=fixture();value['inheritedStages']=[];self.rejected(value)
    def test_rejects_whole_pipeline_claim(self):
        value=fixture();value['wholePipelinePassed']=True;self.rejected(value)
    def test_rejects_wrong_remaining_stages(self):
        value=fixture();value['remainingStages']=[];self.rejected(value)
    def test_rejects_open_artifact_handle(self):
        value=fixture();value['openSqliteHandles']=[dict(fd=9)];self.rejected(value)
    def test_rejects_wrong_execution_counts(self):
        for field in EXECUTED:
            value=fixture();value['executed'][field]+=1;self.rejected(value)
    def test_rejects_boolean_execution_count(self):
        value=fixture();value['executed']['roleHelperCalls']=False;self.rejected(value)
    def test_rejects_domain_stage_status_or_scope(self):
        for field, changed in [('status','stage_passed'),('executionScope','role')]:
            value=fixture();value[field]=changed;self.rejected(value)

if __name__=='__main__':unittest.main()
