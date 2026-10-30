import { stableId, observe } from './memories.ts';
import { SoulRepository } from './soul-repository.ts';
import * as v from './validation.ts';
import type { Lifecycle } from './soul-types.ts';

export interface NamingInput { name: string; namedBy: string; sessionId: string; messageId: string; text: string }
export function namingPhrase(text: string): string | undefined {
  const match = text.trim().match(/^(?:给你起名|为你命名|名字|name)\s*[：:]\s*([^\r\n]{1,80})$/iu);
  return match?.[1].trim();
}
export function birth(repo: SoulRepository, input: NamingInput, now: string): Lifecycle {
  const lifecycle = repo.lifecycle(), name = v.text(input.name.trim(), '名字', 80);
  if (/[\u0000-\u001f\u007f]/u.test(name)) throw new Error('名字包含控制字符');
  const request = JSON.stringify([v.text(input.sessionId, '会话ID', 200), v.text(input.messageId, '消息ID', 200)]);
  if (lifecycle.phase === 'living') {
    if (lifecycle.namingRequest === request && lifecycle.name === name) return lifecycle;
    throw new Error('这个身份已命名；日常命名不能重置人生');
  }
  if (lifecycle.phase === 'legacy') throw new Error('检测到旧身份，需要在管理入口显式接续，不能重新出生');
  if (namingPhrase(input.text) !== name) throw new Error('命名需要明确确认：给你起名：名字');
  const namedBy = v.text(input.namedBy, '命名者', 80);
  const source = observe(repo.store, { sessionId: input.sessionId, messageId: input.messageId,
    role: 'user', text: input.text, pinned: true, at: now }, now);
  const id = stableId('birth', lifecycle.id);
  repo.enqueue(source.id);
  repo.put({ id, kind: 'birth', at: now, status: 'active', text: `由${namedBy}命名为${name}。`, topic: '命名与出生',
    citations: [{ type: 'memory', id: source.id, quote: input.text }], revisesId: null, confidence: 1,
    details: { name, namedBy } });
  const next: Lifecycle = { ...lifecycle, phase: 'living', bornAt: now, name, namedBy, birthEventId: id, namingRequest: request };
  repo.store.setIdentity({ id: next.id, name, createdAt: now,
    principles: ['保留真实经历与来源', '通过交流形成认识，尊重不同意见', '承认不确定，遵守隐私边界'],
    baseline: { warmth: 0.5, directness: 0.5, curiosity: lifecycle.temperament.inquiry, restraint: lifecycle.temperament.caution } });
  repo.store.setMeta('soul.lifecycle', next);
  repo.store.db.exec('PRAGMA user_version=2');
  repo.store.audit('soul.birth', [id], now);
  repo.changed();
  return next;
}
export function adopt(repo: SoulRepository, confirmed: boolean, now: string): Lifecycle {
  if (!confirmed || repo.lifecycle().phase !== 'legacy') throw new Error('接续旧身份需要管理入口明确确认');
  const prior = repo.lifecycle(), old = repo.store.identity()!;
  const source = observe(repo.store, { sessionId: 'soul-management', messageId: `adopt:${old.id}`,
    role: 'user', text: '管理者确认接续现有身份与档案，不把接续时间伪装成原始出生时间。', pinned: true }, now);
  const event = repo.put({ id: stableId('adopt', old.id), kind: 'adoption', at: now, status: 'active',
    text: '接续既有身份；此前的出生与发展阶段尚未评估。', topic: '身份接续',
    citations: [{ type: 'memory', id: source.id, quote: source.text }], revisesId: null, confidence: 1, details: {} });
  const next: Lifecycle = { ...prior, phase: 'living', origin: 'adopted', birthEventId: event.id };
  repo.store.setMeta('soul.lifecycle', next); repo.store.db.exec('PRAGMA user_version=2'); repo.changed(); return next;
}
