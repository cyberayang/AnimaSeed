import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { MemoryCore } from '../src/index.ts';
import { fixture } from './helpers.ts';

test('重开窗口延续身份、事实和未结束话题', t => {
  const f = fixture(t), source = f.say('我喜欢安静，下次继续聊山里的旅行');
  const fact = f.core.remember({ kind: 'fact', text: '用户喜欢安静', citations: [{ id: source.id, quote: '我喜欢安静' }], pinned: true });
  f.core.remember({ kind: 'commitment', text: '下次继续聊山里的旅行', citations: [{ id: source.id, quote: '下次继续聊山里的旅行' }] });
  const identity = f.core.identity(); f.core.close();
  const reopened = new MemoryCore(f.options); t.after(() => reopened.close());
  assert.deepEqual(reopened.identity(), identity);
  assert(reopened.context('上次聊到哪里').text.includes('下次继续聊山里的旅行'));
  assert(reopened.recall('喜欢安静').some(x => x.memory.id === fact.id));
  identity.name = '外部修改';
  assert.notEqual(reopened.identity().name, '外部修改');
});
test('拒绝助手自说自话、伪造证据和原件覆盖', t => {
  const f = fixture(t), source = f.say('你来自哪里？', { role: 'assistant' });
  assert.throws(() => f.core.remember({ kind: 'fact', text: '用户来自月球', citations: [{ id: source.id, quote: source.text }] }), /用户原始经历/u);
  const user = f.say('我来自杭州');
  assert.throws(() => f.core.remember({ kind: 'fact', text: '用户来自杭州', citations: [{ id: user.id, quote: '我来自北京' }] }), /引文/u);
  assert.throws(() => f.core.observe({ sessionId: user.sessionId!, messageId: '2', role: 'user', text: '我来自北京' }), /拒绝覆盖/u);
  assert.equal(f.core.observe({ sessionId: user.sessionId!, messageId: '2', role: 'user', text: user.text }).id, user.id);
});
test('显式纠正替换旧事实并使所有旧摘要停止召回', t => {
  const f = fixture(t), old = f.say('我住在杭州');
  const fact = f.core.remember({ kind: 'fact', key: 'owner.city', text: '用户住在杭州', citations: [{ id: old.id, quote: old.text }] });
  const summary = f.core.remember({ kind: 'summary', text: '杭州的生活', citations: [{ id: fact.id, quote: fact.text }] });
  const fresh = f.say('纠正：我现在住在苏州');
  const fixed = f.core.correct(fact.id, '用户现在住在苏州', [{ id: fresh.id, quote: fresh.text }]);
  assert.equal(f.core.get(summary.id)?.status, 'superseded');
  assert.equal(f.core.get(old.id)?.status, 'superseded');
  assert(!f.core.recall('杭州').some(x => x.memory.text.includes('杭州')));
  assert(f.core.context('我住哪里').text.includes(fixed.text));
  assert(!f.core.context('我住哪里').text.includes('我住在杭州'));
});
test('过期从来源传播到多级摘要，固定记忆也不绕过明确到期', t => {
  const f = fixture(t), source = f.say('今天预约下午两点', { expiresAt: '2026-10-31T00:00:00.000Z' });
  const fact = f.core.remember({ kind: 'fact', pinned: true, text: source.text, citations: [{ id: source.id, quote: source.text }] });
  const summary = f.core.remember({ kind: 'summary', text: '当天预约', citations: [{ id: fact.id, quote: fact.text }] });
  f.time('2026-11-01T00:00:00.000Z');
  assert.equal(f.core.recall('预约').length, 0);
  assert.equal(f.core.get(summary.id)?.status, 'expired');
});
test('遗忘清除来源、摘要、情绪以及迁移包内容；重复消息不能复活', t => {
  const f = fixture(t), secret = '私密标记青瓷小舟七九三';
  const source = f.say(secret), fact = f.core.remember({ kind: 'fact', text: secret, citations: [{ id: source.id, quote: secret }] });
  f.core.appraise({ valence: 0.1, arousal: 0.1, trust: 0.01, why: secret, citations: [{ id: source.id, quote: secret }] });
  f.core.remember({ kind: 'summary', text: secret, citations: [{ id: fact.id, quote: secret }] });
  f.core.forget(fact.id);
  assert(!JSON.stringify(f.core.export()).includes(secret));
  assert.equal(f.core.state().appraisals.length, 0);
  assert.equal(f.core.recall(secret).length, 0);
  assert.equal(f.core.observe({ sessionId: source.sessionId!, messageId: '1', role: 'user', text: secret }).status, 'forgotten');
  assert(!readFileSync(join(f.dataDir, 'memory.sqlite')).includes(Buffer.from(secret)));
});
test('语义冲突不能被自动整理悄悄覆盖，事务失败不留下部分条目', async t => {
  const f = fixture(t), a = f.say('我喜欢红色'), b = f.say('我喜欢蓝色');
  f.core.remember({ kind: 'fact', key: 'color', text: a.text, citations: [{ id: a.id, quote: a.text }] });
  const before = f.core.records().length;
  await assert.rejects(f.core.consolidate(async () => ({ memories: [
    { kind: 'reflection', text: '需要确认颜色', citations: [{ id: b.id, quote: b.text }] },
    { kind: 'fact', key: 'color', text: b.text, citations: [{ id: b.id, quote: b.text }] },
  ] })), /显式纠正/u);
  assert.equal(f.core.records().length, before);
});
test('30天小事自然淡出，长期事实的原件保留有效', t => {
  const f = fixture(t), small = f.say('刚才喝了一口水'), important = f.say('我喜欢听雨');
  const fact = f.core.remember({ kind: 'fact', text: important.text, citations: [{ id: important.id, quote: important.text }], pinned: true });
  f.time('2026-12-01T09:00:00.000Z'); f.core.sleep();
  assert.equal(f.core.get(small.id)?.status, 'expired');
  assert.equal(f.core.get(important.id)?.status, 'active');
  assert.equal(f.core.get(fact.id)?.status, 'active');
});
