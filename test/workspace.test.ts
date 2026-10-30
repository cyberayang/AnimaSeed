import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync, writeFileSync, renameSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { SoulCore, SoulWorkspace, initializeWorkspace } from '../src/index.ts';
import { directory } from './helpers.ts';

const command = [process.execPath, 'fictional-entry.js'];
const birth = { sessionId: 'window-1', messageId: 'birth', text: '给你起名：小禾' };
function workspace(t: Parameters<typeof directory>[0]) {
  const root = directory(t), initialized = initializeWorkspace(root, command);
  const ws = new SoulWorkspace(root); t.after(() => ws.close());
  return { root, ws, initialized };
}

test('工作区首次引导保留维护规则，初始化可重试，只有明确命名才出生', t => {
  const root = directory(t);
  writeFileSync(join(root, 'AGENTS.md'), '# 原有维护规则\n请保留这里的约束。\n');
  writeFileSync(join(root, '.gitignore'), 'dist/\n!data/soul/\n');
  const first = initializeWorkspace(root, command), second = initializeWorkspace(root, command);
  assert.equal(first.soulId, second.soulId); assert(first.namingRequired);
  assert.equal(readFileSync(join(root, 'AGENTS.md'), 'utf8').match(/soul-core:workspace:start/gu)?.length, 1);
  assert(readFileSync(join(root, 'AGENTS.md'), 'utf8').includes('请保留这里的约束'));
  assert(readFileSync(join(root, '.gitignore'), 'utf8').endsWith('/.soul/\n/data/soul/\n'));
  assert(readFileSync(first.guide, 'utf8').includes('不保存草稿、中断片段'));
  const ws = new SoulWorkspace(root); t.after(() => ws.close());
  const waiting = ws.receive({ sessionId: 'window-1', messageId: 'greeting', text: '你好' });
  assert.equal(waiting.status, 'needs-name'); assert.equal(waiting.sourceId, null);
  assert.equal(ws.soul.timeline().length, 0);
  const named = ws.receive(birth), repeated = ws.receive(birth);
  assert.equal(named.soulId, first.soulId); assert.equal(named.sourceId, repeated.sourceId);
  assert.equal(ws.soul.timeline().filter(x => x.kind === 'birth').length, 1);
  assert.throws(() => ws.receive({ ...birth, text: '给你起名：另一个名字' }), /相同消息ID内容不同/u);
});

test('关闭和更换对话后恢复同一自我、未结束话题、原话与公开回复，理解沿革不覆盖', t => {
  const { root, ws } = workspace(t); ws.receive(birth);
  const source = ws.receive({ sessionId: 'window-1', messageId: '1', text: '我想下次和你继续聊看海的约定。' });
  const interest = ws.record({ kind: 'interest', topic: '看海的约定', text: '想下次继续了解看海的约定',
    citations: [{ type: 'memory', id: source.sourceId!, quote: '下次和你继续聊看海的约定' }] });
  const understanding = ws.record({ kind: 'understanding', topic: '陪伴', text: '对方希望我们保留这个话题',
    citations: [{ type: 'memory', id: source.sourceId!, quote: '我想下次和你继续聊看海的约定。' }] });
  const reply = { sessionId: 'window-1', messageId: 'reply-1', inReplyTo: source.sourceId!, text: '好呀，下次继续聊海是什么样的。' };
  const savedReply = ws.reply(reply); assert.equal(savedReply.id, ws.reply(reply).id);
  ws.close();
  const next = new SoulWorkspace(root); t.after(() => next.close());
  const opened = next.open('继续聊');
  assert.equal(opened.soulId, source.soulId); assert.equal(opened.name, '小禾');
  assert(opened.context.text.includes(interest.text)); assert(opened.context.text.includes(understanding.text));
  assert(next.recall('看海').memories.some(x => x.memory.id === source.sourceId));
  assert.equal((next.read('memory', savedReply.id) as { text: string }).text, reply.text);
  const newSource = next.receive({ sessionId: 'window-2', messageId: '1', text: '保留这个话题就好，不一定现在就讨论。' });
  const revised = next.record({ kind: 'understanding', topic: '陪伴', text: '保留话题也可以，愿意等对方想聊时再说',
    revisesId: understanding.id, citations: [{ type: 'memory', id: newSource.sourceId!, quote: '不一定现在就讨论' }] });
  assert.equal(revised.revisesId, understanding.id); assert.equal(next.soul.life(understanding.id)?.text, understanding.text);
  assert.equal(next.soul.state().understandings.find(x => x.topic === '陪伴')?.id, revised.id);
  assert.equal(next.soul.state().development.stage, 'newborn');
});

