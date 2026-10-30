import test from 'node:test';
import assert from 'node:assert/strict';
import { SoulCore, MemoryCore, namingPhrase } from '../src/index.ts';
import { soulFixture } from './soul-helpers.ts';
import { directory } from './helpers.ts';

test('首次打开等待命名，关闭重开不重复创建身份；命名事务记录唯一出生', t => {
  const f = soulFixture(t, undefined, false), pending = f.soul.lifecycle();
  assert.equal(pending.phase, 'awaiting-name'); assert.equal(pending.name, null);
  assert.equal(f.soul.timeline().length, 0);
  assert.throws(() => f.say('普通第一条消息'), /尚未出生/u);
  f.soul.close(); const reopened = new SoulCore(f.options); t.after(() => reopened.close());
  assert.equal(reopened.lifecycle().id, pending.id);
  assert.equal(namingPhrase('今天聊什么'), undefined);
  const input = { name: '小禾', namedBy: '抚养者', sessionId: 'test', messageId: '1', text: '给你起名：小禾' };
  const named = reopened.name(input);
  assert.equal(named.id, pending.id); assert.equal(named.bornAt, f.options.clock().toISOString());
  assert.equal(reopened.name(input).birthEventId, named.birthEventId);
  assert.equal(reopened.timeline().filter(x => x.kind === 'birth').length, 1);
  assert.throws(() => reopened.name({ ...input, name: '别的名字', messageId: '2', text: '给你起名：别的名字' }), /已命名/u);
  assert.throws(() => new MemoryCore(f.options), /不能降级/u);
});
test('命名文本不明确不出生，晚命名不把等待时间算成年龄', t => {
  const f = soulFixture(t, undefined, false);
  f.day(100);
  assert.throws(() => f.soul.name({ name: '小禾', namedBy: '抚养者', sessionId: 't', messageId: '1', text: '我还没想好' }), /明确确认/u);
  assert.equal(f.soul.lifecycle().phase, 'awaiting-name');
  f.soul.name({ name: '小禾', namedBy: '抚养者', sessionId: 't', messageId: '2', text: '给你起名：小禾' });
  assert.equal(f.soul.state().development.bornDays, 0);
});
test('旧原型必须明确接续，原有身份和往事不伪装成新生', t => {
  const dataDir = directory(t), memory = new MemoryCore({ dataDir, name: '原身份' });
  const identity = memory.identity(); memory.observe({ sessionId: 'old', messageId: '1', role: 'user', text: '原有真实记录' }); memory.close();
  const soul = new SoulCore({ dataDir }); t.after(() => soul.close());
  assert.equal(soul.lifecycle().phase, 'legacy');
  assert.throws(() => soul.adoptLegacy(false), /明确确认/u);
  const adopted = soul.adoptLegacy(true);
  assert.equal(adopted.id, identity.id); assert.equal(adopted.bornAt, null);
  assert.equal(soul.state().development.stage, 'unassessed');
  assert(soul.recall('原有真实记录').memories.length > 0);
});
