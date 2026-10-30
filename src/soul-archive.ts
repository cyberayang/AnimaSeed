import { createHash } from 'node:crypto';
import { SoulRepository } from './soul-repository.ts';
import { validatePackage } from './portable.ts';
import type { Payload } from './portable.ts';
import { writeTransfer, readTransfer } from './transfer.ts';
import * as v from './validation.ts';
import * as sv from './soul-validation.ts';
import type { Lifecycle, LifeEntry, Stage } from './soul-types.ts';
import { STAGES } from './soul-types.ts';

export interface SoulPayload extends Omit<Payload, 'identity'> {
  identity: Payload['identity'] | null;
  lifecycle: Lifecycle;
  life: LifeEntry[];
  stage: { stage: Stage; at: string; eventId: string } | null;
  queue: { id: string; done: number }[];
}
export interface SoulArchive { format: 'soul-core'; version: 2; exportedAt: string; checksum: string; payload: SoulPayload }
export const digest = (value: unknown) => createHash('sha256').update(JSON.stringify(value)).digest('hex');
export function packSoul(repo: SoulRepository, now: string): SoulArchive {
  const payload: SoulPayload = { identity: repo.store.identity() ?? null, lifecycle: repo.lifecycle(), memories: repo.store.all(),
    changes: repo.store.values('changes'), appraisals: repo.store.values('appraisals'), life: repo.all(),
    stage: repo.store.meta('soul.stage') ?? null,
    queue: repo.store.db.prepare('SELECT id,done FROM soul_queue ORDER BY id').all() as { id: string; done: number }[] };
  return { format: 'soul-core', version: 2, exportedAt: now, checksum: digest(payload), payload };
}
export function validateSoulArchive(value: unknown): SoulArchive {
  const x = v.object(value);
  if (x.format !== 'soul-core' || x.version !== 2) throw new Error('不支持的灵魂档案版本；旧档案须显式接续');
  if (digest(x.payload) !== x.checksum) throw new Error('灵魂档案校验失败');
  const p = v.object(x.payload), lifecycle = sv.lifecycle(p.lifecycle);
  let base: Omit<Payload, 'identity'> & { identity: Payload['identity'] | null };
  if (p.identity === null) {
    if (v.list(p.memories, 1000000).length || v.list(p.changes, 100000).length || v.list(p.appraisals, 100000).length) throw new Error('未命名档案不能预填人生或人格');
    base = { identity: null, memories: [], changes: [], appraisals: [] };
  } else {
    const payload = { identity: p.identity, memories: p.memories, changes: p.changes, appraisals: p.appraisals };
    base = validatePackage({ format: 'memory-core', version: 1, exportedAt: x.exportedAt, checksum: digest(payload), payload }).payload;
  }
  const life = v.list(p.life, 1000000).map(sv.entry), entries = new Map(life.map(row => [row.id, row]));
  if (entries.size !== life.length) throw new Error('重复人生事件ID');
  const memories = new Map(base.memories.map(row => [row.id, row]));
  const visited = new Set<string>(), stack = new Set<string>();
  function visit(row: LifeEntry): void {
    if (stack.has(row.id)) throw new Error('人生证据不能形成环');
    if (visited.has(row.id)) return;
    stack.add(row.id);
    for (const ref of row.citations) {
      const source = ref.type === 'memory' ? memories.get(ref.id) : entries.get(ref.id);
      if (!source || source.status === 'forgotten' || source.status === 'redacted'
        || !source.text.includes(ref.quote) || source.at > row.at) throw new Error('人生证据断裂、已清除或时间顺序不正确');
      if (ref.type === 'life') visit(source as LifeEntry);
    }
    if (row.revisesId && !row.citations.some(ref => ref.type === 'life' && ref.id === row.revisesId)) throw new Error('认识变更缺少历史来源');
    stack.delete(row.id); visited.add(row.id);
  }
  life.forEach(visit);
  if (lifecycle.phase === 'awaiting-name') {
    if (base.identity || life.length || lifecycle.name || lifecycle.bornAt || lifecycle.birthEventId || lifecycle.origin !== 'newborn') throw new Error('未命名生命周期冲突');
  } else if (!base.identity || base.identity.id !== lifecycle.id || base.identity.name !== lifecycle.name) throw new Error('身份与人生档案不一致');
  if (lifecycle.phase === 'living') {
    const birth = entries.get(lifecycle.birthEventId ?? '');
    if (!birth || birth.kind !== (lifecycle.origin === 'newborn' ? 'birth' : 'adoption')) throw new Error('缺少出生或接续事件');
    if (lifecycle.origin === 'newborn' && (!lifecycle.bornAt || birth.at !== lifecycle.bornAt
      || base.identity!.createdAt !== lifecycle.bornAt || life.some(row => row.at < lifecycle.bornAt!))) throw new Error('出生时间与人生事件冲突');
  }
  const queue = v.list(p.queue, 1000000).map(item => {
    const row = v.object(item), id = v.text(row.id, '整理队列ID', 100);
    if (!memories.has(id) || (row.done !== 0 && row.done !== 1)) throw new Error('整理队列不正确');
    return { id, done: row.done as number };
  });
  if (new Set(queue.map(row => row.id)).size !== queue.length) throw new Error('重复队列ID');
  let stage: SoulPayload['stage'] = null;
  if (p.stage !== null) {
    const row = v.object(p.stage);
    if (!STAGES.includes(row.stage as never)) throw new Error('未知发展阶段');
    stage = { stage: row.stage as Stage, at: v.date(row.at), eventId: v.text(row.eventId, '阶段事件ID', 100) };
    const event = entries.get(stage.eventId);
    if (!event || event.kind !== 'stage' || event.at !== stage.at
      || (event.status === 'active' && event.details.stage !== stage.stage)) throw new Error('阶段状态与证据事件不一致');
  }
  const payload: SoulPayload = { ...base, lifecycle, life, stage, queue };
  return { format: 'soul-core', version: 2, exportedAt: v.date(x.exportedAt), checksum: digest(payload), payload };
}
export function saveSoulArchive(archive: SoulArchive, path: string, password?: string) { writeTransfer(archive, path, password); }
export function loadSoulArchive(path: string, password?: string) { return validateSoulArchive(readTransfer(path, password)); }
