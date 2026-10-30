import test from 'node:test';
import assert from 'node:assert/strict';
import { join } from 'node:path';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { SoulCore, saveSoulArchive, loadSoulArchive, validateSoulArchive } from '../src/index.ts';
import { soulFixture, mref, lesson } from './soul-helpers.ts';
import { directory } from './helpers.ts';

test('整个人生加密迁移：出生、认识变化、兴趣、成长链和当前阶段保持一致', t => {
  const f = soulFixture(t);
  lesson(f, 'understanding', 0, '安静读书'); lesson(f, 'understanding', 8, '慢慢散步');
  lesson(f, 'self', 16, '选择绘本'); lesson(f, 'self', 24, '选择故事'); f.soul.sleep();
  const source = f.say('还想弄明白怎样表达不同意见');
  f.soul.record({ kind: 'interest', topic: '不同意见', text: '想理解表达不同意见的方法', citations: [mref(source)] });
  const path = join(directory(t), 'life.memory.enc'), password = 'fictional-password-only-12345';
  const archive = f.soul.export();
  saveSoulArchive(archive, path, password);
  assert(!readFileSync(path, 'utf8').includes('安静读书'));
  const restored = SoulCore.restore(loadSoulArchive(path, password), { dataDir: directory(t), clock: f.options.clock });
  t.after(() => restored.close());
  assert.deepEqual(restored.state(), f.soul.state());
  assert.deepEqual(restored.export().payload.life, archive.payload.life);
  assert.deepEqual(restored.export().payload.queue, archive.payload.queue);
  assert.throws(() => SoulCore.restore(archive, f.options), /拒绝覆盖/u);
});
test('未命名的等待状态可迁移，不预填名字或重复出生', t => {
  const f = soulFixture(t, undefined, false);
  const restored = SoulCore.restore(f.soul.export(), { dataDir: directory(t), clock: f.options.clock });
  t.after(() => restored.close());
  assert.equal(restored.lifecycle().id, f.soul.lifecycle().id);
  assert.equal(restored.lifecycle().phase, 'awaiting-name');
  assert.equal(restored.timeline().length, 0);
});
test('隐私清除传播到人生章节和成长状态，迁移后也不能复活', t => {
  const f = soulFixture(t), item = lesson(f, 'self', 0, '私密标记松柏小路七一二');
  const secret = '私密标记松柏小路七一二';
  f.soul.privacyForget({ type: 'memory', id: item.first.id, match: secret });
  const packet = f.soul.export();
  assert(!JSON.stringify(packet).includes(secret));
  assert.equal(f.soul.state().development.dimensions.self.score, 0);
  assert(!readFileSync(join(f.dataDir, 'memory.sqlite')).includes(Buffer.from(secret)));
  const restored = SoulCore.restore(packet, { dataDir: directory(t), clock: f.options.clock });
  t.after(() => restored.close());
  assert.equal(restored.life(item.learning.id)?.status, 'redacted');
  assert.equal(restored.recall(secret).life.length, 0);
});
test('隐去命名资料不重生或恢复姓名，原始出生时间仍诚实保留', t => {
  const f = soulFixture(t), original = f.soul.lifecycle();
  f.soul.privacyForget({ type: 'life', id: original.birthEventId! });
  const packet = f.soul.export();
  assert(!JSON.stringify(packet).includes('小禾'));
  assert.equal(f.soul.lifecycle().name, '已隐去');
  assert.equal(f.soul.lifecycle().bornAt, original.bornAt);
  const restored = SoulCore.restore(packet, { dataDir: directory(t), clock: f.options.clock });
  t.after(() => restored.close());
  assert.equal(restored.lifecycle().phase, 'living');
  assert.equal(restored.lifecycle().name, '已隐去');
});
test('迁移拒绝损坏、引用伪造与伪造的成年阶段，并回滚目标目录', t => {
  const f = soulFixture(t), source = f.say('真实的测试原文');
  f.soul.record({ kind: 'understanding', topic: '测试', text: '先记住这是测试', citations: [mref(source)] });
  const packet = f.soul.export();
  packet.payload.life.find(x => x.kind === 'understanding')!.citations[0].quote = '完全不存在的原文';
  assert.throws(() => validateSoulArchive(packet), /校验失败/u);
  packet.checksum = createHash('sha256').update(JSON.stringify(packet.payload)).digest('hex');
  assert.throws(() => validateSoulArchive(packet), /证据/u);
  const invalid = f.soul.export();
  invalid.payload.stage = { stage: 'young-adult', at: f.options.clock().toISOString(), eventId: invalid.payload.life[0].id };
  invalid.checksum = createHash('sha256').update(JSON.stringify(invalid.payload)).digest('hex');
  assert.throws(() => SoulCore.restore(invalid, { dataDir: directory(t), clock: f.options.clock }), /阶段/u);
  const staged = f.soul.export(), born = staged.payload.life.find(x => x.kind === 'birth')!;
  const targetDir = directory(t);
  staged.payload.life.push({ id: 'stage-fake-adult', kind: 'stage', at: f.options.clock().toISOString(), status: 'active',
    topic: '发展阶段', text: '声明自己已成年', confidence: 0.7, revisesId: null,
    citations: [{ type: 'life', id: born.id, quote: born.text }], details: { stage: 'young-adult', prior: 'newborn' } });
  staged.payload.stage = { stage: 'young-adult', at: f.options.clock().toISOString(), eventId: 'stage-fake-adult' };
  staged.checksum = createHash('sha256').update(JSON.stringify(staged.payload)).digest('hex');
  assert.throws(() => SoulCore.restore(staged, { dataDir: targetDir, clock: f.options.clock }), /阶段未通过/u);
  const blank = new SoulCore({ dataDir: targetDir, clock: f.options.clock }); t.after(() => blank.close());
  assert.equal(blank.lifecycle().phase, 'awaiting-name'); assert.equal(blank.timeline().length, 0);
});

test('隐私匹配支持包含引号的原文，并清理独立重复出现的词组', t => {
  const f = soulFixture(t), secret = 'private "quoted" phrase';
  const a = f.say('第一处资料：' + secret), b = f.say('另一个独立场合再次出现：' + secret);
  f.soul.privacyForget({ type: 'memory', id: a.id, match: secret });
  assert.equal(f.soul.memory(b.id)?.status, 'forgotten');
  assert(!JSON.stringify(f.soul.export()).includes('quoted'));
});
