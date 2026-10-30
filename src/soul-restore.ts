import { SoulRepository } from './soul-repository.ts';
import { authorLife } from './soul-life.ts';
import { growthSample, growthReview } from './soul-growth-evidence.ts';
import { advance } from './soul-development.ts';
import { stableId } from './memories.ts';
import type { SoulArchive } from './soul-archive.ts';
import type { LifeEntry, LifeInput, GrowthSampleInput, Stage } from './soul-types.ts';
import { STAGES } from './soul-types.ts';
import { intend, hostPermission, hostExperience } from './soul-agency.ts';
import type { HostPermissionInput, HostExperienceInput } from './agency-types.ts';

export function restoreSoul(repo: SoulRepository, archive: SoulArchive, now: string): void {
  if (repo.store.identity() || repo.store.all().length || repo.all().length || repo.lifecycle().phase !== 'awaiting-name') throw new Error('只能导入空灵魂目录，拒绝覆盖或合并不同人生');
  const p = archive.payload;
  if (p.identity) repo.store.setIdentity(p.identity);
  repo.store.setMeta('soul.lifecycle', p.lifecycle);
  const pendingMemories = new Map(p.memories.map(row => [row.id, row]));
  while (pendingMemories.size) {
    let changed = false;
    for (const row of pendingMemories.values()) if (row.citations.every(ref => !!repo.store.get(ref.id))) {
      repo.store.put(row); pendingMemories.delete(row.id); changed = true;
    }
    if (!changed) throw new Error('记忆证据链无法排序');
  }
  for (const row of p.changes) repo.store.addState('changes', row);
  for (const row of p.appraisals) repo.store.addState('appraisals', row);
  const pending = [...p.life].sort((a, b) => a.at.localeCompare(b.at));
  while (pending.length) {
    const index = pending.findIndex(row => row.citations.every(ref => ref.type === 'memory' || !!repo.get(ref.id)));
    if (index < 0) throw new Error('人生证据链无法排序');
    const [row] = pending.splice(index, 1);
    if (row.status === 'redacted') { repo.put(row); continue; }
    let rebuilt: LifeEntry;
    if (row.kind === 'intention') rebuilt = intend(repo, { text: row.text, capability: String(row.details.capability),
      purpose: String(row.details.purpose), scope: String(row.details.scope), duration: String(row.details.duration), citations: row.citations,
      revisesId: row.revisesId ?? undefined, state: row.details.intentionState as 'open' | 'withdrawn' }, row.at);
    else if (row.kind === 'permission') rebuilt = hostPermission(repo, { ...row.details, text: row.text,
      approval: row.citations[1] } as unknown as HostPermissionInput, row.at, String(row.details.epoch));
    else if (row.kind === 'experience') {
      const permission = repo.get(String(row.details.permissionId));
      rebuilt = hostExperience(repo, { ...row.details, text: row.text, url: row.details.url || undefined } as unknown as HostExperienceInput,
        row.at, String(permission?.details.epoch));
    }
    else if (row.kind === 'growth-sample') rebuilt = growthSample(repo, row.details as unknown as GrowthSampleInput, row.at);
    else if (row.kind === 'growth-review') rebuilt = growthReview(repo, { sampleId: String(row.details.sampleId),
      verdict: row.details.verdict as 'supported', rationale: row.text }, row.at);
    else if (row.kind === 'stage') {
      const prior = row.details.prior as Stage;
      if (STAGES.includes(prior) && prior !== 'newborn' && !repo.store.meta('soul.stage')) {
        const archivedPrior = p.life.find(x => x.kind === 'stage' && x.status === 'redacted' && x.at < row.at);
        if (!archivedPrior) throw new Error('缺少前一阶段的人生历史');
        repo.store.setMeta('soul.stage', { stage: prior, at: archivedPrior.at, eventId: archivedPrior.id });
      }
      const next = advance(repo, row.at);
      if (next.stage !== row.details.stage) throw new Error('阶段未通过时间、经历和跨时评估约束');
      rebuilt = repo.get(row.id)!;
    } else if (['birth', 'adoption', 'interaction'].includes(row.kind)) {
      if (row.kind === 'birth' && row.id !== stableId('birth', p.lifecycle.id)) throw new Error('出生事件ID不正确');
      if (row.kind === 'interaction') {
        const source = row.citations.length === 1 && row.citations[0].type === 'memory' ? repo.store.get(row.citations[0].id) : undefined;
        if (!source || row.id !== stableId('interaction', source.id) || row.details.role !== source.role) throw new Error('互动记录与原件不一致');
      }
      rebuilt = repo.put(row);
    } else rebuilt = authorLife(repo, { ...row, kind: row.kind as LifeInput['kind'], revisesId: row.revisesId ?? undefined,
      outcome: row.details.outcome as LifeInput['outcome'], interestState: row.details.interestState as LifeInput['interestState'],
      affect: row.kind === 'affect' ? { valence: Number(row.details.valence), arousal: Number(row.details.arousal), trust: Number(row.details.trust) } : undefined }, row.at);
    if (!rebuilt || rebuilt.id !== row.id || (['intention', 'permission', 'experience'].includes(row.kind)
      && (JSON.stringify(rebuilt.details) !== JSON.stringify(row.details) || rebuilt.text !== row.text))) throw new Error('重放人生记录与档案不一致：' + row.kind);
  }
  if (p.stage) repo.store.setMeta('soul.stage', p.stage);
  for (const item of p.queue) repo.store.db.prepare('INSERT INTO soul_queue(id,done) VALUES(?,?)').run(item.id, item.done);
  repo.store.audit('soul.import', [p.lifecycle.id], now); repo.changed();
}
