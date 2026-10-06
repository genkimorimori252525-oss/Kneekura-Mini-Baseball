"""One explicitly selected Python control file; never imported during preparation."""
import sys
if not sys.flags.isolated: raise SystemExit('Python control wrapper requires -I before non-builtin imports')
import json, os, pathlib, runpy, unittest
source = pathlib.Path(sys.argv[1]).resolve()
sys.path.insert(0, str(source.parent))
namespace = runpy.run_path(str(source), run_name='cumulative_control')
suite = unittest.TestSuite()
for value in namespace.values():
    if isinstance(value, type) and issubclass(value, unittest.TestCase) and value is not unittest.TestCase and value.__module__ == 'cumulative_control':
        suite.addTests(unittest.defaultTestLoader.loadTestsFromTestCase(value))
class Result(unittest.TextTestResult):
    def __init__(self, *args): super().__init__(*args); self.cases = []
    def addSuccess(self, test): super().addSuccess(test); self.cases.append({'name': test.id(), 'status': 'passed'})
    def addFailure(self, test, error): super().addFailure(test, error); self.cases.append({'name': test.id(), 'status': 'failed'})
    def addError(self, test, error): super().addError(test, error); self.cases.append({'name': test.id(), 'status': 'error'})
    def addSkip(self, test, reason): super().addSkip(test, reason); self.cases.append({'name': test.id(), 'status': 'skipped'})
    def addExpectedFailure(self, test, error): super().addExpectedFailure(test, error); self.cases.append({'name': test.id(), 'status': 'expected_failure'})
    def addUnexpectedSuccess(self, test): super().addUnexpectedSuccess(test); self.cases.append({'name': test.id(), 'status': 'unexpected_success'})
result = unittest.TextTestRunner(resultclass=Result, verbosity=2).run(suite)
with open(os.environ['BASEBALL_PYTHON_REPORT'], 'x') as stream:
    json.dump({'file': str(source), 'pid': os.getpid(), 'executable': sys.executable, 'pythonVersion': sys.version,
               'testsRun': result.testsRun, 'cases': result.cases, 'successful': result.wasSuccessful()}, stream, indent=2)
    stream.write('\n'); stream.flush(); os.fsync(stream.fileno())
raise SystemExit(0 if result.wasSuccessful() and not result.skipped else 1)
