import type { Appraisal, Change, Projection, Trait } from './types.ts';
import { TRAITS } from './types.ts';
import { Store } from './store.ts';
import { evidence, stableId } from './memories.ts';
import * as v from './validation.ts';

const clamp = (n: number, min = 0, max = 1) => Math.min(max, Math.max(min, n));
function valid(store: Store, row: Change | Appraisal): boolean {
  try { evidence(store, row.citations, true); return true; } catch { return false; }
}
export function change(store: Store, value: Omit<Change, 'id' | 'at'>, now: string): Change {
  const trait = v.trait(value.trait), citations = v.citations(value.citations);
  const delta = v.number(value.delta, -0.03, 0.03, '人格变化量'), why = v.text(value.why, '成长理由', 1000);
  const sources = evidence(store, citations, true);
  if (sources.length < 3 || new Set(sources.map(x => x.at.slice(0, 10))).size < 2) throw new Error('人格变化至少需要跨两天的三条不同经历');
  const id = stableId('change', [trait, delta, citations]);
  const changes = store.values<Change>('changes');
  const old = changes.find(x => x.id === id);
  if (old) return old;
  const dayDelta = changes.filter(x => x.trait === trait && x.at.slice(0, 10) === now.slice(0, 10) && valid(store, x))
    .reduce((sum, x) => sum + Math.abs(x.delta), 0);
  if (dayDelta + Math.abs(delta) > 0.030001) throw new Error('超过单日人格变化预算');
  const result: Change = { id, at: now, trait, delta, why, citations };
  store.addState('changes', result);
  store.audit('personality', [id], now);
  return result;
}
export function appraise(store: Store, value: Omit<Appraisal, 'id' | 'at'>, now: string): Appraisal {
  const citations = v.citations(value.citations);
  evidence(store, citations, true);
  const data = {
    valence: v.number(value.valence, -0.3, 0.3), arousal: v.number(value.arousal, 0, 0.3),
    trust: v.number(value.trust, -0.02, 0.02), why: v.text(value.why, '情绪评估理由', 1000), citations,
  };
  const id = stableId('affect', [citations.map(x => x.id).sort()]);
  const rows = store.values<Appraisal>('appraisals'), old = rows.find(x => x.id === id);
  if (old) return old;
  // One appraisal per source episode; repeated sleep cannot accumulate feelings.
  const existing = new Set(rows.flatMap(x => x.citations.map(c => c.id)));
  if (citations.some(x => existing.has(x.id))) throw new Error('同一经历不能重复累计情绪');
  const result: Appraisal = { ...data, id, at: now };
  store.addState('appraisals', result);
  store.audit('appraisal', [id], now);
  return result;
}
export function project(store: Store, now: string): Projection {
  const identity = store.identity();
  if (!identity) throw new Error('尚未初始化身份');
  const changes = store.values<Change>('changes').filter(row => valid(store, row));
  const appraisals = store.values<Appraisal>('appraisals').filter(row => valid(store, row));
  const personality = Object.fromEntries(TRAITS.map(trait => [trait,
    clamp(identity.baseline[trait] + changes.filter(x => x.trait === trait).reduce((sum, x) => sum + x.delta, 0)),
  ])) as Record<Trait, number>;
  let valence = 0, arousal = 0, trust = 0.5;
  for (const row of appraisals) {
    const hours = Math.max(0, (Date.parse(now) - Date.parse(row.at)) / 3600000);
    valence += row.valence * Math.pow(0.5, hours / 6);
    arousal += row.arousal * Math.pow(0.5, hours / 3);
    trust += row.trust * Math.pow(0.5, hours / (90 * 24));
  }
  return { identity, personality, changes, appraisals,
    affect: { valence: clamp(valence, -1, 1), arousal: clamp(arousal), trust: clamp(trust, 0.2, 0.8), kind: 'simulated-state' } };
}
