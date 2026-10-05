"""Exercise the actual runner function with only newly created Python children."""
import ast
import os
import pathlib
import signal
import subprocess
import sys
import tempfile
import time
import types
import unittest

class ReplayOuterProcessOwnershipTests(unittest.TestCase):
    def exercise(self,signum=None):
        path=pathlib.Path(__file__).with_name('run-official-read-replay.py');module=ast.parse(path.read_text(),filename=str(path))
        names={'run_supervisor','interrupted'}
        body=[node for node in module.body if isinstance(node,ast.FunctionDef) and node.name in names]
        self.assertEqual({node.name for node in body},names)
        created=[]
        def spawn(*args,**kwargs):
            child=subprocess.Popen(*args,**kwargs);created.append(child)
            if signum is not None:os.kill(os.getpid(),signum)
            return child
        namespace=dict(os=os,signal=signal,time=time,pending_signal=None,
            subprocess=types.SimpleNamespace(Popen=spawn,STDOUT=subprocess.STDOUT,TimeoutExpired=subprocess.TimeoutExpired))
        exec(compile(ast.Module(body=body,type_ignores=[]),str(path),'exec'),namespace)
        previous={value:signal.getsignal(value) for value in [signal.SIGTERM,signal.SIGINT]}
        result=None;raised=None;alive=False
        try:
            for value in previous:signal.signal(value,namespace['interrupted'])
            with tempfile.TemporaryDirectory(prefix='replay-owned-child-') as directory, open(os.devnull,'w') as log, tempfile.TemporaryFile() as light:
                code='import time;time.sleep(30)' if signum is not None else 'pass'
                try:result=namespace['run_supervisor']([sys.executable,'-c',code],pathlib.Path(directory),log,2,light.fileno())
                except BaseException as error:raised=error
                alive=any(child.poll() is None for child in created)
        finally:
            for value,handler in previous.items():signal.signal(value,handler)
            # Even the intended RED must leave no child alive after this test.
            for child in created:
                if child.poll() is None:
                    try:os.killpg(child.pid,signal.SIGKILL)
                    except ProcessLookupError:pass
                child.wait(timeout=3)
        self.assertEqual(len(created),1)
        self.assertFalse(alive,'runner abandoned its already-created child before assigning ownership')
        self.assertIsNone(raised,'signal escaped the owned-child cleanup boundary')
        self.assertIsNotNone(result)
        child,exit_code,guard=result
        self.assertIs(child,created[0]);self.assertIsNotNone(child.returncode)
        if signum is None:self.assertEqual(exit_code,0);self.assertIsNone(guard)
        else:self.assertIsNotNone(guard);self.assertNotEqual(exit_code,0)
    def test_normal_supervisor_is_reaped(self):self.exercise()
    def test_sigterm_during_creation_keeps_owned_cleanup(self):self.exercise(signal.SIGTERM)
    def test_sigint_during_creation_keeps_owned_cleanup(self):self.exercise(signal.SIGINT)

if __name__=='__main__':unittest.main()
