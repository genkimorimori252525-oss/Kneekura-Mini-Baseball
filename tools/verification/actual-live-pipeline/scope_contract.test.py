import copy
import unittest
from scope_contract import validate_scope_terminal

ALL = dict(officialStarted=1, officialCompleted=1, roleStarted=1, roleCompleted=1, nextStarted=1, nextCompleted=1)
OFFICIAL = dict(ALL, roleStarted=0, roleCompleted=0, nextStarted=0, nextCompleted=0)
NONE = {key: 0 for key in ALL}
def receipt(stage):
    return dict(stage=stage, path=f'/{stage}.receipt.json', sha256='a' * 64)
def terminal(scope):
    status, counts, remaining, names = {
        'all': ('passed', ALL, [], ['01-official', '02-role-workload', '03-next-actor-pitch']),
        'official': ('stage_passed', OFFICIAL, ['role', 'next'], ['01-official']),
        'supervisor_smoke': ('supervisor_smoke_passed', NONE, ['official', 'role', 'next'], []),
    }[scope]
    return dict(status=status, executionScope=scope, wholePipelinePassed=scope == 'all', remainingStages=remaining,
                counts=dict(counts), phaseReceipts=[receipt(name) for name in names], openSqliteHandles=[])

class ScopeTests(unittest.TestCase):
    def test_full_scope_passes(self):
        value=terminal('all'); self.assertEqual(validate_scope_terminal('all', value, value['phaseReceipts']), 'passed')
    def test_official_scope_is_partial(self):
        value=terminal('official'); self.assertEqual(validate_scope_terminal('official', value, value['phaseReceipts']), 'stage_passed')
    def test_smoke_scope_is_control_only(self):
        value=terminal('supervisor_smoke'); self.assertEqual(validate_scope_terminal('supervisor_smoke', value, []), 'supervisor_smoke_passed')
    def test_full_status_cannot_satisfy_official_scope(self):
        value=terminal('all')
        with self.assertRaises(AssertionError): validate_scope_terminal('official', value, value['phaseReceipts'])
    def test_wrong_config_scope_fails(self):
        value=terminal('all')
        with self.assertRaises(AssertionError): validate_scope_terminal('unknown', value, value['phaseReceipts'])
    def test_changed_fields_fail(self):
        for scope in ['all', 'official', 'supervisor_smoke']:
            for field, changed in [('executionScope', 'unknown'), ('wholePipelinePassed', None), ('remainingStages', ['made-up']), ('openSqliteHandles', [{'fd': 99}])]:
                value=terminal(scope); value[field]=changed
                with self.subTest(scope=scope, field=field), self.assertRaises(AssertionError):
                    validate_scope_terminal(scope, value, value['phaseReceipts'])
    def test_extra_missing_wrong_and_boolean_counts_fail(self):
        for scope in ['all', 'official', 'supervisor_smoke']:
            for mutation in ['extra', 'missing', 'changed', 'boolean']:
                value=terminal(scope)
                if mutation=='extra': value['counts']['forged']=0
                if mutation=='missing': del value['counts']['officialStarted']
                if mutation=='changed': value['counts']['officialStarted']+=1
                if mutation=='boolean': value['counts']['officialStarted']=bool(value['counts']['officialStarted'])
                with self.subTest(scope=scope, mutation=mutation), self.assertRaises(AssertionError):
                    validate_scope_terminal(scope, value, value['phaseReceipts'])
    def test_receipt_list_is_exact_and_audited(self):
        value=terminal('all')
        for audit in [[], value['phaseReceipts'][:-1], list(reversed(value['phaseReceipts'])), [dict(value['phaseReceipts'][0], sha256='b'*64), *value['phaseReceipts'][1:]]]:
            with self.subTest(audit=audit), self.assertRaises(AssertionError): validate_scope_terminal('all', value, audit)
    def test_duplicate_stage_receipts_fail(self):
        value=terminal('all'); value['phaseReceipts'][1]=copy.deepcopy(value['phaseReceipts'][0])
        with self.assertRaises(AssertionError): validate_scope_terminal('all', value, value['phaseReceipts'])

