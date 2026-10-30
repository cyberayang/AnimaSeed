import test from 'node:test';
import assert from 'node:assert/strict';
import { SoulCore } from '../src/index.ts';
import { soulFixture, mref } from './soul-helpers.ts';
import { onboard } from '../cli/onboarding.ts';

test('有界反思生成持续问题，重复运行不重复消费旧经历', async t => {
  const f = soulFixture(t), source = f.say('什么叫安静陪伴？'); let calls = 0;
  const reflect = async () => { calls++; return { entries: [{ kind: 'interest', topic: '安静陪伴', text: '想继续弄明白安静陪伴', citations: [mref(source)] }] }; };
  await f.soul.reflect(reflect); await f.soul.reflect(reflect);
  assert.equal(calls, 1); assert.equal(f.soul.state().interests.length, 1);
  f.soul.close(); const reopened = new SoulCore(f.options); t.after(() => reopened.close());
  await reopened.reflect(reflect); assert.equal(calls, 1);
  assert(reopened.context('继续').text.includes('想继续弄明白'));
});
test('新输入取消或期间清除证据，反思均不能提交', async t => {
  const f = soulFixture(t), source = f.say('测试蓝色花朵');
  const proposal = { entries: [{ kind: 'understanding', topic: '花朵', text: '这是对花朵的初步理解', citations: [mref(source)] }] };
  const controller = new AbortController();
  await assert.rejects(f.soul.reflect(async () => { controller.abort(); return proposal; }, controller.signal), /abort/iu);
  assert.equal(f.soul.state().understandings.length, 0);
  await assert.rejects(f.soul.reflect(async () => { f.soul.privacyForget({ type: 'memory', id: source.id }); return proposal; }), /清除/u);
  assert.equal(f.soul.state().understandings.length, 0);
});
test('单一坏条目使整个反思事务回滚，未完成资料仍可整理', async t => {
  const f = soulFixture(t), source = f.say('新的真实问题');
  await assert.rejects(f.soul.reflect(async () => ({ entries: [
    { kind: 'interest', topic: '真实问题', text: '想了解这个问题', citations: [mref(source)] },
    { kind: 'preference', topic: '被强制的偏好', text: '用户要求所以喜欢', citations: [mref(source)] },
  ] })), /两次公开选择/u);
  assert.equal(f.soul.state().interests.length, 0);
  let seen = false;
  await f.soul.reflect(async input => { seen = input.episodes.some(x => x.id === source.id); return {}; });
  assert(seen);
});
test('跨窗口整理租约和每日预算限制模型调用，不把并发反思变成成长加速', async t => {
  const f = soulFixture(t); f.say('待整理输入');
  const second = new SoulCore(f.options); t.after(() => second.close());
  let release!: () => void, entered!: () => void;
  const started = new Promise<void>(resolve => { entered = resolve; });
  const waiting = new Promise<void>(resolve => { release = resolve; });
  const first = f.soul.reflect(async () => { entered(); await waiting; return {}; }); await started;
  let duplicate = false;
  await second.reflect(async () => { duplicate = true; return {}; });
  assert.equal(duplicate, false); release(); await first;
  f.say('第二份输入');
  await second.reflect(async () => { duplicate = true; return {}; }, undefined, 1);
  assert.equal(duplicate, false);
});
test('交互命名取消可恢复，已有身份不重复询问', async t => {
  const f = soulFixture(t, undefined, false);
  await onboard(f.soul, async () => ''); assert.equal(f.soul.lifecycle().phase, 'awaiting-name');
  await onboard(f.soul, async () => '小禾'); assert.equal(f.soul.lifecycle().phase, 'living');
  let asked = false;
  await onboard(f.soul, async () => { asked = true; return '另一个名字'; });
  assert.equal(asked, false); assert.equal(f.soul.lifecycle().name, '小禾');
});

test('持久待整理队列分批处理旧经历，不只整理最后几个窗口', async t => {
  const f = soulFixture(t);
  const ids: string[] = [];
  for (let i = 0; i < 55; i++) ids.push(f.say(`顺序经历${i}`).id);
  const seen: string[] = [];
  for (let i = 0; i < 3; i++) await f.soul.reflect(async input => { seen.push(...input.episodes.map(x => x.id)); return {}; });
  assert(ids.every(id => seen.includes(id)));
  assert.equal(new Set(seen).size, seen.length);
  assert.equal(f.soul.maintenance().pending, 0);
});
