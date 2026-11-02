import { DOMAINS, STAGES } from './soul-types.js';
import { SoulRepository } from './soul-repository.js';
import { stableId } from './memories.js';
import { refTo } from './soul-growth-evidence.js';
const DAY = 86400000;
export const STAGE_LABELS = {
    newborn: '初生期', exploring: '探索期', childhood: '童年期', adolescent: '少年期', 'young-adult': '青年成熟期',
};
const RULES = {
    newborn: { days: 0, active: 0, samples: 0, domains: 0 },
    exploring: { days: 14, active: 5, samples: 2, domains: 2 },
    childhood: { days: 60, active: 20, samples: 6, domains: 3 },
    adolescent: { days: 180, active: 60, samples: 12, domains: 5 },
    'young-adult': { days: 365, active: 120, samples: 24, domains: 6 },
};
export function development(repo, now) {
    const lifecycle = repo.lifecycle(), bornDays = lifecycle.bornAt
        ? Math.max(0, Math.floor((Date.parse(now) - Date.parse(lifecycle.bornAt)) / DAY)) : null;
    const activeDays = repo.store.db.prepare(`SELECT count(DISTINCT substr(at,1,10)) AS n FROM nodes
    WHERE kind='episode' AND status!='forgotten' AND json_extract(data,'$.role')='user'
    AND at>=? AND at<=?`).get(lifecycle.bornAt ?? now, now).n;
    const samples = repo.list('growth-sample', 10000), reviews = repo.list('growth-review', 10000);
    const supported = reviews.filter(x => x.details.verdict === 'supported');
    const dimensions = Object.fromEntries(DOMAINS.map(domain => {
        const good = supported.filter(x => x.topic === domain), contexts = new Set(good.map(x => repo.get(String(x.details.sampleId))?.details.context));
        const days = new Set(good.map(x => repo.get(String(x.details.sampleId))?.at.slice(0, 10)));
        const stable = contexts.size >= 2 && days.size >= 2;
        return [domain, { score: +(Math.min(1, good.length * 0.1) * (stable ? 1 : 0.5)).toFixed(3),
                supported: good.length, candidate: samples.filter(x => x.topic === domain && !reviews.some(r => r.details.sampleId === x.id)).length,
                uncertain: reviews.filter(x => x.topic === domain && x.details.verdict !== 'supported').length }];
    }));
    const cached = repo.store.meta('soul.stage');
    const stage = lifecycle.phase !== 'living' || lifecycle.origin === 'adopted'
        ? 'unassessed' : cached?.stage ?? 'newborn';
    const next = stage === 'unassessed' ? null : STAGES[STAGES.indexOf(stage) + 1] ?? null;
    const reasons = [];
    if (next) {
        const rule = RULES[next];
        if ((bornDays ?? 0) < rule.days)
            reasons.push(`最早进入${STAGE_LABELS[next]}需要${rule.days}天`);
        if (activeDays < rule.active)
            reasons.push(`需要分散在至少${rule.active}天的真实互动`);
        if (supported.length < rule.samples)
            reasons.push(`需要至少${rule.samples}条间隔复核支持的经历链`);
        if (DOMAINS.filter(x => dimensions[x].score >= 0.2).length < rule.domains)
            reasons.push(`需要${rule.domains}个发展方向有跨情境支持`);
        if (cached && Date.parse(now) - Date.parse(cached.at) < 7 * DAY)
            reasons.push('阶段变化仍在至少七天的观察期');
        const basis = supported.map(x => repo.get(String(x.details.sampleId)).at).sort();
        if (basis.length && Date.parse(basis.at(-1)) - Date.parse(basis[0]) < 7 * DAY)
            reasons.push('成长证据需要跨至少七天形成');
    }
    const redactedBasis = cached && repo.get(cached.eventId)?.status === 'redacted';
    return { stage, label: stage === 'unassessed' ? '尚未评估' : STAGE_LABELS[stage], bornDays, activeDays, dimensions,
        next, ready: !!next && !reasons.length, reasons, evidenceIds: supported.map(x => x.id),
        basis: redactedBasis || stage === 'unassessed' ? 'unassessed' : 'observed' };
}
export function advance(repo, now) {
    const current = development(repo, now);
    if (!current.ready || !current.next || repo.lifecycle().phase !== 'living')
        return current;
    const sources = current.evidenceIds.slice(-16).map(id => refTo(repo.get(id)));
    const stage = current.next;
    const row = repo.put({ id: stableId('stage', [repo.lifecycle().id, stage]), kind: 'stage', at: now, status: 'active',
        topic: '发展阶段', text: `根据已记录的跨时经历与复核，由${current.label}进入${STAGE_LABELS[stage]}；不替换人格。`,
        citations: sources, revisesId: null, confidence: 0.7,
        details: { stage, prior: current.stage, policy: 'gradual-v1', basis: 'evidence-backed-engineering-assessment' } });
    repo.store.setMeta('soul.stage', { stage, at: now, eventId: row.id });
    repo.changed();
    return development(repo, now);
}
