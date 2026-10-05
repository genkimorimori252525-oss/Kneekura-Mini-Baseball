"""Exact terminal scope validation for the three supported verification modes."""
def validate_scope_terminal(scope, terminal, receipts):
    assert scope in ['all', 'official', 'supervisor_smoke'], 'unsupported execution scope'
    assert isinstance(terminal, dict), 'terminal missing'
    status = {'all': 'passed', 'official': 'stage_passed', 'supervisor_smoke': 'supervisor_smoke_passed'}[scope]
    assert terminal.get('status') == status and terminal.get('executionScope') == scope, 'terminal scope/status differs'
    assert terminal.get('wholePipelinePassed') is (scope == 'all'), 'whole-pipeline claim differs'
    remaining = [] if scope == 'all' else ['role', 'next'] if scope == 'official' else ['official', 'role', 'next']
    assert terminal.get('remainingStages') == remaining, 'remaining stages differ'
    first, later = int(scope != 'supervisor_smoke'), int(scope == 'all')
    expected = dict(officialStarted=first, officialCompleted=first, roleStarted=later, roleCompleted=later, nextStarted=later, nextCompleted=later)
    counts = terminal.get('counts')
    assert isinstance(counts, dict) and counts == expected and all(type(value) is int for value in counts.values()), 'actual helper counts differ'
    stages = ['01-official', '02-role-workload', '03-next-actor-pitch'] if scope == 'all' else ['01-official'] if scope == 'official' else []
    assert isinstance(receipts, list) and all(isinstance(value, dict) for value in receipts), 'audited receipts missing'
    assert [value.get('stage') for value in receipts] == stages, 'audited receipt stages differ'
    assert terminal.get('phaseReceipts') == receipts, 'terminal receipts differ from audited receipts'
    assert terminal.get('openSqliteHandles') == [], 'artifact handles remain open'
    return status
