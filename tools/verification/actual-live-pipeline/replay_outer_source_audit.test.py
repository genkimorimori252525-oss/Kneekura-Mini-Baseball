"""Actual-file controls for the outer source_check, without launching its CLI.

Only git's HEAD result is supplied. Production function bodies are compiled from
the runner AST; all manifest/config/source path and byte operations are real.
"""
import ast
import hashlib
import json
import os
import pathlib
import tempfile
import types
import unittest

class ReplayOuterSourceAuditTests(unittest.TestCase):
    def setUp(self):
        self.directory=tempfile.TemporaryDirectory(prefix='replay-outer-source-')
        self.root=pathlib.Path(self.directory.name)
        self.owner=self.root/'owner.ts';self.owner.write_text('export const value=1;\n')
        self.manifest_path=self.root/'source-manifest.json'
        self.manifest={'files':[{'path':'owner.ts','sha256':hashlib.sha256(self.owner.read_bytes()).hexdigest()}]}
        self.manifest_path.write_text(json.dumps(self.manifest)+'\n')
        self.config_path=self.root/'config.json'
        self.config={'sourceCommit':'a'*40,'sourceManifestPath':str(self.manifest_path),'sourceManifestSha256':hashlib.sha256(self.manifest_path.read_bytes()).hexdigest()}
        self.config_path.write_text(json.dumps(self.config)+'\n')
        path=pathlib.Path(__file__).with_name('run-official-read-replay.py')
        module=ast.parse(path.read_text(),filename=str(path))
        names={'checked','sha','read_pin','read_ref','source_check'}
        body=[node for node in module.body if isinstance(node,ast.FunctionDef) and node.name in names]
        self.assertEqual({node.name for node in body},names)
        namespace=dict(pathlib=pathlib,os=os,hashlib=hashlib,json=json,root=self.root,manifest=self.manifest,c=self.config,
            config_path=self.config_path,config_pin={'sha256':hashlib.sha256(self.config_path.read_bytes()).hexdigest()},
            subprocess=types.SimpleNamespace(check_output=lambda *args,**kwargs:'a'*40+'\n'))
        exec(compile(ast.Module(body=body,type_ignores=[]),str(path),'exec'),namespace)
        self.check=namespace['source_check'];self.check()
    def tearDown(self):self.directory.cleanup()
    def test_accepts_unchanged_manifest_config_and_source(self):self.check()
    def test_rejects_manifest_byte_drift_after_initial_read(self):
        self.manifest_path.write_bytes(self.manifest_path.read_bytes()+b'\n')
        with self.assertRaises(AssertionError):self.check()
    def test_rejects_manifest_symlink_replacement_with_identical_bytes(self):
        other=self.root/'replacement.json';other.write_bytes(self.manifest_path.read_bytes())
        self.manifest_path.unlink();self.manifest_path.symlink_to(other)
        with self.assertRaises(AssertionError):self.check()
    def test_rejects_source_byte_drift(self):
        self.owner.write_text('export const value=2;\n')
        with self.assertRaises(AssertionError):self.check()
    def test_rejects_configuration_byte_drift(self):
        self.config_path.write_bytes(self.config_path.read_bytes()+b'\n')
        with self.assertRaises(AssertionError):self.check()

if __name__=='__main__':unittest.main()
