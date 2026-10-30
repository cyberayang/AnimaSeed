import * as v from './validation.ts';
import { LIFE_KINDS, DOMAINS } from './soul-types.ts';
import type { LifeEntry, LifeInput, SourceRef, GrowthSampleInput, GrowthReviewInput, Lifecycle } from './soul-types.ts';

export function refs(value: unknown): SourceRef[] {
  const rows = v.list(value, 16).map(item => {
    const x = v.object(item);
    if (x.type !== 'memory' && x.type !== 'life') throw new Error('证据类型应为memory或life');
    return { type: x.type, id: v.text(x.id, '来源ID', 100), quote: v.text(x.quote, '逐字引文', 2000) } as SourceRef;
  });
  if (!rows.length || new Set(rows.map(x => x.type + ':' + x.id)).size !== rows.length) throw new Error('需要不重复的人生证据');
  return rows;
}
export function lifeInput(value: unknown): LifeInput {
  const x = v.object(value);
  if (!['understanding', 'choice', 'feedback', 'reflection', 'interest', 'preference', 'affect', 'autobiography'].includes(String(x.kind))) throw new Error('不能通过反思伪造出生、阶段或原始经历');
  if (x.outcome !== undefined && !['supported', 'uncertain', 'contradicted'].includes(String(x.outcome))) throw new Error('反馈结果不正确');
  if (x.interestState !== undefined && !['open', 'resolved'].includes(String(x.interestState))) throw new Error('兴趣状态不正确');
  let affect: LifeInput['affect'];
  if (x.kind === 'affect') {
    const a = v.object(x.affect);
    affect = { valence: v.number(a.valence, -0.2, 0.2), arousal: v.number(a.arousal, 0, 0.2), trust: v.number(a.trust, -0.01, 0.01) };
  }
  return { kind: x.kind as LifeInput['kind'], text: v.text(x.text, '理解内容', 3000), topic: v.text(x.topic, '主题', 100),
    citations: refs(x.citations), revisesId: x.revisesId === undefined ? undefined : v.text(x.revisesId, '前一认识ID', 100),
    confidence: v.number(x.confidence ?? 0.6, 0, 0.95), outcome: x.outcome as LifeInput['outcome'],
    interestState: x.interestState as LifeInput['interestState'], affect };
}
export function sampleInput(value: unknown): GrowthSampleInput {
  const x = v.object(value);
  if (!DOMAINS.includes(x.domain as never)) throw new Error('未知发展方向');
  return { domain: x.domain as GrowthSampleInput['domain'], baselineId: v.text(x.baselineId, '初始认识ID', 100),
    learningId: v.text(x.learningId, '学习认识ID', 100), applicationId: v.text(x.applicationId, '应用ID', 100),
    feedbackId: v.text(x.feedbackId, '反馈ID', 100), context: v.text(x.context, '应用情境', 160) };
}
export function reviewInput(value: unknown): GrowthReviewInput {
  const x = v.object(value);
  if (!['supported', 'uncertain', 'contradicted'].includes(String(x.verdict))) throw new Error('复核结论不正确');
  return { sampleId: v.text(x.sampleId, '成长样本ID', 100), verdict: x.verdict as GrowthReviewInput['verdict'],
    rationale: v.text(x.rationale, '复核理由', 1500) };
}
export function entry(value: unknown): LifeEntry {
  const x = v.object(value);
  if (!LIFE_KINDS.includes(x.kind as never) || !['active', 'redacted'].includes(String(x.status))) throw new Error('人生记录类型或状态不正确');
  const details = v.object(x.details);
  if (Object.keys(details).length > 32) throw new Error('人生元数据过大');
  for (const [key, value] of Object.entries(details)) {
    if (key.length > 100 || (typeof value === 'string' && value.length > 2000)
      || (typeof value === 'number' && !Number.isFinite(value))
      || (value !== null && !['string', 'number', 'boolean'].includes(typeof value))) throw new Error('人生元数据格式不正确');
  }
  const redacted = x.status === 'redacted';
  return { id: v.text(x.id, '人生事件ID', 100), kind: x.kind as LifeEntry['kind'], at: v.date(x.at),
    status: x.status as LifeEntry['status'], text: redacted ? '' : v.text(x.text, '人生内容', 4000),
    topic: redacted ? '' : v.text(x.topic, '主题', 100), citations: redacted ? [] : refs(x.citations),
    revisesId: redacted || x.revisesId === null ? null : v.text(x.revisesId, '前一认识ID', 100),
    confidence: redacted ? 0 : v.number(x.confidence, 0, 1), details: redacted ? {} : details as LifeEntry['details'] };
}
export function lifecycle(value: unknown): Lifecycle {
  const x = v.object(value), temperament = v.object(x.temperament);
  if (!['awaiting-name', 'living', 'legacy'].includes(String(x.phase)) || !['newborn', 'adopted'].includes(String(x.origin))) throw new Error('生命周期不正确');
  const optional = (key: string, max = 100) => x[key] === null ? null : v.text(x[key], key, max);
  return { id: v.text(x.id, '身份ID', 100), phase: x.phase as Lifecycle['phase'], origin: x.origin as Lifecycle['origin'],
    openedAt: v.date(x.openedAt), bornAt: x.bornAt === null ? null : v.date(x.bornAt), name: optional('name', 80),
    namedBy: optional('namedBy', 80), birthEventId: optional('birthEventId'), namingRequest: optional('namingRequest', 500),
    temperament: { inquiry: v.number(temperament.inquiry, 0.45, 0.55), caution: v.number(temperament.caution, 0.45, 0.55) } };
}
