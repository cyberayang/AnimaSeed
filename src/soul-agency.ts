import { SoulRepository } from './soul-repository.ts';
import { requireLiving, ancestry } from './soul-life.ts';
import { stableId } from './memories.ts';
import * as v from './validation.ts';
import { refs } from './soul-validation.ts';
import type { LifeEntry, SourceRef } from './soul-types.ts';
import type { IntentionInput, IntentionView, HostPermissionInput, HostExperienceInput } from './agency-types.ts';

export function intentionInput(input: unknown): IntentionInput {
  const x = v.object(input);
  if (x.state !== undefined && x.state !== 'open' && x.state !== 'withdrawn') throw new Error('意愿状态需要open或withdrawn');
  return { text: v.text(x.text, '意愿', 1500), capability: v.text(x.capability, '所需能力', 160),
    purpose: v.text(x.purpose, '用途', 800), scope: v.text(x.scope, '请求范围', 1000),
    duration: v.text(x.duration, '请求时长', 200), citations: refs(x.citations),
    revisesId: x.revisesId === undefined ? undefined : v.text(x.revisesId, '前一意愿ID', 100), state: (x.state ?? 'open') as 'open' | 'withdrawn' };
}
const cite = (row: LifeEntry): SourceRef => ({ type: 'life', id: row.id, quote: row.text.slice(0, 1800) });
export function intend(repo: SoulRepository, input: IntentionInput, now: string): LifeEntry {
  requireLiving(repo);
  const value = intentionInput(input);
  const previous = value.revisesId ? request(repo, value.revisesId) : undefined;
  if (value.state === 'withdrawn' && !previous) throw new Error('撤回意愿需指明revisesId');
  if (previous && !value.citations.some(x => x.type === 'life' && x.id === previous.id)) value.citations.push(cite(previous));
  value.citations.sort((a, b) => (a.type + a.id).localeCompare(b.type + b.id));
  const id = stableId('intention', value), prior = repo.get(id);
  if (prior) {
    if (prior.status === 'redacted') throw new Error('意愿来源已清除，不能重新提交');
    return prior;
  }
  if (previous && repo.historical(previous.id)) throw new Error('意愿已有后续版本，请先读取当前意愿');
  repo.validateSources(value.citations, now);
  const roots = ancestry(repo, value.citations);
  if (!roots.memories.some(x => x.role === 'user') && !roots.entries.some(isExperience)) throw new Error('意愿需要已有真实经历来源');
  return repo.put({ id, kind: 'intention', status: 'active', at: now, text: value.text, topic: value.capability.slice(0, 100),
    confidence: 1, revisesId: previous?.id ?? null, citations: value.citations,
    details: { authority: 'intention-only', capability: value.capability, purpose: value.purpose, scope: value.scope, duration: value.duration, intentionState: value.state! } });
}
export function isExperience(row: LifeEntry): boolean {
  return row.kind === 'experience' && row.status === 'active' && row.details.outcome === 'completed';
}
function latest(repo: SoulRepository, kind: 'permission' | 'experience', requestId: string): LifeEntry | null {
  const row = repo.store.db.prepare(`SELECT data FROM soul_life WHERE status='active' AND kind=?
    AND json_extract(data,'$.details.requestId')=? ORDER BY at DESC,rowid DESC LIMIT 1`).get(kind, requestId) as { data: string } | undefined;
  return row ? JSON.parse(row.data) : null;
}
export function intentionView(repo: SoulRepository, intention: LifeEntry, now: string, epoch?: string): IntentionView {
  const permission = latest(repo, 'permission', intention.id), experience = latest(repo, 'experience', intention.id);
  let authorization: IntentionView['authorization'] = 'needed';
  if (permission) {
    const decision = permission.details.decision as HostPermissionInput['decision'];
    authorization = decision;
    if (decision === 'granted') {
      if (permission.details.mode === 'once' && experience?.details.permissionId === permission.id) authorization = 'consumed';
      else if (permission.details.epoch !== (epoch ?? repo.store.meta('soul.host-epoch'))) authorization = 'revalidation-required';
      else if (typeof permission.details.expiresAt === 'string' && permission.details.expiresAt <= now) authorization = 'expired';
    }
  }
  if (intention.details.intentionState === 'withdrawn' || repo.historical(intention.id)) authorization = 'cancelled';
  return { intention, permission, experience, authorization };
}
export function intentions(repo: SoulRepository, now: string, limit = 8): IntentionView[] {
  v.number(limit, 1, 50, '意愿数量');
  return repo.current('intention', Math.floor(limit)).map(row => intentionView(repo, row, now));
}
function request(repo: SoulRepository, id: string): LifeEntry {
  const row = repo.get(v.text(id, '意愿ID', 100));
  if (!row || row.status !== 'active' || row.kind !== 'intention') throw new Error('意愿不存在或已清除');
  return row;
}
function putHost(repo: SoulRepository, row: LifeEntry): LifeEntry {
  const old = repo.get(row.id);
  if (old?.status === 'redacted') throw new Error('宿主事件已清除，不能重放');
  if (old) {
    if (old.kind !== row.kind || old.text !== row.text || JSON.stringify(old.details) !== JSON.stringify(row.details)
      || JSON.stringify(old.citations) !== JSON.stringify(row.citations)) throw new Error('相同宿主事件ID内容不同');
    return old;
  }
  return repo.put(row);
}
// Only trusted host code calls these APIs. They record the host's decision;
// the host still enforces real permissions and validates its approval reference.
export function hostPermission(repo: SoulRepository, input: HostPermissionInput, now: string, epoch?: string): LifeEntry {
  requireLiving(repo);
  const x = v.object(input), intent = request(repo, input.requestId);
  const hostId = v.text(x.hostId, '宿主标识', 160), eventId = v.text(x.eventId, '宿主事件ID', 200);
  if (!['granted', 'denied', 'revoked', 'unavailable', 'cancelled'].includes(String(x.decision))) throw new Error('宿主权限结论不正确');
  const granted = x.decision === 'granted';
  if (granted && (intent.details.intentionState === 'withdrawn' || repo.historical(intent.id))) throw new Error('意愿已撤回或已修正，不能继续授权');
  const scope = granted ? v.text(x.scope, '实际授权范围', 1000) : String(intent.details.scope);
  if (granted && x.expiresAt !== null && x.expiresAt === undefined) throw new Error('授权需明确expiresAt，null表示由宿主持续管理直至撤回');
  const expiresAt = granted && x.expiresAt !== null ? v.date(x.expiresAt) : null;
  if (granted && x.mode !== 'once' && x.mode !== 'ongoing') throw new Error('授权需明确once或ongoing');
  const citations = [cite(intent)];
  if (x.approval !== undefined) {
    const approval = refs([x.approval])[0];
    const source = approval.type === 'memory' ? repo.store.get(approval.id) : undefined;
    if (!source || source.role !== 'user' || source.status !== 'active') throw new Error('对话授权来源需为真实用户原话');
    citations.push(approval);
  }
  const approvalRef = granted ? v.text(x.approvalRef, '宿主核验后的授权凭据引用', 500) : '';
  const row: LifeEntry = { id: stableId('host', [hostId, eventId]), kind: 'permission', status: 'active', at: now,
    text: v.text(x.text, '宿主权限说明', 1500), topic: intent.topic, revisesId: null, confidence: 1, citations,
    details: { authority: 'host-attestation', requestId: intent.id, hostId, eventId, decision: String(x.decision), scope,
      mode: granted ? String(x.mode) : 'once', expiresAt, approvalRef, epoch: epoch ?? repo.store.meta<string>('soul.host-epoch')! } };
  repo.validateSources(citations, now);
  if (repo.get(row.id)) return putHost(repo, row);
  if (expiresAt && expiresAt <= now) throw new Error('授权到期时间应晚于提交时间');
  const current = latest(repo, 'permission', intent.id);
  if (current && current.details.epoch === row.details.epoch && current.details.hostId !== hostId) throw new Error('已有宿主权限记录，需由原宿主处理或迁移后重新核验');
  return putHost(repo, row);
}
export function hostExperience(repo: SoulRepository, input: HostExperienceInput, now: string, epoch?: string): LifeEntry {
  requireLiving(repo);
  const x = v.object(input), intent = request(repo, input.requestId);
  const hostId = v.text(x.hostId, '宿主标识', 160), eventId = v.text(x.eventId, '宿主事件ID', 200);
  const permissionId = v.text(x.permissionId, '权限回执ID', 100), permission = repo.get(permissionId);
  if (!permission || permission.kind !== 'permission' || permission.status !== 'active'
    || permission.details.requestId !== intent.id || permission.details.hostId !== hostId) throw new Error('经历需要对应宿主、意愿和有效权限回执');
  if (x.outcome !== 'completed' && x.outcome !== 'failed') throw new Error('经历结果需要completed或failed');
  const id = stableId('host', [hostId, eventId]), prior = repo.get(id);
  const occurredAt = x.occurredAt === undefined ? String(prior?.details.occurredAt ?? now) : v.date(x.occurredAt);
  if (occurredAt > now || occurredAt < permission.at) throw new Error('经历时间不能早于授权或来自未来');
  const row: LifeEntry = { id, kind: 'experience', status: 'active', at: now,
    text: v.text(x.text, '真实经历', 3000), topic: intent.topic, revisesId: null, confidence: 1,
    citations: [cite(intent), cite(permission)], details: { authority: 'host-observation', requestId: intent.id, permissionId,
      hostId, eventId, outcome: String(x.outcome), occurredAt, url: x.url === undefined ? '' : v.text(x.url, '来源地址', 1500) } };
  if (prior) return putHost(repo, row);
  const view = intentionView(repo, intent, now, epoch);
  if (view.permission?.id !== permissionId || view.authorization !== 'granted') throw new Error('权限尚未授予、已撤回、过期、使用完毕或需重新核验');
  return putHost(repo, row);
}
