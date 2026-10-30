import test from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { createHash } from 'node:crypto';
import { SoulCore } from '../src/index.ts';
import type { HostPermissionInput, HostExperienceInput } from '../src/index.ts';
import { soulFixture, mref, lref } from './soul-helpers.ts';
import { directory } from './helpers.ts';
import { Store } from '../src/store.ts';

function request(f: ReturnType<typeof soulFixture>) {
  const source = f.say('我喜欢摄影，你也可以想想空闲时自己想了解什么。');
  const intention = f.soul.intend({ text: '想看一段摄影视频', capability: 'host.video.any-provider', purpose: '了解构图',
    scope: '摄影相关视频，不读取私人账号信息', duration: '本次十分钟', citations: [mref(source)] });
  return { source, intention };
}
function grant(f: ReturnType<typeof soulFixture>, requestId: string, extra: Partial<HostPermissionInput> = {}) {
  const approval = f.say('同意本次查看摄影视频。');
  return f.soul.hostPermission({ requestId, hostId: 'fictional-host', eventId: 'grant-1', decision: 'granted',
    text: '宿主已核验用户授权', scope: '仅公开摄影视频', mode: 'once', expiresAt: '2026-01-02T09:00:00.000Z',
    approvalRef: 'fictional-ui-approval-1', approval: mref(approval), ...extra });
}
function experience(requestId: string, permissionId: string, extra: Partial<HostExperienceInput> = {}): HostExperienceInput {
  return { requestId, permissionId, hostId: 'fictional-host', eventId: 'view-1', outcome: 'completed',
    text: '实际看过一段构图视频，提到了画面留白。', ...extra };
}

test('普通锚点不进行全文检索，不按关键词扩大预算；模型显式回忆才检索', t => {
  const f = soulFixture(t), source = f.say('旧约定：一起看流星。');
  const original = DatabaseSync.prototype.prepare; let enabled = true;
  DatabaseSync.prototype.prepare = function(sql: string) {
    if (enabled && /\bMATCH\s+\?/u.test(sql)) throw new Error('本测试禁止自动全文检索');
    return original.call(this, sql);
  };
  t.after(() => { DatabaseSync.prototype.prepare = original; });
  const normal = f.soul.context('以前为什么没聊完那个约定？');
  assert(normal.chars <= 3000); assert(!normal.text.includes(source.text));
  assert(normal.text.includes('model-directed'));
  assert.throws(() => f.soul.context('流星', { mode: 'recall' }), /禁止自动全文检索/u);
  enabled = false;
  assert(f.soul.recall('流星').memories.some(x => x.memory.id === source.id));
  assert(f.soul.context('流星', { mode: 'recall' }).text.includes(source.text));
});

test('模型自选近期生活跨窗口接续，无需知道压缩时刻，隐私撤回同步清理', t => {
  const f = soulFixture(t), source = f.say('明天继续聊怎么陪我画画，不用一直盯着屏幕。');
  const continuity = f.soul.record({ kind: 'continuity', topic: '近期生活', text: '正在了解陪伴画画，明天接着聊；尊重对方独处。', citations: [mref(source)] });
  const identityId = f.soul.lifecycle().id;
  f.soul.close(); const reopened = new SoulCore(f.options); t.after(() => reopened.close());
  const frame = reopened.context('新的一天');
  assert.equal(frame.identityId, identityId);
  assert(frame.text.includes(continuity.text));
  const next = reopened.observe({ sessionId: 'new-chat', messageId: '1', role: 'user', text: '今天画完了，我们换个话题。' });
  const revised = reopened.record({ kind: 'continuity', topic: '近期生活', text: '画画话题已结束，现在可以自由聊新的兴趣。', revisesId: continuity.id, citations: [mref(next)] });
  assert(reopened.context('继续').text.includes(revised.text));
  assert(!reopened.context('继续').text.includes(continuity.text));
  reopened.privacyForget({ type: 'memory', id: source.id });
  assert(!reopened.context('继续').text.includes(revised.text));
});

