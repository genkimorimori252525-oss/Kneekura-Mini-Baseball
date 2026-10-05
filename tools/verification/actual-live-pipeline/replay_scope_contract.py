"""Exact read-replay scope; ordinary domain-stage admission stays unchanged."""


def validate_official_read_replay_terminal(terminal, receipts, inherited_receipts):
    assert isinstance(terminal,dict), 'replay terminal missing'
    assert terminal.get('status')=='read_replay_passed' and terminal.get('executionScope')=='official_read_replay', 'replay scope/status differs'
    assert terminal.get('wholePipelinePassed') is False, 'read replay cannot claim the whole pipeline'
    assert terminal.get('remainingStages')==['role','next'] and terminal.get('inheritedStages')==['official'], 'replay stage labels differ'
    expected_counts=dict(officialStarted=0,officialCompleted=0,roleStarted=0,roleCompleted=0,nextStarted=0,nextCompleted=0)
    counts=terminal.get('counts')
    assert isinstance(counts,dict) and counts==expected_counts and all(type(value) is int for value in counts.values()), 'read replay executed a domain helper'
    expected_reads=dict(readOnlyConnections=2,readTransactions=2,roleContextReads=2,strictCurrentStageChecks=2,preparedPlanReads=2,
        officialHelperCalls=0,officialWrites=0,newOfficialApplications=0,newWorkloadActivities=0,newPhysicalPitchActions=0)
    executed=terminal.get('executed')
    assert isinstance(executed,dict) and executed==expected_reads and all(type(value) is int for value in executed.values()), 'actual replay operations differ'
    assert isinstance(receipts,list) and len(receipts)==1 and isinstance(receipts[0],dict) and receipts[0].get('stage')=='official-read-replay', 'audited replay receipt missing'
    assert terminal.get('phaseReceipts')==receipts, 'replay receipt differs from supervisor audit'
    assert isinstance(inherited_receipts,list) and len(inherited_receipts)==1 and isinstance(inherited_receipts[0],dict) and inherited_receipts[0].get('stage')=='01-official', 'audited original official proof missing'
    assert terminal.get('inheritedStageReceipts')==inherited_receipts, 'original official proof differs from supervisor audit'
    assert terminal.get('openSqliteHandles')==[], 'replay artifact handles remain open'
    return 'read_replay_passed'
