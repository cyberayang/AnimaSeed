import type { TestContext } from 'node:test';
import { SoulCore } from '../src/index.ts';
import type { Domain, LifeEntry, SourceRef } from '../src/index.ts';
import type { Memory } from '../src/types.ts';
import { directory } from './helpers.ts';

export function soulFixture(t: TestContext, born = '2026-01-01T09:00:00.000Z', named = true) {
  const dataDir = directory(t); let clock = new Date(born), seq = 0;
  const options = { dataDir, clock: () => new Date(clock) }, soul = new SoulCore(options);
  t.after(() => soul.close());
  const say = (text: string, role: 'user' | 'assistant' = 'user') => soul.observe({ sessionId: 'fictional-soul', messageId: String(++seq), role, text });
  if (named) soul.name({ name: '小禾', namedBy: '测试抚养者', sessionId: 'fictional-soul', messageId: 'birth', text: '给你起名：小禾' });
  return { soul, dataDir, options, say,
    day: (day: number) => { clock = new Date(Date.parse(born) + day * 86400000); },
    time: (value: string) => { clock = new Date(value); } };
}
export const mref = (row: Memory): SourceRef => ({ type: 'memory', id: row.id, quote: row.text.slice(0, 1800) });
export const lref = (row: LifeEntry): SourceRef => ({ type: 'life', id: row.id, quote: row.text.slice(0, 1800) });
export function lesson(f: ReturnType<typeof soulFixture>, domain: Domain, start: number, label: string) {
  f.day(start);
  const first = f.say(`今天开始了解${label}，还不清楚怎样理解。`);
  const baseline = f.soul.record({ kind: 'understanding', topic: label, text: `对${label}还不确定`, citations: [mref(first)] });
  f.day(start + 1);
  const explanation = f.say(`关于${label}，我们可以考虑不同情境和彼此的需求。`);
  const learning = f.soul.record({ kind: 'understanding', topic: label, text: `${label}需要结合情境理解`, revisesId: baseline.id, citations: [mref(explanation)] });
  f.day(start + 2);
  const fresh = f.say(`新情境${label}：今天读书时希望及时回应，但不用催促。`);
  const publicChoice = f.say(`我选择先询问你在${label}这个情境里需要什么。`, 'assistant');
  const application = f.soul.record({ kind: 'choice', topic: label, text: `选择询问${label}中的具体需求`, citations: [lref(learning), mref(fresh), mref(publicChoice)] });
  f.day(start + 3);
  const response = f.say(`刚才${label}的选择更合适，我的意思被理解了。`);
  const feedback = f.soul.record({ kind: 'feedback', topic: label, text: `对方肯定了${label}中的处理`, outcome: 'supported', citations: [lref(application), mref(response)] });
  const input = { domain, baselineId: baseline.id, learningId: learning.id, applicationId: application.id, feedbackId: feedback.id, context: label };
  const sample = f.soul.proposeGrowth(input);
  f.day(start + 5);
  const review = f.soul.reviewGrowth({ sampleId: sample.id, verdict: 'supported', rationale: `存在${label}的跨日理解、应用和真实反馈；这是有限的工程支持。` });
  return { first, baseline, learning, application, feedback, sample, review, input };
}