test('意愿自由描述能力与用途，只有交接信息；模型不能伪造授权或执行经历', t => {
  const f = soulFixture(t), { intention } = request(f);
  assert.equal(f.soul.intend({ text: intention.text, capability: String(intention.details.capability), purpose: String(intention.details.purpose),
    scope: String(intention.details.scope), duration: String(intention.details.duration), citations: intention.citations }).id, intention.id);
  const view = f.soul.intentions()[0];
  assert.equal(view.authorization, 'needed'); assert.equal(view.experience, null);
  assert.equal(f.soul.timeline().filter(x => x.kind === 'experience').length, 0);
  assert.throws(() => f.soul.record({ kind: 'permission' as never, topic: '自我授权', text: '我宣布自己有权限', citations: [lref(intention)] }), /不能通过反思/u);
  assert.throws(() => f.soul.record({ kind: 'experience' as never, topic: '伪造经历', text: '我已经刷过视频', citations: [lref(intention)] }), /不能通过反思/u);
  assert.throws(() => f.soul.hostExperience(experience(intention.id, 'missing')), /权限回执/u);
});

test('宿主核验授权后才记录活动，一次授权使用后耗尽，同事件重试不重复', t => {
  const f = soulFixture(t), { intention } = request(f), permission = grant(f, intention.id);
  assert.equal(f.soul.intentions()[0].authorization, 'granted');
  assert.throws(() => f.soul.hostExperience(experience(intention.id, permission.id, { hostId: 'other' })), /对应宿主/u);
  const actual = f.soul.hostExperience(experience(intention.id, permission.id));
  assert.equal(f.soul.intentions()[0].authorization, 'consumed');
  f.day(3);
  assert.equal(f.soul.hostExperience(experience(intention.id, permission.id)).id, actual.id);
  assert.throws(() => f.soul.hostExperience(experience(intention.id, permission.id, { eventId: 'view-2' })), /过期|使用完毕/u);
  assert.throws(() => f.soul.hostExperience(experience(intention.id, permission.id, { text: '篡改同一事件' })), /相同宿主事件/u);
  const learning = f.soul.record({ kind: 'understanding', topic: '构图', text: '留白可以给画面留下空间', citations: [lref(actual)] });
  assert.equal(learning.citations[0].id, actual.id);
  assert.equal(f.soul.state().development.stage, 'newborn');
});

test('拒绝、撤回、过期与持续范围都由宿主回执表达，陈旧授权不能提交新活动', t => {
  const f = soulFixture(t), { intention } = request(f);
  f.soul.hostPermission({ requestId: intention.id, hostId: 'fictional-host', eventId: 'deny', decision: 'denied', text: '用户暂不允许' });
  assert.equal(f.soul.intentions()[0].authorization, 'denied');
  const permission = grant(f, intention.id, { mode: 'ongoing' });
  f.soul.hostExperience(experience(intention.id, permission.id));
  assert.equal(f.soul.intentions()[0].authorization, 'granted');
  f.soul.hostPermission({ requestId: intention.id, hostId: 'fictional-host', eventId: 'revoke', decision: 'revoked', text: '用户撤回本次权限' });
  assert.equal(f.soul.intentions()[0].authorization, 'revoked');
  assert.throws(() => f.soul.hostExperience(experience(intention.id, permission.id, { eventId: 'after-revoke' })), /撤回/u);
  const renewed = grant(f, intention.id, { eventId: 'renewed', mode: 'ongoing' });
  f.day(2);
  assert.equal(f.soul.intentions()[0].authorization, 'expired');
  assert.throws(() => f.soul.hostExperience(experience(intention.id, renewed.id, { eventId: 'after-expiry' })), /过期/u);
});

test('模型可以改变主意并撤回自己的意愿，原授权不再支持后续活动', t => {
  const f = soulFixture(t), { intention, source } = request(f), permission = grant(f, intention.id, { mode: 'ongoing' });
  const changed = f.soul.intend({ text: '现在想安静待着，暂时不看视频', capability: String(intention.details.capability),
    purpose: '自己改变了想法', scope: String(intention.details.scope), duration: '现在', citations: [mref(source)], revisesId: intention.id, state: 'withdrawn' });
  assert.equal(f.soul.intentions()[0].intention.id, changed.id);
  assert.equal(f.soul.intentions()[0].authorization, 'cancelled');
  assert.throws(() => f.soul.hostExperience(experience(intention.id, permission.id)), /撤回/u);
  assert.throws(() => grant(f, intention.id, { eventId: 'late-grant' }), /已撤回|已修正/u);
  const restored = SoulCore.restore(f.soul.export(), { dataDir: directory(t), clock: f.options.clock }); t.after(() => restored.close());
  assert.equal(restored.intentions()[0].authorization, 'cancelled');
});

