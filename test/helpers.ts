import { mkdirSync, mkdtempSync, rmSync } from 'node:fs';
import { join, resolve, relative } from 'node:path';
import type { TestContext } from 'node:test';
import { after } from 'node:test';
import { MemoryCore } from '../src/index.ts';

export const qaRoot = resolve(import.meta.dirname, '../.qa');
const directories: string[] = [];
after(() => {
  for (const path of directories.reverse()) {
    const child = relative(qaRoot, resolve(path));
    if (!child || child.startsWith('..') || child.includes('/') || child.includes('\\')) throw new Error('测试清理路径超出QA目录');
    rmSync(path, { recursive: true, force: true });
  }
});
export function directory(t: TestContext): string {
  mkdirSync(qaRoot, { recursive: true });
  const path = mkdtempSync(join(qaRoot, 'case-'));
  directories.push(path);
  return path;
}
export function fixture(t: TestContext, at = '2026-10-30T09:00:00.000Z') {
  const dataDir = directory(t);
  let time = new Date(at);
  const options = { dataDir, clock: () => new Date(time) };
  const core = new MemoryCore(options);
  t.after(() => core.close());
  let seq = 0;
  return { core, options, dataDir,
    time: (next: string) => { time = new Date(next); },
    say: (text: string, extra: Partial<Parameters<MemoryCore['observe']>[0]> = {}) =>
      core.observe({ sessionId: 'fictional-session', messageId: String(++seq), role: 'user', text, ...extra }),
  };
}