def continuation(scope):
    inherited = [receipt('01-official')] + ([receipt('02-role-workload')] if scope == 'next' else [])
    counts = dict(NONE); counts[scope+'Started'] = counts[scope+'Completed'] = 1
    return dict(status='stage_passed', executionScope=scope, wholePipelinePassed=False,
        remainingStages=['next'] if scope == 'role' else [], inheritedStages=['official'] if scope == 'role' else ['official','role'],
        inheritedStageReceipts=inherited, counts=counts,
        phaseReceipts=[receipt('02-role-workload' if scope == 'role' else '03-next-actor-pitch')], openSqliteHandles=[])

class ContinuationScopeTests(unittest.TestCase):
    def test_role_scope_is_partial_with_one_inherited_official(self):
        value=continuation('role')
        self.assertEqual(validate_scope_terminal('role',value,value['phaseReceipts'],value['inheritedStageReceipts']),'stage_passed')
    def test_next_scope_separates_two_inherited_proofs_from_one_new_helper(self):
        value=continuation('next')
        self.assertEqual(validate_scope_terminal('next',value,value['phaseReceipts'],value['inheritedStageReceipts']),'stage_passed')
    def test_missing_inherited_proof_fails(self):
        for scope in ['role','next']:
            value=continuation(scope)
            with self.subTest(scope=scope),self.assertRaises(AssertionError):
                validate_scope_terminal(scope,value,value['phaseReceipts'],[])
    def test_substituted_audited_inherited_proof_fails(self):
        for scope in ['role','next']:
            value=continuation(scope);audit=copy.deepcopy(value['inheritedStageReceipts']);audit[0]['sha256']='b'*64
            with self.subTest(scope=scope),self.assertRaises(AssertionError):
                validate_scope_terminal(scope,value,value['phaseReceipts'],audit)
    def test_prior_helper_cannot_be_counted_again(self):
        for scope in ['role','next']:
            value=continuation(scope);value['counts']['officialStarted']=value['counts']['officialCompleted']=1
            with self.subTest(scope=scope),self.assertRaises(AssertionError):
                validate_scope_terminal(scope,value,value['phaseReceipts'],value['inheritedStageReceipts'])
    def test_partial_run_cannot_claim_whole_pipeline_pass(self):
        value=continuation('next');value['wholePipelinePassed']=True
        with self.assertRaises(AssertionError):validate_scope_terminal('next',value,value['phaseReceipts'],value['inheritedStageReceipts'])
    def test_inherited_stage_order_and_duplicates_fail(self):
        for inherited in [[receipt('02-role-workload'),receipt('01-official')],[receipt('01-official'),receipt('01-official')]]:
            value=continuation('next');value['inheritedStageReceipts']=inherited
            with self.subTest(inherited=inherited),self.assertRaises(AssertionError):
                validate_scope_terminal('next',value,value['phaseReceipts'],inherited)
    def test_inherited_stage_labels_must_match_proofs(self):
        value=continuation('role');value['inheritedStages']=[]
        with self.assertRaises(AssertionError):validate_scope_terminal('role',value,value['phaseReceipts'],value['inheritedStageReceipts'])
    def test_current_count_types_and_shape_are_strict(self):
        for mutation in ['boolean','extra','missing']:
            value=continuation('role')
            if mutation=='boolean':value['counts']['roleCompleted']=True
            if mutation=='extra':value['counts']['fake']=0
            if mutation=='missing':del value['counts']['nextCompleted']
            with self.subTest(mutation=mutation),self.assertRaises(AssertionError):
                validate_scope_terminal('role',value,value['phaseReceipts'],value['inheritedStageReceipts'])
    def test_current_stage_receipts_cannot_include_inherited_receipts(self):
        value=continuation('role');value['phaseReceipts'].insert(0,receipt('01-official'))
        with self.assertRaises(AssertionError):validate_scope_terminal('role',value,value['phaseReceipts'],value['inheritedStageReceipts'])
    def test_same_attempt_full_mode_cannot_substitute_inherited_proofs(self):
        value=terminal('all');value['inheritedStageReceipts']=[receipt('01-official')]
        with self.assertRaises(AssertionError):validate_scope_terminal('all',value,value['phaseReceipts'],value['inheritedStageReceipts'])

if __name__ == '__main__': unittest.main()
