"""Exact current-attempt counts and separately audited inherited stage references."""
def validate_scope_terminal(scope, terminal, receipts, inherited_receipts=None):
    assert scope in ['all', 'official', 'supervisor_smoke', 'role', 'next'], 'unsupported execution scope'
    assert isinstance(terminal, dict), 'terminal missing'
    inherited_receipts = [] if inherited_receipts is None else inherited_receipts
    status = 'passed' if scope == 'all' else 'supervisor_smoke_passed' if scope == 'supervisor_smoke' else 'stage_passed'
    assert terminal.get('status') == status and terminal.get('executionScope') == scope, 'terminal scope/status differs'
    assert terminal.get('wholePipelinePassed') is (scope == 'all'), 'whole-pipeline claim differs'
    remaining = [] if scope in ['all', 'next'] else ['role', 'next'] if scope == 'official' else ['next'] if scope == 'role' else ['official', 'role', 'next']
    assert terminal.get('remainingStages') == remaining, 'remaining stages differ'
    first = int(scope in ['all', 'official']); role = int(scope in ['all', 'role']); next_stage = int(scope in ['all', 'next'])
    expected = dict(officialStarted=first, officialCompleted=first, roleStarted=role, roleCompleted=role, nextStarted=next_stage, nextCompleted=next_stage)
    counts = terminal.get('counts')
    assert isinstance(counts, dict) and counts == expected and all(type(value) is int for value in counts.values()), 'actual helper counts differ'
    stages = ['01-official', '02-role-workload', '03-next-actor-pitch'] if scope == 'all' else ['01-official'] if scope == 'official' else ['02-role-workload'] if scope == 'role' else ['03-next-actor-pitch'] if scope == 'next' else []
    assert isinstance(receipts, list) and all(isinstance(value, dict) for value in receipts), 'audited receipts missing'
    assert [value.get('stage') for value in receipts] == stages, 'audited receipt stages differ'
    assert terminal.get('phaseReceipts') == receipts, 'terminal receipts differ from audited receipts'
    inherited = ['01-official'] if scope == 'role' else ['01-official', '02-role-workload'] if scope == 'next' else []
    assert isinstance(inherited_receipts, list) and all(isinstance(value, dict) for value in inherited_receipts), 'audited inherited receipts missing'
    assert [value.get('stage') for value in inherited_receipts] == inherited, 'audited inherited stages differ'
    if inherited:
        assert terminal.get('inheritedStages') == (['official'] if scope == 'role' else ['official', 'role']), 'inherited labels differ'
        assert terminal.get('inheritedStageReceipts') == inherited_receipts, 'terminal inherited receipts differ from audited receipts'
    else:
        assert terminal.get('inheritedStageReceipts', []) == [] and terminal.get('inheritedStages', []) == [], 'same-attempt scope cannot inherit proofs'
    assert terminal.get('openSqliteHandles') == [], 'artifact handles remain open'
    return status
