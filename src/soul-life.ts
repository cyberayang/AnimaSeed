import { observe, stableId } from './memories.ts';
import { SoulRepository } from './soul-repository.ts';
import * as v from './validation.ts';
import { lifeInput } from './soul-validation.ts';
import type { Observation, Memory } from './types.ts';
import type { LifeEntry, LifeInput, SourceRef } from './soul-types.ts';

export function requireLiving(repo: SoulRepository): void {
  const phase = repo.lifecycle().phase;
  if (phase !== 'living') throw new Error(phase === 'legacy' ? '旧身份尚未明确接续' : '请先确认名字，尚未出生');
}
export function observeLife(repo: SoulRepository, value: Omit<Observation, 'at'>, now: string): Memory {
  requireLiving(repo);
  const record = observe(repo.store, { ...value, at: now }, now);
  if (record.status !== 'forgotten') repo.enqueue(record.id);
  const id = stableId('interaction', record.id);
  if (record.status !== 'forgotten') repo.put({ id, kind: 'interaction', at: record.at, status: 'active',
    text: `${record.role === 'user' ? '对方说' : '公开表达'}：${record.text.slice(0, 3000)}`, topic: '真实互动',
    citations: [{ type: 'memory', id: record.id, quote: record.text.slice(0, 1800) }], revisesId: null,
    confidence: 1, details: { role: record.role, sessionId: record.sessionId, preview: record.text.length > 3000 } });
  return record;
}
export function ancestry(repo: SoulRepository, refs: SourceRef[]): { memories: Memory[]; entries: LifeEntry[] } {
  const memories = new Map<string, Memory>(), entries = new Map<string, LifeEntry>(), queue = [...refs];
  for (let i = 0; i < queue.length; i++) {
    if (i > 2000) throw new Error('单次证据链过深，请使用更直接的经历来源');
    const ref = queue[i];
    repo.source(ref);
    if (ref.type === 'memory') {
      if (memories.has(ref.id)) continue;
      const row = repo.store.get(ref.id)!; memories.set(ref.id, row);
      queue.push(...row.citations.map(x => ({ ...x, type: 'memory' as const })));
    } else {
      if (entries.has(ref.id)) continue;
      const row = repo.get(ref.id)!; entries.set(ref.id, row); queue.push(...row.citations);
    }
  }
  return { memories: [...memories.values()], entries: [...entries.values()] };
}
export function authorLife(repo: SoulRepository, input: LifeInput, now: string): LifeEntry {
  requireLiving(repo);
  const value = lifeInput(input), refs = [...value.citations].sort((a, b) => (a.type + a.id).localeCompare(b.type + b.id));
  if (value.kind === 'interest') value.interestState ??= 'open';
  if (value.kind === 'feedback') value.outcome ??= 'uncertain';
  repo.validateSources(refs, now);
  if (value.revisesId) {
    const previous = repo.get(value.revisesId);
    if (!previous || previous.status !== 'active' || previous.kind !== value.kind || previous.topic !== value.topic) throw new Error('修正必须指向同一主题、同一类别的有效旧理解');
    if (!refs.some(x => x.type === 'life' && x.id === previous.id)) refs.push({ type: 'life', id: previous.id, quote: previous.text.slice(0, 1800) });
    refs.sort((a, b) => (a.type + a.id).localeCompare(b.type + b.id));
    const repeatedId = stableId('life', [value.kind, value.topic, value.text, refs, value.revisesId ?? null,
      value.outcome ?? null, value.interestState ?? null]);
    const repeated = repo.get(repeatedId);
    if (repeated) return repeated;
    if (previous.text.trim() === value.text.trim()) throw new Error('重复相同理解不构成学习变化');
    const evidenceIds = (refs: SourceRef[]) => {
      const roots = ancestry(repo, refs);
      return [...roots.memories.map(x => x.id), ...roots.entries.filter(x => x.kind === 'experience' && x.details.outcome === 'completed').map(x => x.id)];
    };
    const priorSources = new Set(evidenceIds(previous.citations));
    if (!evidenceIds(value.citations).some(id => !priorSources.has(id))) throw new Error('修正认识需要新的真实经历，不能仅重复自述');
    const successor = repo.store.db.prepare("SELECT id FROM soul_life WHERE status='active' AND json_extract(data,'$.revisesId')=?").get(previous.id);
    if (successor) throw new Error('旧理解已有后续版本，请读取当前版本后再修正');
  } else if (['understanding', 'interest', 'preference', 'continuity'].includes(value.kind)) {
    const current = repo.current(value.kind, 100).find(x => x.topic === value.topic);
    if (current && current.text !== value.text) throw new Error('同一主题的认识已有记录，请保留revisesId变更链');
  }
  const roots = ancestry(repo, refs);
  const experiences = roots.entries.filter(x => x.kind === 'experience' && x.details.outcome === 'completed');
  if (!roots.memories.some(x => x.role === 'user') && !experiences.length) throw new Error('反思需要真实互动来源或宿主经历，不能只靠模型自说自话');
  if (value.kind === 'choice' && !roots.memories.some(x => x.role === 'assistant') && !experiences.length) throw new Error('选择必须引用已公开表达的实际选择或宿主完成回执');
  if (value.kind === 'feedback') {
    const choice = roots.entries.find(x => x.kind === 'choice');
    if (!choice || !roots.memories.some(x => x.role === 'user' && x.at > choice.at)) throw new Error('反馈需要选择之后的真实用户回应');
  }
  if (value.kind === 'preference') {
    const choices = roots.entries.filter(x => x.kind === 'choice');
    if (choices.length < 2 || new Set(choices.map(x => x.at.slice(0, 10))).size < 2) throw new Error('稳定偏好需要至少跨两天的两次公开选择');
  }
  let anchorKey: string | undefined;
  if (value.kind === 'affect') {
    const userSources = roots.memories.filter(x => x.role === 'user').sort((a, b) => b.at.localeCompare(a.at));
    const latest = [...userSources, ...experiences].map(x => x.at).sort().at(-1)!;
    if (!roots.memories.some(x => x.role === 'assistant' && x.at >= latest)) throw new Error('情绪评估需要真实互动及其公开回应，不能只按用户命令设置感受');
    anchorKey = stableId('affect-anchor', [...userSources, ...experiences].filter(x => x.at === latest).map(x => x.id).sort());
    const old = repo.list('affect', 10000).find(x => x.details.anchorKey === anchorKey);
    if (old) return old;
  }
  const id = value.kind === 'affect' ? stableId('affect', anchorKey) : stableId('life', [value.kind, value.topic, value.text, refs, value.revisesId ?? null,
    value.outcome ?? null, value.interestState ?? null]);
  return repo.put({ id, kind: value.kind, at: now, status: 'active', text: v.text(value.text, '理解内容', 3000),
    topic: value.topic, citations: refs, revisesId: value.revisesId ?? null,
    confidence: value.confidence ?? 0.6,
    details: { authority: value.kind === 'choice' ? 'public-choice' : 'interpretation',
      ...(value.kind === 'feedback' ? { outcome: value.outcome ?? 'uncertain' } : {}),
      ...(value.kind === 'interest' ? { interestState: value.interestState ?? 'open' } : {}),
      ...(value.kind === 'affect' ? { ...value.affect, anchorKey: anchorKey! } : {}) } });
}
