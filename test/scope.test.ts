import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { parseScope, readScope, writeScope, SCOPE_FILE } from '../src/scope.ts';

const tmp = () => mkdtempSync(join(tmpdir(), 'animaseed-scope-'));

test('scope：默认 companion-only，未配置目录视为全记', () => {
  const s = parseScope({});
  assert.equal(s.scope, 'companion-only');
  assert.deepEqual(s.companionDirs, []);
  assert.deepEqual(s.excludeDirs, []);
});

test('scope：非法 scope 与相对路径被拒绝', () => {
  assert.throws(() => parseScope({ scope: 'weird' }), /companion-only/u);
  assert.throws(() => parseScope({ companionDirs: ['relative/dir'] }), /绝对路径/u);
  assert.throws(() => parseScope({ excludeDirs: ['a'] }), /绝对路径/u);
});

test('scope：写入后可读回，目录为绝对路径', () => {
  const dir = tmp();
  try {
    const abs = process.platform === 'win32' ? 'D:\\陪伴' : '/companion';
    const written = writeScope(dir, { scope: 'exclude', companionDirs: [abs], excludeDirs: [abs] });
    assert.equal(written.settings.scope, 'exclude');
    const read = readScope(dir);
    assert.deepEqual(read, { version: 1, scope: 'exclude', companionDirs: [abs], excludeDirs: [abs] });
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test('scope：未写入时读回 undefined；文件名为 scope.json', () => {
  const dir = tmp();
  try {
    assert.equal(readScope(dir), undefined);
    writeScope(dir, { scope: 'all' });
    assert.equal(readScope(dir)?.scope, 'all');
    assert.equal(SCOPE_FILE, 'scope.json');
  } finally { rmSync(dir, { recursive: true, force: true }); }
});