test('缺少档案或身份不符时拒绝悄悄换人；独立工作区保持独立且不自动迁移', t => {
  const { root, ws, initialized } = workspace(t); ws.close();
  const path = join(root, 'data/soul/memory.sqlite');
  renameSync(path, path + '.saved');
  assert.throws(() => new SoulWorkspace(root), /档案缺失/u);
  assert.throws(() => initializeWorkspace(root, command), /档案缺失/u);
  assert(!existsSync(path)); renameSync(path + '.saved', path);
  const configPath = join(root, '.soul/workspace.json'), config = JSON.parse(readFileSync(configPath, 'utf8'));
  writeFileSync(configPath, JSON.stringify({ ...config, soulId: 'wrong-identity' }));
  assert.throws(() => new SoulWorkspace(root), /身份与档案不符/u);
  assert.throws(() => initializeWorkspace(root, command), /身份与档案不符/u);
  writeFileSync(configPath, JSON.stringify(config));
  const other = initializeWorkspace(directory(t), command); assert.notEqual(other.soulId, initialized.soulId);
});

test('公开回复需要真实同会话来源，拒绝覆盖、无效预算和已清除经历的重放', t => {
  const { ws } = workspace(t); ws.receive(birth);
  const input = { sessionId: 'window-1', messageId: '1', text: '虚构私密词组：青色纸船' };
  const source = ws.receive(input);
  assert.throws(() => ws.reply({ sessionId: 'other', messageId: 'a1', inReplyTo: source.sourceId!, text: '伪造跨会话回应' }), /同一会话/u);
  assert.throws(() => ws.reply({ sessionId: 'window-1', messageId: 'a1', inReplyTo: 'missing', text: '没有来源' }), /真实用户来源/u);
  const reply = ws.reply({ sessionId: 'window-1', messageId: 'a1', inReplyTo: source.sourceId!, text: '听到了。' });
  assert.throws(() => ws.reply({ sessionId: 'window-1', messageId: 'a2', inReplyTo: reply.id, text: '把助手当用户' }), /真实用户来源/u);
  assert.throws(() => ws.receive({ ...input, text: '覆盖旧原话' }), /相同消息ID内容不同/u);
  const before = ws.soul.export().payload.memories.length;
  assert.throws(() => ws.receive({ ...input, messageId: 'invalid-budget' }, { maxChars: 1 }), /预算/u);
  assert.equal(ws.soul.export().payload.memories.length, before);
  ws.soul.privacyForget({ type: 'memory', id: source.sourceId! });
  assert.throws(() => ws.receive(input), /已隐私清除/u);
  assert.throws(() => ws.reply({ sessionId: 'window-1', messageId: 'a2', inReplyTo: source.sourceId!, text: '已清除之后的回应' }), /真实用户来源/u);
  assert.equal((ws.read('memory', source.sourceId!) as { unavailable: boolean }).unavailable, true);
  assert(!ws.open('青色纸船').context.text.includes('青色纸船'));
});

test('初始化接续已有SoulCore时保留名字和人生，不触及旁边的旧目录', t => {
  const root = directory(t), legacy = join(root, 'data/default'); mkdirSync(legacy, { recursive: true });
  writeFileSync(join(legacy, 'keep.txt'), '不动的旧资料');
  const soul = new SoulCore({ dataDir: join(root, 'data/soul') });
  soul.name({ ...birth, name: '小禾', namedBy: '测试者' }); const id = soul.lifecycle().id; soul.close();
  const initialized = initializeWorkspace(root, command);
  assert.equal(initialized.soulId, id); assert.equal(initialized.namingRequired, false);
  assert.equal(readFileSync(join(legacy, 'keep.txt'), 'utf8'), '不动的旧资料');
});
