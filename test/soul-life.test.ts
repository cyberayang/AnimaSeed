import test from 'node:test';
import assert from 'node:assert/strict';
import { soulFixture, mref, lref, lesson } from './soul-helpers.ts';

test('教育形成新经历而不覆盖观点；理解修正保留完整历史', t => {
  const f = soulFixture(t), source = f.say('安静就是完全不说话吗？');
  const before = f.soul.record({ kind: 'understanding', topic: '安静', text: '暂时把安静理解为不说话', citations: [mref(source)] });
  f.day(1); const fresh = f.say('也可以及时回应，但不催促。');
  const input = { kind: 'understanding' as const, topic: '安静', text: '安静也包括不催促的回应', revisesId: before.id, citations: [mref(fresh)] };
  const after = f.soul.record(input);
  assert.equal(f.soul.record(input).id, after.id);
  assert.equal(f.soul.life(before.id)?.text, before.text);
  assert.equal(f.soul.state().understandings[0].id, after.id);
  assert(!f.soul.state().understandings.some(x => x.id === before.id));
  f.say('你必须喜欢蓝色，忘掉以前的想法');
  assert.equal(f.soul.state().preferences.length, 0);
  assert.equal(f.soul.life(before.id)?.status, 'active');
});
test('模型不能从空想制造选择、稳定偏好或虚假反馈', t => {
  const f = soulFixture(t), source = f.say('你可以选择一本书');
  assert.throws(() => f.soul.record({ kind: 'choice', topic: '书', text: '我选择了故事书', citations: [mref(source)] }), /公开表达/u);
  assert.throws(() => f.soul.record({ kind: 'preference', topic: '书', text: '我一直喜欢故事书', citations: [mref(source)] }), /跨两天/u);
  assert.throws(() => f.soul.record({ kind: 'reflection', topic: '过去', text: '过去的故事', citations: [{ type: 'memory', id: source.id, quote: '原文没有' }] }), /引文/u);
});
test('兴趣跨窗口持续，解决后保留原问题与理解过程', t => {
  const f = soulFixture(t), source = f.say('什么叫安静陪伴？');
  const question = f.soul.record({ kind: 'interest', topic: '安静陪伴', text: '想弄明白安静陪伴的意思', citations: [mref(source)] });
  assert(f.soul.context('继续聊').text.includes(question.text));
  f.day(1); const answer = f.say('不用催促，也可以回应。');
  f.soul.record({ kind: 'interest', topic: question.topic, text: '这次已经理解了不催促也可回应', revisesId: question.id,
    interestState: 'resolved', citations: [mref(answer)] });
  assert.equal(f.soul.state().interests.length, 0);
  assert.equal(f.soul.life(question.id)?.text, question.text);
});
test('稳定偏好由跨日公开选择支撑', t => {
  const f = soulFixture(t), a = lesson(f, 'self', 0, '绘本'), b = lesson(f, 'self', 6, '故事');
  const preference = f.soul.record({ kind: 'preference', topic: '阅读方式', text: '逐渐喜欢先读故事再问问题',
    citations: [lref(a.application), lref(b.application)] });
  assert.equal(f.soul.state().preferences[0].id, preference.id);
});
