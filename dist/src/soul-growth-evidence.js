import { stableId } from './memories.js';
import { SoulRepository } from './soul-repository.js';
import { ancestry, requireLiving } from './soul-life.js';
import { sampleInput, reviewInput } from './soul-validation.js';
const DAY = 86400000;
export const refTo = (row) => ({ type: 'life', id: row.id, quote: row.text.slice(0, 1800) });
function active(repo, id, kind) {
    const row = repo.get(id);
    if (!row || row.status !== 'active' || row.kind !== kind)
        throw new Error(`成长证据需要有效${kind}记录`);
    return row;
}
export function growthSample(repo, input, now) {
    requireLiving(repo);
    const value = sampleInput(input);
    const baseline = active(repo, value.baselineId, 'understanding'), learning = active(repo, value.learningId, 'understanding');
    const application = active(repo, value.applicationId, 'choice'), feedback = active(repo, value.feedbackId, 'feedback');
    if (learning.revisesId !== baseline.id || baseline.at >= learning.at)
        throw new Error('学习样本必须有先前认识与后续修正');
    if (Date.parse(application.at) - Date.parse(learning.at) < DAY || feedback.at <= application.at)
        throw new Error('应用需要至少隔一天，反馈必须发生在应用之后');
    if (!ancestry(repo, application.citations).entries.some(x => x.id === learning.id)
        || !ancestry(repo, feedback.citations).entries.some(x => x.id === application.id))
        throw new Error('成长经历链必须连通学习、应用和反馈');
    const roots = ancestry(repo, [refTo(application)]).memories;
    const fresh = roots.filter(x => x.role === 'user' && x.at > learning.at);
    if (!fresh.length)
        throw new Error('应用需要新的真实互动情境');
    const applicationSignature = stableId('context', fresh.map(x => x.text.normalize('NFKC').toLowerCase().replace(/[\p{P}\p{Z}\s]/gu, '')).sort());
    const duplicate = repo.list('growth-sample', 10000).find(x => x.details.domain === value.domain
        && (x.details.applicationId === application.id || x.details.feedbackId === feedback.id || x.details.applicationSignature === applicationSignature));
    if (duplicate)
        return duplicate;
    return repo.put({ id: stableId('growth', [value.domain, application.id, feedback.id]), kind: 'growth-sample',
        at: now, status: 'active', topic: value.domain, text: `发展候选：${value.context}；有经历链，尚需间隔复核。`,
        citations: [baseline, learning, application, feedback].map(refTo), revisesId: null, confidence: 0.5,
        details: { ...value, applicationSignature, assessment: 'candidate' } });
}
export function growthReview(repo, input, now) {
    requireLiving(repo);
    const value = reviewInput(input), sample = active(repo, value.sampleId, 'growth-sample');
    if (Date.parse(now) - Date.parse(sample.at) < 2 * DAY)
        throw new Error('成长候选至少间隔两天才能复核');
    const previous = repo.list('growth-review', 10000).find(x => x.details.sampleId === sample.id);
    if (previous)
        return previous;
    // This API is host-only; dialogue tools may propose, but cannot grant their own review.
    const result = repo.put({ id: stableId('review', sample.id), kind: 'growth-review', at: now, status: 'active',
        text: value.rationale, topic: sample.topic, citations: [refTo(sample)], revisesId: null,
        confidence: value.verdict === 'uncertain' ? 0.4 : 0.7,
        details: { sampleId: sample.id, verdict: value.verdict, assessor: 'host-review', semanticCertainty: 'limited' } });
    repo.store.audit('soul.growth-review', [result.id], now);
    return result;
}
