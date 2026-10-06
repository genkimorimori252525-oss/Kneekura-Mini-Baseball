def census():
    rows = {}
    for path in pathlib.Path('/proc').iterdir():
        if not path.name.isdigit(): continue
        try:
            fields = (path / 'stat').read_text().rsplit(') ', 1)[1].split()
            status = dict(line.split(':', 1) for line in (path / 'status').read_text().splitlines() if ':' in line)
            rows[int(path.name)] = dict(pid=int(path.name), ppid=int(fields[1]), processGroup=int(fields[2]),
                                       startTime=int(fields[19]), state=fields[0], rssKiB=int(status.get('VmRSS', '0 kB').split()[0]))
        except (FileNotFoundError, ProcessLookupError, ValueError, IndexError): pass
    return rows
def members(child, known):
    rows = census()
    owned = {pid for pid, started in known['generations'] if pid in rows and rows[pid]['startTime'] == started}
    root_identity = known['root']
    root_current = root_identity is not None and root_identity[0] in rows and rows[root_identity[0]]['startTime'] == root_identity[1]
    for pid, row in rows.items():
        if (root_current and row['processGroup'] == root_identity[0]) or row['ppid'] == os.getpid(): owned.add(pid)
    while True:
        expanded = owned | {pid for pid, row in rows.items() if row['ppid'] in owned}
        if expanded == owned: break
        owned = expanded
    known['generations'].update((pid, rows[pid]['startTime']) for pid in owned)
    return [rows[pid] for pid in sorted(owned)]
def signal_owned(pid, expected_start, sig):
    current = census().get(pid)
    if current is None or current['startTime'] != expected_start or current['state'] == 'Z': return
    descriptor = None
    try:
        descriptor = os.pidfd_open(pid)
        current = census().get(pid)
        if current is None or current['startTime'] != expected_start or current['state'] == 'Z': return
        signal.pidfd_send_signal(descriptor, sig)
    except ProcessLookupError: pass
    finally:
        if descriptor is not None: os.close(descriptor)
def stop(child, known):
    child.poll()
    for sig, grace in [(signal.SIGTERM, 3), (signal.SIGKILL, 3)]:
        for row in members(child, known):
            if row['state'] == 'Z': continue
            signal_owned(row['pid'], row['startTime'], sig)
        deadline = time.monotonic() + grace
        while time.monotonic() < deadline:
            child.poll()
            for row in members(child, known):
                if (row['pid'], row['startTime']) == known['root']: continue
                try: os.waitpid(row['pid'], os.WNOHANG)
                except ChildProcessError: pass
            if not members(child, known): break
            time.sleep(.025)
        if not members(child, known): break
    child.wait(timeout=1)

# Keep each stage history keyed by its Popen object, not its recyclable numeric PID.
# Immediately after Popen and before the first poll/census cleanup:
# children.append(child); knowns[child] = {'root': None, 'generations': set()}; receipt['childPid'] = child.pid
# initial = census().get(child.pid)
# assert initial is not None and initial['ppid'] == os.getpid() and initial['processGroup'] == child.pid, 'cannot pin initial owned root identity'
# knowns[child]['root'] = (child.pid, initial['startTime']); knowns[child]['generations'].add(knowns[child]['root'])
# receipt['rootStartTime'] = initial['startTime']
