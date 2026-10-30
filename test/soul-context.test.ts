import test from 'node:test';
import assert from 'node:assert/strict';
import { performance } from 'node:perf_hooks';
import { soulFixture, mref } from './soul-helpers.ts';

test('千段人生中保持固定身份、持续问题与按需上下文预算，历史可按ID回查', t => {
  const f = soulFixture(t), source = f.say('怎样才算安静陪伴？');
  const interest = f.soul.record({ kind: 'interest', topic: '安静陪伴', text: '想了解怎样安静陪伴而不失去交流', citations: [mref(source)] });
  for (let i = 0; i < 1000; i++) f.say(`虚构生活片段${i}，看见公园里不同的树和路灯。`);
  const times: number[] = [];
  for (let i = 0; i < 20; i++) {
    const at = performance.now(), packet = f.soul.context('以前为什么想理解安静陪伴？', { maxChars: 8000 });
    times.push(performance.now() - at);
    assert(packet.memoryIds.includes(interest.id)); assert(packet.chars <= 8000);
    assert(packet.text.includes(f.soul.lifecycle().id));
  }
  const tiny = f.soul.context('继续聊', { availableChars: 2500 });
  assert(tiny.chars <= 2500);
  assert.equal(f.soul.memory(source.id)?.text, source.text);
  times.sort((a, b) => a - b);
  t.diagnostic(JSON.stringify({ lifeEntries: f.soul.export().payload.life.length, budgetChars: 8000,
    medianMs: +times[10].toFixed(2), p95Ms: +times[18].toFixed(2) }));
  assert(times[18] < 1000);
});
test('普通问候不生成成年经历，复杂回忆按需扩大预算但不丢弃原件', t => {
  const f = soulFixture(t);
  const source = f.say('真实长篇记录：' + '今天讨论温柔和安静的区别。'.repeat(600));
  const packet = f.soul.context('回忆以前讨论过什么');
  assert(packet.chars <= 12000); assert(packet.truncated || packet.text.includes('展开原件'));
  assert.equal(f.soul.memory(source.id)?.text, source.text);
  assert.equal(f.soul.state().development.stage, 'newborn');
});
