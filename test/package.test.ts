import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { writeFileSync, mkdirSync, readFileSync, renameSync, existsSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { directory } from './helpers.ts';

test('生产压缩包可独立安装：只发布JS，SDK和命令行迁移均可用，不带私人数据', t => {
  const temporary = directory(t), root = resolve(import.meta.dirname, '..');
  const npm = process.env.npm_execpath;
  assert(npm, '通过 npm test 或 npm run check 执行安装验收');
  const runNpm = (args: string[], cwd: string) => execFileSync(process.execPath, [npm, ...args], {
    cwd, encoding: 'utf8', windowsHide: true, timeout: 60000,
  });
  const packed = JSON.parse(runNpm(['pack', '--ignore-scripts', '--json', '--pack-destination', temporary], root))[0];
  assert(packed.files.every((x: { path: string }) => !/(?:^|\/)(?:data|node_modules|\.qa|\.soul|\.env)(?:\/|$)|\.sqlite/u.test(x.path)));
  assert(packed.files.every((x: { path: string }) => !x.path.endsWith('.ts') || x.path.endsWith('.d.ts')));
  writeFileSync(join(temporary, 'package.json'), JSON.stringify({ name: 'fictional-install-fixture', version: '1.0.0', type: 'module', private: true }));
  runNpm(['install', join(temporary, packed.filename), '--omit=dev', '--omit=peer', '--ignore-scripts', '--no-audit', '--no-fund'], temporary);
  const dataDir = join(temporary, 'fictional-data'), restoredDir = join(temporary, 'restored-data');
  const js = `import {SoulCore} from '@animaseed/core';
    const memory=new SoulCore({dataDir:process.argv[1]});
    memory.name({name:'安装测试身份',namedBy:'测试者',sessionId:'test',messageId:'birth',text:'给你起名：安装测试身份'});
    const source=memory.observe({sessionId:'test',messageId:'1',role:'user',text:'我喜欢海风'});
    memory.sleep(); console.log(JSON.stringify({identity:memory.lifecycle(),source:source.id})); memory.close();`;
  const installed = JSON.parse(execFileSync(process.execPath, ['--input-type=module', '-e', js, dataDir], {
    cwd: temporary, encoding: 'utf8', windowsHide: true, timeout: 10000,
  }));
  const bin = join(temporary, 'node_modules/@animaseed/core/dist/cli/main.js');
  const env = { ...process.env, FICTIONAL_TRANSFER_PASSWORD: 'local-test-password-only-1234' };
  const cli = (args: string[]) => JSON.parse(execFileSync(process.execPath, [bin, ...args], {
    cwd: temporary, encoding: 'utf8', windowsHide: true, timeout: 10000, env,
  }));
  const exported = join(temporary, 'fixture.memory.enc');
  cli(['export', '--data', dataDir, '--file', exported, '--password-env', 'FICTIONAL_TRANSFER_PASSWORD']);
  const restored = cli(['import', '--data', restoredDir, '--file', exported, '--password-env', 'FICTIONAL_TRANSFER_PASSWORD']);
  assert.equal(restored.lifecycle.id, installed.identity.id);
  assert(cli(['recall', '--data', restoredDir, '--text', '海风']).memories.some((x: { memory: { text: string } }) => x.memory.text.includes('海风')));
  const workspace = join(temporary, 'workspace'); mkdirSync(workspace);
  const created = cli(['workspace-init', '--workspace', workspace]);
  assert(created.namingRequired);
  const guide = readFileSync(created.guide, 'utf8');
  assert(guide.includes(JSON.stringify(bin))); assert(!guide.includes('dist/cli/main.ts'));
  const talk = (command: string, body: unknown) => JSON.parse(execFileSync(process.execPath,
    [bin, command, '--workspace', workspace, '--file', '-'], {
      cwd: temporary, encoding: 'utf8', input: JSON.stringify(body), windowsHide: true, timeout: 10000,
    }));
  const named = talk('workspace-receive', { sessionId: 'chat-one', messageId: 'birth', text: '给你起名：小岚' });
  const received = talk('workspace-receive', { sessionId: 'chat-one', messageId: 'user-1', text: '下次一起聊星星。' });
  const reply = talk('workspace-reply', { sessionId: 'chat-one', messageId: 'reply-1', inReplyTo: received.sourceId, text: '好呀，星星是什么样的？' });
  const interest = talk('workspace-record', { kind: 'interest', topic: '星星', text: '想下次继续了解星星',
    citations: [{ type: 'memory', id: received.sourceId, quote: '下次一起聊星星。' }] });
  const reopened = cli(['workspace-open', '--workspace', workspace, '--text', '继续聊']);
  assert.equal(reopened.soulId, named.soulId); assert.equal(reopened.namingRequired, false);
  assert(reopened.context.text.includes(interest.text));
  assert.equal(cli(['workspace-read', '--workspace', workspace, '--type', 'memory', '--id', reply.id]).text, reply.text);
  const start = () => execFileSync(process.execPath, [bin, 'start', '--workspace', workspace], {
    cwd: temporary, encoding: 'utf8', windowsHide: true, timeout: 10000, stdio: ['pipe', 'pipe', 'pipe'],
  });
  assert(start().includes('小岚的人生档案已载入'));
  const database = join(workspace, 'data/soul/memory.sqlite');
  renameSync(database, database + '.saved');
  assert.throws(start, error => String((error as { stderr: unknown }).stderr).includes('档案缺失'));
  assert(!existsSync(database));
  renameSync(database + '.saved', database);
});
