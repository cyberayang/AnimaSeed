import test from 'node:test';
import assert from 'node:assert/strict';
import { join } from 'node:path';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { MemoryCore, loadPackage, savePackage, validatePackage } from '../src/index.ts';
import { fixture, directory } from './helpers.ts';

test('加密迁移保留身份、人格、情绪和原件关系，拒绝错密码与覆盖', t => {
  const f = fixture(t), source = f.say('记住：我喜欢海边散步。谢谢你理解我'); f.core.sleep();
  const packet = f.core.export(), path = join(directory(t), 'transfer.memory.enc'), password = 'fictional-password-123456';
  savePackage(packet, path, password);
  assert(!readFileSync(path, 'utf8').includes(source.text));
  assert.throws(() => loadPackage(path, 'wrong-password-12345'));
  assert.throws(() => savePackage(packet, path, password), /拒绝覆盖/u);
  const restored = MemoryCore.restore(loadPackage(path, password), { dataDir: directory(t), clock: f.options.clock });
  t.after(() => restored.close());
  assert.deepEqual(restored.state(), f.core.state());
  assert.deepEqual(restored.records(), f.core.records());
  assert.throws(() => MemoryCore.restore(packet, f.options), /空的数据目录/u);
  assert.equal(f.core.get(source.id)?.text, source.text);
});
test('迁移拒绝损坏包与重新计算校验后的伪造引用', t => {
  const f = fixture(t), source = f.say('虚构来源');
  const fact = f.core.remember({ kind: 'fact', text: '虚构来源', citations: [{ id: source.id, quote: source.text }] });
  const packet = f.core.export();
  packet.payload.memories.find(x => x.id === fact.id)!.citations[0].quote = '原文没有这句话';
  assert.throws(() => validatePackage(packet), /校验失败/u);
  packet.checksum = createHash('sha256').update(JSON.stringify(packet.payload)).digest('hex');
  assert.throws(() => validatePackage(packet), /证据链/u);
});
test('迁移后墓碑仍阻止重新整理和相同消息复活', t => {
  const f = fixture(t), source = f.say('不要带走这个细节');
  f.core.forget(source.id);
  const restored = MemoryCore.restore(f.core.export(), { dataDir: directory(t), clock: f.options.clock });
  t.after(() => restored.close());
  assert.equal(restored.observe({ sessionId: source.sessionId!, messageId: '1', role: 'user', text: source.text }).status, 'forgotten');
  assert.equal(restored.recall('这个细节').length, 0);
});
