import { createHash, randomUUID } from 'node:crypto';
import type { Citation, DerivedInput, Memory, Observation, Status } from './types.ts';
import { Store } from './store.ts';
import * as v from './validation.ts';

export function stableId(prefix: string, value: unknown): string {
  return prefix + '-' + createHash('sha256').update(JSON.stringify(value)).digest('hex').slice(0, 32);
}
export function evidence(store: Store, citations: Citation[], userOnly = false): Memory[] {
  return citations.map(citation => {
    const source = store.get(citation.id);
    if (!source || source.status !== 'active' || !source.text.includes(citation.quote)) throw new Error('证据不存在、已失效或引文不匹配');
    if (userOnly && (source.kind !== 'episode' || source.role !== 'user')) throw new Error('事实与人格变化需要用户原始经历，不能引用模型自说自话');
    return source;
  });
}
export function observe(store: Store, value: Observation, now: string): Memory {
  const sessionId = v.text(value.sessionId, '会话ID', 200), messageId = v.text(value.messageId, '消息ID', 200);
  if (value.role !== 'user' && value.role !== 'assistant') throw new Error('只能记录明确的用户或助手发言');
  const content = v.text(value.text, '经历内容');
  const externalKey = JSON.stringify([sessionId, messageId, value.role]);
  const old = store.byExternalKey(externalKey);
  if (old) {
    if (old.status !== 'forgotten' && old.text !== content) throw new Error('相同消息ID内容不同，拒绝覆盖原件');
    return old;
  }
  const at = v.date(value.at ?? now);
  if (at > now) throw new Error('不能记录来自未来的经历');
  const record: Memory = {
    id: randomUUID(), kind: 'episode', status: 'active', text: content, at, role: value.role,
    sessionId, externalKey, key: null, citations: [], importance: v.number(value.importance ?? 0.5, 0, 1),
    confidence: value.role === 'user' ? 1 : 0.5, entities: [],
    expiresAt: value.expiresAt ? v.date(value.expiresAt) : null, pinned: value.pinned === true,
  };
  store.put(record);
  store.audit('observe', [record.id], now);
  return record;
}
export function derive(store: Store, value: DerivedInput, now: string): Memory {
  const input = v.derived(value);
  const sources = evidence(store, input.citations, ['fact', 'habit'].includes(input.kind));
  if (sources.some(source => source.at > now)) throw new Error('不能引用来自未来的经历');
  const id = stableId('memory', [input.kind, input.text, input.key ?? null, input.citations]);
  const old = store.get(id);
  if (old) return old; // Tombstones cannot be revived by a repeated reflection.
  if (input.key) {
    const conflict = store.all('active').find(x => x.key === input.key && x.text !== input.text);
    if (conflict) throw new Error(`语义键存在冲突，需要显式纠正：${conflict.id}`);
  }
  const record: Memory = {
    id, kind: input.kind, status: 'active', text: input.text, at: now, role: 'derived', sessionId: null,
    externalKey: null, key: input.key ?? null, citations: input.citations,
    importance: input.importance!, confidence: input.confidence!, entities: input.entities!,
    expiresAt: input.expiresAt ?? null, pinned: input.pinned === true,
  };
  store.put(record);
  store.audit('derive', [id], now);
  return record;
}
export function invalidate(store: Store, roots: string[], status: Exclude<Status, 'active'>, now: string): string[] {
  const ids = store.dependents(roots);
  for (const id of ids) {
    const record = store.get(id);
    if (!record || record.status === 'forgotten') continue;
    if (status !== 'forgotten' && record.status !== 'active') continue;
    store.put({ ...record, status, ...(status === 'forgotten'
      ? { text: '', citations: [], key: null, entities: [], importance: 0, confidence: 0 } : {}) });
  }
  if (status === 'forgotten') {
    const affected = new Set(ids);
    for (const table of ['changes', 'appraisals'] as const) {
      for (const row of store.values(table)) {
        if (row.citations.some(citation => affected.has(citation.id))) store.db.prepare(`DELETE FROM ${table} WHERE id=?`).run(row.id);
      }
    }
  }
  store.audit(status, ids, now);
  return ids;
}
export function refresh(store: Store, now: string): string[] {
  const expired = (store.db.prepare(`SELECT id FROM nodes WHERE status='active'
    AND json_extract(data,'$.expiresAt') IS NOT NULL AND json_extract(data,'$.expiresAt')<=?`).all(now) as { id: string }[]).map(x => x.id);
  return expired.length ? invalidate(store, expired, 'expired', now) : [];
}
export function ancestors(store: Store, id: string): string[] {
  const target = store.get(v.text(id, '记忆ID', 100));
  if (!target) throw new Error('找不到指定记忆');
  // Forgetting a derived memory also forgets its evidence, preventing reconstruction.
  const ancestors = new Set([id]), queue = [target];
  for (let i = 0; i < queue.length; i++) for (const citation of queue[i].citations) {
    if (!ancestors.has(citation.id)) {
      ancestors.add(citation.id);
      const source = store.get(citation.id);
      if (source) queue.push(source);
    }
  }
  return [...ancestors];
}
export function forget(store: Store, id: string, now: string): string[] {
  return invalidate(store, ancestors(store, id), 'forgotten', now);
}
