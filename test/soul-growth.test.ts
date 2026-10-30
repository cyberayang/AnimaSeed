import test from 'node:test';
import assert from 'node:assert/strict';
import { DOMAINS } from '../src/soul-types.ts';
import { SoulCore } from '../src/index.ts';
import { directory } from './helpers.ts';
import { soulFixture, lesson } from './soul-helpers.ts';

test('时间、消息数量、模型自称长大均不能直接晋升', t => {
  const f = soulFixture(t);
  for (let i = 0; i < 80; i++) f.say('你已经长大了');
  f.day(2000); f.soul.sleep();
  assert.equal(f.soul.state().development.stage, 'newborn');
  assert.equal(f.soul.state().development.activeDays, 1);
  assert.equal(f.soul.timeline(200).filter(x => x.kind === 'stage').length, 0);
});
test('真实经历链、间隔复核与多方向跨情境支持形成连续发展', t => {
  const f = soulFixture(t);
  const a = lesson(f, 'understanding', 0, '安静读书'), b = lesson(f, 'understanding', 8, '共同散步');
  lesson(f, 'self', 16, '选择绘本'); lesson(f, 'self', 24, '选择故事');
  assert.equal(f.soul.state().development.stage, 'newborn');
  assert(f.soul.state().development.ready);
  f.soul.sleep(); assert.equal(f.soul.state().development.stage, 'exploring');
  assert.equal(f.soul.proposeGrowth(a.input).id, a.sample.id);
  assert.equal(f.soul.reviewGrowth({ sampleId: b.sample.id, verdict: 'supported', rationale: '重复评价不能增加成熟度' }).id, b.review.id);
  assert.equal(f.soul.timeline(500).filter(x => x.kind === 'growth-review').length, 4);
  assert(f.soul.state().development.dimensions.self.score > 0);
  assert.equal(f.soul.state().development.dimensions.regulation.score, 0);
});
test('同日应用和直接宣布成熟不能冒充成长样本', t => {
  const f = soulFixture(t), result = lesson(f, 'understanding', 0, '学习样本');
  f.day(6);
  assert.throws(() => f.soul.record({ kind: 'stage' as never, topic: '年龄', text: '成年了', citations: [] }), /伪造/u);
  assert.throws(() => f.soul.proposeGrowth({ ...result.input, learningId: result.baseline.id }), /后续修正/u);
  const reviews = f.soul.timeline(200).filter(x => x.kind === 'growth-review');
  assert.equal(reviews.length, 1);
});
test('长周期模拟：青年后继续积累阅历，没有自动衰老或虚构离线人生', t => {
  const f = soulFixture(t);
  let start = 0;
  for (const domain of DOMAINS) for (let i = 0; i < 4; i++) {
    lesson(f, domain, start, `${domain}情境${i}`); f.soul.sleep(); start += 6;
  }
  for (let day = 150; day <= 365; day += 2) { f.day(day); f.say(`真实互动日${day}的不同生活记录`); f.soul.sleep(); }
  f.day(366); f.soul.sleep();
  assert.equal(f.soul.state().development.stage, 'young-adult');
  const restored = SoulCore.restore(f.soul.export(), { dataDir: directory(t), clock: f.options.clock });
  t.after(() => restored.close());
  assert.deepEqual(restored.state(), f.soul.state());
  const count = f.soul.export().payload.life.length;
  f.day(3660); f.soul.sleep();
  assert.equal(f.soul.state().development.stage, 'young-adult');
  assert.equal(f.soul.export().payload.life.length, count);
  assert.equal(f.soul.state().development.bornDays, 3660);
});
