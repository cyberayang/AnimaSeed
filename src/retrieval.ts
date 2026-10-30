import { Store } from './store.ts';
import { matchQuery, tokens } from './tokens.ts';
import type { Memory, RecallHit } from './types.ts';

export function recall(store: Store, query: string, now: string, limit = 8): RecallHit[] {
  const match = matchQuery(query);
  if (!match) return [];
  const raw = store.db.prepare(`SELECT id,bm25(search) AS rank FROM search WHERE search MATCH ? ORDER BY rank LIMIT 80`)
    .all(match) as { id: string; rank: number }[];
  const terms = new Set(tokens(query)), ranked = new Map<string, RecallHit>();
  const add = (record: Memory, lexical: number, reason: string) => {
    const days = Math.max(0, (Date.parse(now) - Date.parse(record.at)) / 86400000);
    const retention = record.pinned ? 1 : Math.pow(0.5, days / (10 + record.importance * 355));
    const score = lexical + record.importance * 0.3 + record.confidence * 0.15 + retention * 0.15;
    const old = ranked.get(record.id);
    if (!old || old.score < score) ranked.set(record.id, { memory: record, score, reasons: [reason, '重要性与时间衰减'] });
  };
  for (const row of raw) {
    const record = store.get(row.id);
    if (!record || record.status !== 'active') continue;
    const overlap = tokens(record.text).filter(x => terms.has(x)).length / Math.max(1, terms.size);
    add(record, overlap, '本地全文匹配');
  }
  // Associations are a bounded second hop, never unrestricted graph traversal.
  const best = [...ranked.values()].sort((a, b) => b.score - a.score).slice(0, 5);
  for (const hit of best) {
    const linked = store.db.prepare(`SELECT parent AS id FROM sources WHERE child=?
      UNION SELECT child AS id FROM sources WHERE parent=? LIMIT 6`).all(hit.memory.id, hit.memory.id) as { id: string }[];
    for (const link of linked) {
      const record = store.get(link.id);
      if (record?.status === 'active') add(record, hit.score * 0.25, `证据关联:${hit.memory.id}`);
    }
  }
  return [...ranked.values()].sort((a, b) => b.score - a.score || b.memory.at.localeCompare(a.memory.at)).slice(0, limit);
}
