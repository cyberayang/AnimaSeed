import test from 'node:test';
import assert from 'node:assert/strict';
import { MemoryCore } from '../src/index.ts';
import { fixture } from './helpers.ts';

test('跨日三条反馈产生有证据的缓慢人格变化，重复整理不叠加', t => {
  const f = fixture(t, '2026-10-27T09:00:00.000Z');
  f.say('回复直接一点'); f.core.sleep();
  assert.equal(f.core.state().personality.directness, 0.5);
  f.time('2026-10-28T09:00:00.000Z'); f.say('回复简短一些');
  f.time('2026-10-29T09:00:00.000Z'); f.say('说话直接一些'); f.core.sleep();
  const state = f.core.state();
  assert.equal(state.personality.directness, 0.51);
  assert.equal(state.changes[0].citations.length, 3);
  f.core.sleep(); assert.equal(f.core.state().personality.directness, 0.51);
  f.core.close(); const reopened = new MemoryCore(f.options); t.after(() => reopened.close());
  assert.deepEqual(reopened.state(), state);
});
test('一次刺激不能重写人格；单日变化量受限', t => {
  const f = fixture(t), first = f.say('回复直接一点');
  assert.throws(() => f.core.change({ trait: 'warmth', delta: 0.03, why: '变化', citations: [{ id: first.id, quote: first.text }] }), /跨两天/u);
  const second = f.say('回复直接一些', { at: '2026-10-29T09:00:00.000Z' }), third = f.say('回复简短一点');
  const citations = [first, second, third].map(x => ({ id: x.id, quote: x.text }));
  f.core.change({ trait: 'warmth', delta: 0.03, why: '明确反馈', citations });
  assert.throws(() => f.core.change({ trait: 'warmth', delta: 0.02, why: '重复刺激', citations }), /单日/u);
});
test('情绪衰减、关系缓慢变化，新窗口不归零也不生成离线经历', t => {
  const f = fixture(t), source = f.say('谢谢你理解我'); f.core.sleep();
  const initial = f.core.state();
  assert(initial.affect.valence > 0);
  assert.equal(initial.affect.kind, 'simulated-state');
  f.core.sleep(); assert.equal(f.core.state().affect.trust, initial.affect.trust);
  const count = f.core.records().length;
  f.time('2026-10-30T15:00:00.000Z');
  assert.equal(f.core.state().affect.valence, initial.affect.valence / 2);
  assert(f.core.state().affect.trust > 0.5);
  assert.equal(f.core.records().length, count);
  f.core.forget(source.id);
  assert.equal(f.core.state().affect.valence, 0);
});
test('遗忘人格证据会撤销衍生习惯，不保留无来源的成长理由', t => {
  const f = fixture(t), a = f.say('回复直接一点', { at: '2026-10-28T09:00:00.000Z' });
  f.say('回复直接一些', { at: '2026-10-29T09:00:00.000Z' }); f.say('说话简洁一些'); f.core.sleep();
  assert.equal(f.core.state().changes.length, 1);
  f.core.forget(a.id);
  assert.equal(f.core.state().personality.directness, 0.5);
  assert.equal(f.core.export().payload.changes.length, 0);
});
test('后台整理取消后不提交；等待期间被遗忘的证据也不能提交', async t => {
  const f = fixture(t), source = f.say('喜欢蓝色');
  const proposal = { memories: [{ kind: 'fact', text: source.text, citations: [{ id: source.id, quote: source.text }] }] };
  const controller = new AbortController();
  const result = f.core.consolidate(async () => { controller.abort(); return proposal; }, controller.signal);
  await assert.rejects(result, /abort/iu);
  assert.equal(f.core.records().length, 1);
  await assert.rejects(f.core.consolidate(async () => { f.core.forget(source.id); return proposal; }), /失效/u);
  assert.equal(f.core.recall('蓝色').length, 0);
});
