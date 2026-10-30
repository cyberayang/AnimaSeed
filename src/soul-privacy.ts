import { forget, ancestors } from './memories.ts';
import { SoulRepository } from './soul-repository.ts';
import type { SourceRef } from './soul-types.ts';
import type { PrivacyTarget } from './soul-types.ts';
import * as v from './validation.ts';

export function privacyRedact(repo: SoulRepository, target: PrivacyTarget, now: string) {
  const memoryIds = new Set<string>(), lifeIds = new Set<string>();
  const queue = [target], visited = new Set<string>();
  if (target.match !== undefined) {
    const match = v.text(target.match, '明确清除的词组', 2000);
    if (match.length < 2) throw new Error('跨档案匹配词组至少两个字符，避免误删');
    const source = target.type === 'memory' ? repo.store.get(target.id) : repo.get(target.id);
    if (!source || (!source.text.includes(match) && !('topic' in source && source.topic.includes(match)))) throw new Error('清除词组需要出现在指定目标中');
    const memoryMatches = repo.store.db.prepare(`SELECT DISTINCT n.id FROM nodes n,json_tree(n.data) j
      WHERE n.status!='forgotten' AND j.type='text' AND instr(j.value,?)>0`).all(match) as { id: string }[];
    const lifeMatches = repo.store.db.prepare(`SELECT DISTINCT n.id FROM soul_life n,json_tree(n.data) j
      WHERE n.status='active' AND j.type='text' AND instr(j.value,?)>0`).all(match) as { id: string }[];
    queue.push(...memoryMatches.map(x => ({ type: 'memory' as const, id: x.id })),
      ...lifeMatches.map(x => ({ type: 'life' as const, id: x.id })));
  }
  // Clear all source material as well, so a later reflection cannot reconstruct it.
  for (let i = 0; i < queue.length; i++) {
    const item = queue[i], key = item.type + ':' + item.id;
    if (visited.has(key)) continue;
    visited.add(key);
    if (item.type === 'memory') {
      const source = repo.store.get(item.id);
      if (!source) throw new Error('找不到要清除的记忆');
      for (const id of ancestors(repo.store, item.id)) memoryIds.add(id);
    } else {
      const source = repo.get(item.id);
      if (!source) throw new Error('找不到要清除的人生记录');
      lifeIds.add(item.id); queue.push(...source.citations.map(x => ({ type: x.type, id: x.id })));
    }
  }
  for (const id of [...memoryIds]) for (const affected of forget(repo.store, id, now)) memoryIds.add(affected);
  for (const id of memoryIds) repo.store.db.prepare('UPDATE soul_queue SET done=1 WHERE id=?').run(id);
  const affected = [...memoryIds].map(id => ({ type: 'memory' as const, id }));
  const dependents: Pick<SourceRef, 'type' | 'id'>[] = [...affected, ...[...lifeIds].map(id => ({ type: 'life' as const, id }))];
  for (let i = 0; i < dependents.length; i++) {
    const item = dependents[i];
    const rows = repo.store.db.prepare('SELECT child FROM soul_links WHERE source_type=? AND source_id=?').all(item.type, item.id) as { child: string }[];
    for (const row of rows) if (!lifeIds.has(row.child)) { lifeIds.add(row.child); dependents.push({ type: 'life', id: row.child }); }
  }
  for (const id of lifeIds) {
    const record = repo.get(id)!;
    repo.store.db.prepare('UPDATE soul_life SET status=?,data=? WHERE id=?').run('redacted', JSON.stringify({ ...record,
      status: 'redacted', text: '', topic: '', citations: [], revisesId: null, confidence: 0, details: {} }), id);
    repo.store.db.prepare('DELETE FROM soul_search WHERE id=?').run(id);
    repo.store.db.prepare('DELETE FROM soul_links WHERE child=?').run(id);
  }
  const lifecycle = repo.lifecycle();
  if ((lifecycle.birthEventId && lifeIds.has(lifecycle.birthEventId))
    || (target.match && ((lifecycle.name ?? '').includes(target.match) || (lifecycle.namedBy ?? '').includes(target.match)))) {
    repo.store.setMeta('soul.lifecycle', { ...lifecycle, name: '已隐去', namedBy: null });
    const identity = repo.store.identity();
    if (identity) repo.store.setIdentity({ ...identity, name: '已隐去' });
  }
  if (target.match) {
    const identity = repo.store.identity();
    if (identity) repo.store.setIdentity({ ...identity, principles: identity.principles.filter(x => !x.includes(target.match!)) });
  }
  // Cursor carries IDs only. Failed/reflected prose is never stored in operational metadata.
  repo.changed(); repo.store.audit('soul.privacy-redact', [...memoryIds, ...lifeIds], now);
  return { memoryIds: [...memoryIds], lifeIds: [...lifeIds], scope: '本数据目录及此后的导出；宿主日志与既有备份需另行处理' };
}
