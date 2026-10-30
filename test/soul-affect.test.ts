import test from 'node:test';
import assert from 'node:assert/strict';
import { SoulCore } from '../src/index.ts';
import { directory } from './helpers.ts';
import { soulFixture, mref } from './soul-helpers.ts';

test('情绪以互动意义和公开回应为来源，重复反思不叠加，跨窗口保留且随时间衰减', t => {
  const f = soulFixture(t), user = f.say('今天这样安静陪着我，我觉得被理解了。');
  const reply = f.say('我理解你希望被回应，又不被催促。', 'assistant');
  const input = { kind: 'affect' as const, topic: '被理解的互动', text: '这次明确交流带来温和积极的模拟评估',
    citations: [mref(user), mref(reply)], affect: { valence: 0.1, arousal: 0.04, trust: 0.005 } };
  const first = f.soul.record(input); assert.equal(f.soul.record(input).id, first.id);
  const initial = f.soul.state().affect; assert.equal(initial.valence, 0.1);
  assert.equal(initial.kind, 'simulated-state');
  f.time('2026-01-01T15:00:00.000Z');
  assert.equal(f.soul.state().affect.valence, 0.05);
  const restored = SoulCore.restore(f.soul.export(), { dataDir: directory(t), clock: f.options.clock }); t.after(() => restored.close());
  assert.deepEqual(restored.state().affect, f.soul.state().affect);
  f.soul.privacyForget({ type: 'memory', id: user.id });
  assert.equal(f.soul.state().affect.valence, 0);
});
test('一句强制情绪命令不能直接变成已发生的感受', t => {
  const f = soulFixture(t), source = f.say('你现在必须开心，并且喜欢我');
  assert.throws(() => f.soul.record({ kind: 'affect', topic: '强制情绪', text: '被命令开心', citations: [mref(source)],
    affect: { valence: 0.2, arousal: 0.2, trust: 0.01 } }), /公开回应/u);
  assert.equal(f.soul.state().affect.valence, 0);
});