test('迁移保存意愿和真实经历，历史授权不变成新端权限，重新核验后才可继续', t => {
  const f = soulFixture(t), { intention } = request(f), permission = grant(f, intention.id, { mode: 'ongoing' });
  const actual = f.soul.hostExperience(experience(intention.id, permission.id));
  const archive = f.soul.export(); assert.equal(archive.version, 3);
  const restored = SoulCore.restore(archive, { dataDir: directory(t), clock: f.options.clock }); t.after(() => restored.close());
  assert.deepEqual(restored.export().payload.life, archive.payload.life);
  assert.equal(restored.intentions()[0].experience?.id, actual.id);
  assert.equal(restored.intentions()[0].authorization, 'revalidation-required');
  assert.throws(() => restored.hostExperience(experience(intention.id, permission.id, { eventId: 'new-device-activity' })), /重新核验/u);
  const allowed = restored.hostPermission({ requestId: intention.id, hostId: 'new-host', eventId: 'new-grant', decision: 'granted',
    text: '新宿主已重新核验授权', scope: '仍仅公开视频', mode: 'once', expiresAt: null, approvalRef: 'new-host-approval' });
  restored.hostExperience(experience(intention.id, allowed.id, { hostId: 'new-host', eventId: 'new-view' }));
  assert.equal(restored.intentions()[0].authorization, 'consumed');
  const invalid = f.soul.export();
  invalid.payload.life.find(x => x.id === permission.id)!.details.decision = 'denied';
  invalid.checksum = createHash('sha256').update(JSON.stringify(invalid.payload)).digest('hex');
  assert.throws(() => SoulCore.restore(invalid, { dataDir: directory(t), clock: f.options.clock }), /重放|权限/u);
});

test('宿主经历及其衍生认识在隐私清除后无法通过迁移或回执重放复活', t => {
  const f = soulFixture(t), { intention } = request(f), permission = grant(f, intention.id);
  const secret = '虚构私人标记：纸鹤九四二';
  const actual = f.soul.hostExperience(experience(intention.id, permission.id, { text: secret }));
  f.soul.record({ kind: 'continuity', topic: '近期生活', text: '最近的活动留下了' + secret, citations: [lref(actual)] });
  f.soul.privacyForget({ type: 'life', id: actual.id, match: secret });
  assert(!JSON.stringify(f.soul.export()).includes(secret));
  assert.throws(() => f.soul.hostExperience(experience(intention.id, permission.id, { text: secret })), /已清除/u);
  assert.equal(f.soul.intentions().length, 0);
});

test('空闲机会本身不生成经历，模型可提议或不行动，新意愿失败时整批回滚', async t => {
  const f = soulFixture(t), { source } = request(f), count = f.soul.timeline().length;
  assert.equal(f.soul.idle().kind, 'idle-opportunity'); assert.equal(f.soul.timeline().length, count);
  const requested = { text: '想看看摄影图片', capability: 'any.image-source', purpose: '继续探索', scope: '公开图片', duration: '一次', citations: [mref(source)] };
  const result = await f.soul.reflect(async () => ({ intentions: [requested] }));
  assert('intentions' in result); assert.equal(result.intentions[0].text, requested.text);
  assert.equal(f.soul.intentions()[0].authorization, 'needed');
  f.say('新的输入'); const before = f.soul.intentions().length;
  await assert.rejects(f.soul.reflect(async () => ({ intentions: [
    { ...requested, text: '正常的新意愿' }, { ...requested, text: '坏的意愿', citations: [{ type: 'memory', id: 'missing', quote: '不存在' }] },
  ] })), /证据/u);
  assert.equal(f.soul.intentions().length, before);
});

test('版本2人生可读入并继续同一身份，旧数据库拒绝降级读取新增记录', t => {
  const f = soulFixture(t), archive = f.soul.export(); archive.version = 2;
  const restored = SoulCore.restore(archive, { dataDir: directory(t), clock: f.options.clock }); t.after(() => restored.close());
  assert.equal(restored.lifecycle().id, f.soul.lifecycle().id);
  const database = new DatabaseSync(restored.dataDir + '/memory.sqlite');
  assert.equal((database.prepare('PRAGMA user_version').get() as { user_version: number }).user_version, 3); database.close();
  assert.throws(() => new Store(restored.dataDir, 2), /不能降级/u);
});
