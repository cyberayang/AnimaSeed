import { createHash } from 'node:crypto';
import { writeTransfer, readTransfer } from './transfer.ts';
import { Store } from './store.ts';
import type { Appraisal, Change, Identity, Memory } from './types.ts';
import * as v from './validation.ts';

export interface Payload { identity: Identity; memories: Memory[]; changes: Change[]; appraisals: Appraisal[] }
export interface Portable { format: 'memory-core'; version: 1; exportedAt: string; checksum: string; payload: Payload }
const checksum = (payload: unknown) => createHash('sha256').update(JSON.stringify(payload)).digest('hex');

export function pack(store: Store, now: string): Portable {
  const identity = store.identity();
  if (!identity) throw new Error('尚未初始化');
  const payload = { identity, memories: store.all(), changes: store.values<Change>('changes'), appraisals: store.values<Appraisal>('appraisals') };
  return { format: 'memory-core', version: 1, exportedAt: now, checksum: checksum(payload), payload };
}
export function validatePackage(value: unknown): Portable {
  const row = v.object(value);
  if (row.format !== 'memory-core' || row.version !== 1) throw new Error('不支持的迁移包版本');
  if (checksum(row.payload) !== row.checksum) throw new Error('迁移包校验失败');
  const data = v.object(row.payload), identity = v.identity(data.identity);
  const memories = v.list(data.memories, 1000000).map(v.memory), ids = new Map(memories.map(x => [x.id, x]));
  if (ids.size !== memories.length) throw new Error('迁移包含有重复记忆ID');
  const keys = memories.map(x => x.externalKey).filter(x => x !== null);
  if (new Set(keys).size !== keys.length) throw new Error('迁移包含有重复消息键');
  const checked = new Set<string>(), visiting = new Set<string>();
  function visit(record: Memory): void {
    if (visiting.has(record.id)) throw new Error('证据引用不能形成环');
    if (checked.has(record.id)) return;
    visiting.add(record.id);
    for (const citation of record.citations) {
      const source = ids.get(citation.id);
      if (!source || source.status === 'forgotten' || !source.text.includes(citation.quote)) throw new Error('迁移包证据链断裂');
      if (record.status === 'active' && source.status !== 'active') throw new Error('有效记忆引用了失效证据');
      if (['fact', 'habit'].includes(record.kind) && (source.kind !== 'episode' || source.role !== 'user')) throw new Error('事实需要用户证据');
      visit(source);
    }
    visiting.delete(record.id); checked.add(record.id);
  }
  memories.forEach(visit);
  const stateCitations = (value: unknown) => {
    const citations = v.citations(value);
    for (const citation of citations) {
      const source = ids.get(citation.id);
      if (!source || source.status === 'forgotten' || source.role !== 'user' || source.kind !== 'episode'
        || !source.text.includes(citation.quote)) throw new Error('迁移包状态证据不正确');
    }
    return citations;
  };
  const changes: Change[] = v.list(data.changes, 100000).map(item => {
    const x = v.object(item), citations = stateCitations(x.citations);
    if (citations.length < 3 || new Set(citations.map(c => ids.get(c.id)!.at.slice(0, 10))).size < 2) throw new Error('人格证据不足');
    return { id: v.text(x.id, '变化ID', 100), at: v.date(x.at), trait: v.trait(x.trait),
      delta: v.number(x.delta, -0.03, 0.03), why: v.text(x.why, '成长理由', 1000), citations };
  });
  const appraisals: Appraisal[] = v.list(data.appraisals, 100000).map(item => {
    const x = v.object(item);
    return { id: v.text(x.id, '情绪ID', 100), at: v.date(x.at), valence: v.number(x.valence, -0.3, 0.3),
      arousal: v.number(x.arousal, 0, 0.3), trust: v.number(x.trust, -0.02, 0.02),
      why: v.text(x.why, '情绪理由', 1000), citations: stateCitations(x.citations) };
  });
  if (new Set(changes.map(x => x.id)).size !== changes.length || new Set(appraisals.map(x => x.id)).size !== appraisals.length) throw new Error('重复状态ID');
  const payload = { identity, memories, changes, appraisals };
  return { format: 'memory-core', version: 1, exportedAt: v.date(row.exportedAt), checksum: checksum(payload), payload };
}
export function unpack(store: Store, archive: Portable): Identity {
  const packet = validatePackage(archive), { identity, memories, changes, appraisals } = packet.payload;
  store.transaction(() => {
    if (store.identity() || store.all().length) throw new Error('迁移只能导入空的数据目录，避免分叉或覆盖现有身份');
    store.setIdentity(identity);
    // Insert sources before children, regardless of archive ordering.
    const pending = new Map(memories.map(x => [x.id, x]));
    const inserted = new Set<string>();
    while (pending.size) {
      let progress = false;
      for (const record of pending.values()) if (record.citations.every(c => inserted.has(c.id))) {
        store.put(record); inserted.add(record.id); pending.delete(record.id); progress = true;
      }
      if (!progress) throw new Error('证据链无法排序');
    }
    for (const row of changes) store.addState('changes', row);
    for (const row of appraisals) store.addState('appraisals', row);
    store.audit('import', [identity.id], new Date().toISOString());
  });
  return identity;
}
export function savePackage(packet: Portable, path: string, password?: string): void {
  writeTransfer(packet, path, password);
}
export function loadPackage(path: string, password?: string): Portable {
  return validatePackage(readTransfer(path, password));
}
