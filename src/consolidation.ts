import { Store } from './store.ts';
import { derive, refresh } from './memories.ts';
import { appraise, change } from './state.ts';
import type { ConsolidationInput, ConsolidationProposal, Memory } from './types.ts';
import * as v from './validation.ts';

export function consolidationInput(store: Store): ConsolidationInput {
  const identity = store.identity();
  if (!identity) throw new Error('身份尚未初始化');
  const recent = store.recent(150);
  return { identity, episodes: recent.filter(x => x.kind === 'episode' && x.role === 'user').slice(0, 24),
    known: recent.filter(x => x.kind !== 'episode').slice(0, 16) };
}
export function proposal(value: unknown): ConsolidationProposal {
  const row = v.object(value);
  return {
    memories: v.list(row.memories ?? [], 12).map(v.derived),
    changes: v.list(row.changes ?? [], 2).map(item => {
      const x = v.object(item);
      return { trait: v.trait(x.trait), delta: v.number(x.delta, -0.03, 0.03),
        why: v.text(x.why, '成长理由', 1000), citations: v.citations(x.citations) };
    }),
    appraisals: v.list(row.appraisals ?? [], 6).map(item => {
      const x = v.object(item);
      return { valence: v.number(x.valence, -0.3, 0.3), arousal: v.number(x.arousal, 0, 0.3),
        trust: v.number(x.trust, -0.02, 0.02), why: v.text(x.why, '情绪理由', 1000), citations: v.citations(x.citations) };
    }),
  };
}
export function applyProposal(store: Store, input: unknown, now: string) {
  const parsed = proposal(input);
  refresh(store, now);
  const memories = (parsed.memories ?? []).map(x => derive(store, x, now));
  const changes = (parsed.changes ?? []).map(x => change(store, x, now));
  const appraisals = (parsed.appraisals ?? []).map(x => appraise(store, x, now));
  return { memories, changes, appraisals };
}
export function localConsolidation(store: Store, now: string) {
  const input = consolidationInput(store), memories: string[] = [], appraisals: string[] = [];
  for (const source of input.episodes) {
    const explicit = source.text.match(/(?:请记住|记住)[：:，,\s]*(.{2,1000})/u);
    if (explicit) memories.push(derive(store, { kind: 'fact', text: explicit[1],
      citations: [{ id: source.id, quote: explicit[0] }], importance: 0.85, confidence: 0.95, pinned: true }, now).id);
    if (/(谢谢你|谢谢陪我|有你陪|你理解我)/u.test(source.text)) {
      appraisals.push(appraise(store, { valence: 0.08, arousal: 0.03, trust: 0.005,
        why: '本地规则识别到明确的感谢或被理解表达；属于模拟关系评估',
        citations: [{ id: source.id, quote: source.text.slice(0, 500) }] }, now).id);
    }
  }
  const changes: string[] = [];
  const styleRules = [
    { trait: 'directness' as const, pattern: /(?:说话|回答|回复).{0,6}(?:直接|简短|简洁)/u },
    { trait: 'warmth' as const, pattern: /(?:说话|回答|回复).{0,6}(?:温柔|温暖)/u },
  ];
  for (const rule of styleRules) {
    const sources = input.episodes.filter(x => rule.pattern.test(x.text)).slice(0, 3);
    if (sources.length < 3 || new Set(sources.map(x => x.at.slice(0, 10))).size < 2) continue;
    try {
      changes.push(change(store, { trait: rule.trait, delta: 0.01,
        why: '多次、跨日的明确交流反馈形成轻微表达倾向',
        citations: sources.map(x => ({ id: x.id, quote: x.text.match(rule.pattern)![0] })) }, now).id);
    } catch (error) {
      if (!(error instanceof Error) || error.message !== '超过单日人格变化预算') throw error;
    }
  }
  const active = store.all('active');
  const sourceIds = new Set(active.filter(x => x.kind !== 'episode').flatMap(x => x.citations.map(c => c.id)));
  const stale: Memory[] = active.filter(x => x.kind === 'episode' && !x.pinned && x.importance < 0.6
    && !sourceIds.has(x.id) && Date.parse(now) - Date.parse(x.at) > 30 * 86400000);
  return { memories, changes, appraisals, stale: stale.map(x => x.id) };
}
