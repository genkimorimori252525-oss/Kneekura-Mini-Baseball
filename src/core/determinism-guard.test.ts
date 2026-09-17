import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const FORBIDDEN = ['Math.random', 'Date.now', 'new Date(', 'performance.now', "from 'three'", 'from "three"', 'document.', 'window.'];

function listSourceFiles(dir: string): string[] {
  const output: string[] = [];
  for (const name of readdirSync(dir)) {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) output.push(...listSourceFiles(path));
    else if (path.endsWith('.ts') && !path.endsWith('.test.ts')) output.push(path);
  }
  return output;
}

function presentationImports(source: string): string[] {
  return [...source.matchAll(/from\s+['"]([^'"]+)['"]/g)]
    .map((match) => match[1])
    .filter((path) => /(^|\/)(render|ui|presentation)\//.test(path));
}

describe('core determinism boundary', () => {
  it('the import probe really detects presentation dependencies', () => {
    expect(presentationImports("import type { X } from '../presentation/X';")).toEqual(['../presentation/X']);
  });

  it('contains no forbidden nondeterministic/browser tokens', () => {
    const files = listSourceFiles(join(process.cwd(), 'src', 'core'));
    expect(files.length).toBeGreaterThan(0);
    for (const file of files) {
      const source = readFileSync(file, 'utf-8');
      for (const token of FORBIDDEN) expect(source.includes(token), `${file} contains ${token}`).toBe(false);
    }
  });

  it('does not import render, ui, or presentation code', () => {
    const violations: string[] = [];
    for (const file of listSourceFiles(join(process.cwd(), 'src', 'core'))) {
      const source = readFileSync(file, 'utf-8');
      for (const dependency of presentationImports(source)) violations.push(`${file} -> ${dependency}`);
    }
    expect(violations).toEqual([]);
  });
});
